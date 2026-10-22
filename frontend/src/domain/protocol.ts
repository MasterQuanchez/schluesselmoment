/**
 * Reine Fachlogik (keine UI, kein Speicher). Jede Funktion gibt ein NEUES Objekt zurück.
 * Alles hier ist mit Vitest abgedeckt (tests/protocol.test.ts).
 */
import { CHECKS, PHRASES, ROOM_TEMPLATES, type RoomTemplate, RULES } from './catalog';
import {
  type CheckState,
  type Defect,
  type Features,
  Features as FeaturesSchema,
  type KeyItem,
  type Party,
  type Protocol,
  type ProtocolType,
  type Room,
  type RoomDecision,
  SCHEMA_VERSION,
} from './schema';

export const newId = (): string => crypto.randomUUID();

export const emptyDefect = (): Defect => ({
  description: '',
  photoIds: [],
  quantity: null,
  unit: null,
  unitPriceCents: null,
});

const emptyParty = (): Party => ({ name: '', phone: '', email: '', newAddress: '' });

export function createProtocol(type: ProtocolType, now = new Date()): Protocol {
  const features = FeaturesSchema.parse({});
  const ts = now.toISOString();
  const keys: KeyItem[] = (['apartment', 'building', 'basement', 'mailbox'] as const).map((kind) => ({
    id: newId(),
    kind,
    label: '',
    count: 0,
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    type,
    status: 'draft',
    createdAt: ts,
    updatedAt: ts,
    inspector: '',
    property: { street: '', postalCode: '', city: '', unit: '', objectNumber: '', note: '' },
    features,
    landlord: emptyParty(),
    tenants: [emptyParty()],
    rooms: buildRooms(features),
    meters: [],
    keys,
    generalNote: '',
    signatures: [],
    seal: null,
    sharedAt: null,
  };
}

export function getTemplate(room: Pick<Room, 'templateId'>): RoomTemplate {
  const t = ROOM_TEMPLATES[room.templateId];
  if (!t) throw new Error(`Unbekannte Raumvorlage: ${room.templateId}`);
  return t;
}

function emptyRoom(templateId: string, id: string, label: string): Room {
  const t = ROOM_TEMPLATES[templateId];
  if (!t) throw new Error(`Unbekannte Raumvorlage: ${templateId}`);
  const inventory: Room['inventory'] = {};
  for (const item of t.inventory ?? []) inventory[item] = false;
  return {
    id,
    templateId,
    label,
    decision: 'open',
    checks: Object.fromEntries(t.checks.map((c) => [c, 'open' as CheckState])),
    details: {},
    defects: {},
    inventory,
    note: '',
    completedAt: null,
  };
}

/**
 * Raumliste aus der Ausstattung. Reihenfolge = Laufweg (Word: „links beginnend im Uhrzeigersinn“).
 * IDs sind deterministisch (z. B. „room-2“), damit ein Umbau der Ausstattung erfasste Daten behält.
 */
export function buildRooms(f: Features): Room[] {
  const rooms: Room[] = [emptyRoom('hallway', 'hallway', 'Flur')];
  if (f.kitchen === 'basic') rooms.push(emptyRoom('kitchenBasic', 'kitchen', 'Küche'));
  if (f.kitchen === 'fitted') rooms.push(emptyRoom('kitchenFitted', 'kitchen', 'Küche'));
  for (let i = 1; i <= f.bathroomCount; i++) {
    rooms.push(
      emptyRoom('bathroom', i === 1 ? 'bath' : `bath-${i}`, f.bathroomCount > 1 ? `Bad ${i}` : 'Bad'),
    );
  }
  if (f.guestWc) rooms.push(emptyRoom('guestWc', 'guestWc', 'Gäste-WC'));
  for (let i = 1; i <= f.roomCount; i++) rooms.push(emptyRoom('room', `room-${i}`, `Zimmer ${i}`));
  if (f.outdoor === 'wintergarden') rooms.push(emptyRoom('wintergarden', 'outdoor', 'Wintergarten'));
  else if (f.outdoor !== 'none') {
    const label = { balcony: 'Balkon', terrace: 'Terrasse', loggia: 'Loggia' }[f.outdoor];
    rooms.push(emptyRoom('outdoor', 'outdoor', label));
  }
  if (f.basement) rooms.push(emptyRoom('basement', 'basement', 'Keller'));
  rooms.push(emptyRoom('entrance', 'entrance', 'Eingangstür & Briefkasten'));
  rooms.push(emptyRoom('final', 'final', 'Abschluss-Prüfungen'));
  return rooms;
}

/** Ausstattung ändern: neue Raumliste, bereits erfasste Räume (gleiche ID + Vorlage) bleiben erhalten. */
export function applyFeatures(p: Protocol, features: Features): Protocol {
  const old = new Map(p.rooms.map((r) => [r.id, r]));
  const rooms = buildRooms(features).map((fresh) => {
    const prev = old.get(fresh.id);
    return prev && prev.templateId === fresh.templateId ? { ...prev, label: fresh.label } : fresh;
  });
  return { ...p, features, rooms };
}

// ---------- Schnellerfassung ----------

const NEXT: Record<CheckState, CheckState> = { open: 'ok', ok: 'defect', defect: 'open' };

/** Chip antippen: OK ✓ → Mangel ⚠ → zurück. Mängel-Daten bleiben beim Zurücksetzen erhalten (kein Datenverlust durch Vertippen). */
export function cycleCheck(room: Room, checkId: string): Room {
  const current = room.checks[checkId] ?? 'open';
  return setCheck(room, checkId, NEXT[current]);
}

export function setCheck(room: Room, checkId: string, state: CheckState): Room {
  const checks = { ...room.checks, [checkId]: state };
  const defects = { ...room.defects };
  if (state === 'defect' && !defects[checkId]) defects[checkId] = emptyDefect();
  const next: Room = { ...room, checks, defects, completedAt: null };
  return { ...next, decision: deriveDecision(next) };
}

function deriveDecision(room: Room): RoomDecision {
  const states = Object.values(room.checks);
  if (states.includes('defect')) return 'defects';
  // Kein Mangel (mehr) markiert: Entscheidung des Nutzers bleibt stehen
  return room.decision;
}

export type DecisionResult = { ok: true; room: Room } | { ok: false; reason: string };

/**
 * „Keine Mängel“: setzt NUR die Raum-Entscheidung. Jeder Punkt muss trotzdem einzeln bestätigt werden
 * (Entscheidung Fachseite 22.10.2026: kein „Alle OK“, besonders bei der Einbauküche).
 * Nicht erlaubt, solange ein Mangel markiert ist.
 */
export function markNoDefects(room: Room): DecisionResult {
  if (Object.values(room.checks).includes('defect')) {
    return { ok: false, reason: 'Es ist noch ein Mangel markiert. Bitte zuerst zurücksetzen.' };
  }
  return { ok: true, room: { ...room, decision: 'noDefects', completedAt: null } };
}

/** Hilfsfunktion nur für Tests/Seed-Daten: alle Punkte einzeln auf OK (entspricht dem Durchklicken). */
export function confirmAllChecks(room: Room): Room {
  return Object.keys(room.checks).reduce(
    (r, id) => (r.checks[id] === 'open' ? setCheck(r, id, 'ok') : r),
    room,
  );
}

/** „Mängel“: Raum öffnet die Mangel-Erfassung; Punkte werden einzeln markiert. */
export function markHasDefects(room: Room): Room {
  return { ...room, decision: 'defects', completedAt: null };
}

export function updateDefect(room: Room, checkId: string, patch: Partial<Room['defects'][string]>): Room {
  const prev = room.defects[checkId] ?? emptyDefect();
  return { ...room, defects: { ...room.defects, [checkId]: { ...prev, ...patch } }, completedAt: null };
}

export function setDetail(room: Room, checkId: string, attrId: string, value: string | null): Room {
  const cur = { ...(room.details[checkId] ?? {}) };
  if (value === null || cur[attrId] === value) delete cur[attrId];
  else cur[attrId] = value;
  return { ...room, details: { ...room.details, [checkId]: cur } };
}

/** Schnellauswahl-Begriff an einen Text anhängen. Doppelte Begriffe werden nicht erneut angehängt. */
export function appendPhrase(text: string, phrase: string): string {
  const t = text.trimEnd();
  if (!t) return phrase;
  if (t.toLowerCase().includes(phrase.toLowerCase())) return text;
  const sep = /[.,;:!?]$/.test(t) ? ' ' : ', ';
  return `${t}${sep}${phrase}`;
}

/** Standardbegriffe (zentral im Katalog, kommen mit jedem App-Update) + eigene Begriffe dieses Geräts. */
export function phrasesFor(room: Room, custom: readonly string[] = []): string[] {
  const t = getTemplate(room);
  const all = [
    ...(PHRASES.general ?? []),
    ...(t.phraseGroups ?? []).flatMap((g) => PHRASES[g] ?? []),
    ...custom,
  ];
  return [...new Set(all)];
}

// ---------- Vollständigkeit („nichts vergessen“) ----------

export interface Issue {
  roomId?: string;
  checkId?: string;
  message: string;
}

export function roomIssues(room: Room): Issue[] {
  const issues: Issue[] = [];
  for (const [checkId, state] of Object.entries(room.checks)) {
    const label = CHECKS[checkId]?.label ?? checkId;
    if (state === 'open') issues.push({ roomId: room.id, checkId, message: `${label}: noch nicht geprüft` });
    if (state === 'defect') {
      const d = room.defects[checkId];
      if (RULES.defectNeedsDescription && !d?.description.trim()) {
        issues.push({ roomId: room.id, checkId, message: `${label}: Mangel beschreiben` });
      }
      const n = d?.photoIds.length ?? 0;
      if (n < RULES.minPhotosPerDefect) {
        issues.push({
          roomId: room.id,
          checkId,
          message: `${label}: ${RULES.minPhotosPerDefect - n} Foto(s) fehlen`,
        });
      }
    }
  }
  return issues;
}

export function completeRoom(room: Room, now = new Date()): DecisionResult {
  const issues = roomIssues(room);
  if (issues.length) return { ok: false, reason: issues.map((i) => i.message).join(' · ') };
  return { ok: true, room: { ...room, completedAt: now.toISOString() } };
}

export function roomProgress(room: Room): { done: number; total: number } {
  const states = Object.values(room.checks);
  return { done: states.filter((s) => s !== 'open').length, total: states.length };
}

export function protocolIssues(p: Protocol): Issue[] {
  const issues: Issue[] = [];
  if (!p.property.street.trim()) issues.push({ message: 'Adresse fehlt' });
  if (!p.landlord.name.trim()) issues.push({ message: 'Name Vermieter/Verwalter fehlt' });
  if (!p.tenants.some((t) => t.name.trim())) issues.push({ message: 'Name Mieter fehlt' });
  for (const r of p.rooms) {
    if (!r.completedAt) issues.push({ roomId: r.id, message: `${r.label}: nicht abgeschlossen` });
  }
  return issues;
}

/** Alle Foto-IDs, auf die das Protokoll aktuell verweist (nur aktive Mängel + Zähler). */
export function referencedPhotoIds(p: Protocol): string[] {
  const ids: string[] = [];
  for (const r of p.rooms) {
    for (const [checkId, state] of Object.entries(r.checks)) {
      if (state === 'defect') ids.push(...(r.defects[checkId]?.photoIds ?? []));
    }
  }
  for (const m of p.meters) ids.push(...m.photoIds);
  return ids;
}

// ---------- Versiegelung (Manipulationsschutz) ----------

/** Stabile JSON-Darstellung (sortierte Schlüssel), damit derselbe Inhalt immer denselben Hash ergibt. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash über den Protokollinhalt inkl. Unterschriften und Foto-Hashes.
 * Steht im PDF; wer das JSON/Fotos nachträglich ändert, bekommt einen anderen Hash.
 */
export async function computeSealHash(p: Protocol, photoHashes: Record<string, string>): Promise<string> {
  const { seal: _seal, status: _status, updatedAt: _u, sharedAt: _s, ...content } = p;
  return sha256Hex(canonicalJson({ content, photoHashes }));
}

// ---------- Unterschrift & Abschluss ----------

export interface Signer {
  role: 'landlord' | 'tenant';
  partyIndex: number;
  name: string;
}

/** Wer muss unterschreiben? Vermieter/Verwalter + alle Mieter mit Namen. */
export function requiredSigners(p: Protocol): Signer[] {
  const s: Signer[] = [{ role: 'landlord', partyIndex: 0, name: p.landlord.name }];
  p.tenants.forEach((t, i) => {
    if (t.name.trim()) s.push({ role: 'tenant', partyIndex: i, name: t.name });
  });
  return s;
}

export function signatureFor(p: Protocol, signer: Pick<Signer, 'role' | 'partyIndex'>) {
  return p.signatures.find((x) => x.role === signer.role && x.partyIndex === signer.partyIndex) ?? null;
}

export function allSigned(p: Protocol): boolean {
  return requiredSigners(p).every((s) => signatureFor(p, s));
}

export type ProtocolResult = { ok: true; protocol: Protocol } | { ok: false; reason: string };

/** Inhalt festschreiben → ab jetzt nur noch Unterschriften. */
export function startSigning(p: Protocol): ProtocolResult {
  if (p.status !== 'draft') return { ok: false, reason: 'Protokoll ist bereits gesperrt.' };
  const issues = protocolIssues(p);
  if (issues.length) return { ok: false, reason: issues.map((i) => i.message).join(' · ') };
  return { ok: true, protocol: { ...p, status: 'signing' } };
}

/** Zurück zur Bearbeitung: vorhandene Unterschriften verfallen (sie galten dem alten Inhalt). */
export function backToDraft(p: Protocol): Protocol {
  if (p.status === 'signed') return p; // versiegelt bleibt versiegelt
  return { ...p, status: 'draft', signatures: [] };
}

export function addSignature(p: Protocol, signer: Signer, image: string, now = new Date()): Protocol {
  if (p.status !== 'signing') return p;
  const others = p.signatures.filter((x) => !(x.role === signer.role && x.partyIndex === signer.partyIndex));
  return {
    ...p,
    signatures: [
      ...others,
      {
        role: signer.role,
        partyIndex: signer.partyIndex,
        name: signer.name,
        image,
        signedAt: now.toISOString(),
      },
    ],
  };
}

export async function sealProtocol(
  p: Protocol,
  photoHashes: Record<string, string>,
  now = new Date(),
): Promise<ProtocolResult> {
  if (p.status !== 'signing') return { ok: false, reason: 'Erst Inhalt festschreiben und unterschreiben.' };
  if (!allSigned(p)) return { ok: false, reason: 'Es fehlen noch Unterschriften.' };
  const hash = await computeSealHash(p, photoHashes);
  return {
    ok: true,
    protocol: { ...p, status: 'signed', seal: { algorithm: 'SHA-256', hash, sealedAt: now.toISOString() } },
  };
}

// ---------- Versand & Aufbewahrung ----------

/** Empfänger für die E-Mail: alle Mieter mit Adresse, Vermieter/Verwalter, feste Kopie aus der Konfiguration. */
export function mailRecipients(p: Protocol, ccEmail = ''): string[] {
  const all = [...p.tenants.map((t) => t.email), p.landlord.email, ccEmail]
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  return [...new Set(all.map((e) => e.toLowerCase()))];
}

/** Löschdatum: retentionDays nach dem ersten Versand. Entwürfe und nicht geteilte Protokolle werden nie automatisch gelöscht. */
export function deletionDate(p: Protocol, retentionDays: number): Date | null {
  if (p.status !== 'signed' || !p.sharedAt) return null;
  return new Date(new Date(p.sharedAt).getTime() + retentionDays * 86_400_000);
}

export function isExpired(p: Protocol, retentionDays: number, now = new Date()): boolean {
  const d = deletionDate(p, retentionDays);
  return d !== null && d.getTime() <= now.getTime();
}
