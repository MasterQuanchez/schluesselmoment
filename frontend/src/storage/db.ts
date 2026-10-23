/**
 * Lokaler Speicher (IndexedDB) – ersetzt localStorage aus v1.
 * - Fotos als Blob (nicht Base64), kein 5-MB-Limit.
 * - Jeder gelesene Datensatz wird mit Zod geprüft (beschädigte/fremde Daten crashen die App nicht).
 * - Bewusst ohne Bibliothek (kleine Angriffsfläche). Bei Bedarf später gegen Dexie tauschbar:
 *   die öffentliche API unten bleibt gleich.
 */
import { isExpired } from '@/domain/protocol';
import { type PhotoRecord, Protocol, Settings } from '@/domain/schema';
import { migrateProtocol } from './migrate';

const DB_NAME = 'schluesselmoment';
const DB_VERSION = 2; // v2: Store „settings“
const P = 'protocols';
const F = 'photos';
const S = 'settings';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(P)) db.createObjectStore(P, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(F)) {
        db.createObjectStore(F, { keyPath: 'id' }).createIndex('protocolId', 'protocolId');
      }
      if (!db.objectStoreNames.contains(S)) db.createObjectStore(S, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Datenbank ist in einem anderen Tab geöffnet.'));
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen'));
  });
}

/** Browser bitten, die Daten nicht automatisch zu löschen (wichtig auf Android bei wenig Speicher). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ---------- Protokolle ----------

export async function saveProtocol(p: Protocol): Promise<void> {
  const db = await open();
  const tx = db.transaction(P, 'readwrite');
  tx.objectStore(P).put(Protocol.parse(p));
  await done(tx);
}

export async function getProtocol(id: string): Promise<Protocol | null> {
  const db = await open();
  const raw = await wrap(db.transaction(P).objectStore(P).get(id));
  if (!raw) return null;
  const parsed = Protocol.safeParse(migrateProtocol(raw));
  if (!parsed.success) {
    console.error('Protokoll beschädigt oder veraltet', parsed.error);
    throw new Error('Protokoll konnte nicht gelesen werden (Datenformat).');
  }
  return parsed.data;
}

export async function listProtocols(): Promise<Protocol[]> {
  const db = await open();
  const all = (await wrap(db.transaction(P).objectStore(P).getAll())) as unknown[];
  return all
    .map((x) => Protocol.safeParse(migrateProtocol(x)))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Löscht Protokoll UND alle zugehörigen Fotos (Datensparsamkeit, DSGVO). */
export async function deleteProtocol(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction([P, F], 'readwrite');
  tx.objectStore(P).delete(id);
  const idx = tx.objectStore(F).index('protocolId');
  const keys = await wrap(idx.getAllKeys(IDBKeyRange.only(id)));
  for (const k of keys) tx.objectStore(F).delete(k);
  await done(tx);
}

// ---------- Fotos ----------

export async function putPhoto(rec: PhotoRecord): Promise<void> {
  const db = await open();
  const tx = db.transaction(F, 'readwrite');
  tx.objectStore(F).put(rec);
  await done(tx);
}

export async function getPhoto(id: string): Promise<PhotoRecord | null> {
  const db = await open();
  return ((await wrap(db.transaction(F).objectStore(F).get(id))) as PhotoRecord | undefined) ?? null;
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(F, 'readwrite');
  tx.objectStore(F).delete(id);
  await done(tx);
}

/** Fotos löschen, auf die das Protokoll nicht mehr verweist (z. B. nach „Mangel zurücksetzen“ + Abschluss). */
export async function prunePhotos(protocolId: string, keep: ReadonlySet<string>): Promise<number> {
  const db = await open();
  const tx = db.transaction(F, 'readwrite');
  const keys = await wrap(tx.objectStore(F).index('protocolId').getAllKeys(IDBKeyRange.only(protocolId)));
  let n = 0;
  for (const k of keys) {
    if (!keep.has(String(k))) {
      tx.objectStore(F).delete(k);
      n++;
    }
  }
  await done(tx);
  return n;
}

// ---------- Einstellungen (nur dieses Gerät) ----------

export async function getSettings(): Promise<Settings> {
  const db = await open();
  const raw = await wrap(db.transaction(S).objectStore(S).get('device'));
  const parsed = Settings.safeParse(raw ?? { id: 'device' });
  return parsed.success ? parsed.data : Settings.parse({ id: 'device' });
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await open();
  const tx = db.transaction(S, 'readwrite');
  tx.objectStore(S).put(Settings.parse(s));
  await done(tx);
}

// ---------- Aufbewahrung ----------

/** Beim App-Start: versendete Protokolle nach Ablauf der Frist inkl. Fotos löschen. Gibt die Anzahl zurück. */
export async function purgeExpired(retentionDays: number, now = new Date()): Promise<number> {
  const expired = (await listProtocols()).filter((p) => isExpired(p, retentionDays, now));
  for (const p of expired) await deleteProtocol(p.id);
  return expired.length;
}

/** Nur für Tests */
export async function _resetForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await wrap(indexedDB.deleteDatabase(DB_NAME));
}
