/**
 * Reine Fachlogik (keine UI, kein Speicher). Jede Funktion gibt ein NEUES Objekt zurück.
 * Alles hier ist mit Vitest abgedeckt (tests/protocol.test.ts).
 */
import {
  CHECKS,
  CONDITION_PHRASES,
  DEFECT_PHRASES,
  INVENTORY,
  METER_LABEL,
  ROOM_TEMPLATES,
  type RoomTemplate,
  RULES,
} from './catalog';
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

/** Kalendertag in der lokalen Zeitzone, `YYYY-MM-DD`. */
export function localIsoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const emptyDefect = (): Defect => ({
  description: '',
  photoIds: [],
  quantity: null,
  unit: null,
  unitPriceCents: null,
});

const emptyParty = (): Party => ({ name: '', phone: '', email: '', noEmail: false, newAddress: '' });

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
    handoverOn: localIsoDate(now),
    moveInOn: '',
    moveOutOn: '',
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
  for (const item of t.inventory ?? []) inventory[item] = null;
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

/**
 * Anzahl: null ist offen und heißt „–“. + setzt 1, − setzt 0.
 * Unter 0 wird wieder offen. 0 bleibt nur, wenn es bewusst gewählt wurde.
 */
export function stepCount(value: number | null, delta: 1 | -1, max = 99): number | null {
  if (value === null) return delta > 0 ? 1 : 0;
  const next = value + delta;
  if (next < 0) return null;
  return Math.min(max, next);
}

/** Eingabe: leer = offen, „0“ = bewusst null Stück, sonst die Zahl. */
export function parseCount(raw: string, max = 99): number | null {
  const text = raw.trim().replace('–', '');
  if (!text) return null;
  if (!/^\d+$/.test(text)) return null;
  return Math.min(max, Number(text));
}

/** Chip antippen: nur offen ↔ OK. Mangel und Nicht vorhanden setzt das Sheet. */
export function cycleCheck(room: Room, checkId: string): Room {
  const current = room.checks[checkId] ?? 'open';
  return setCheck(room, checkId, current === 'open' ? 'ok' : 'open');
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
  if (states.length > 0 && states.every((state) => state === 'ok' || state === 'na')) return 'noDefects';
  return 'open';
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
  const removing = value === null || cur[attrId] === value;
  if (removing) delete cur[attrId];
  else cur[attrId] = value;
  let next: Room = { ...room, details: { ...room.details, [checkId]: cur } };
  // Choosing a detail means this one element was looked at. A defect stays a defect.
  if (!removing && (next.checks[checkId] ?? 'open') === 'open') next = setCheck(next, checkId, 'ok');
  return next;
}

/** Schnellauswahl-Begriff an einen Text anhängen. Doppelte Begriffe werden nicht erneut angehängt. */
export function appendPhrase(text: string, phrase: string): string {
  const t = text.trimEnd();
  if (!t) return phrase;
  if (t.toLowerCase().includes(phrase.toLowerCase())) return text;
  const sep = /[.,;:!?]$/.test(t) ? ' ' : ', ';
  return `${t}${sep}${phrase}`;
}

/** Zustandsbegriffe für die Raum-Notiz. Eigene Begriffe gehören zum Mangel, nicht hierher. */
export function conditionPhrases(): readonly string[] {
  return CONDITION_PHRASES;
}

/** Mangel-Vorschläge: dieses Element, dann allgemeine, dann eigene Begriffe des Geräts. */
export function defectPhrases(checkId: string, custom: readonly string[] = []): string[] {
  return [...new Set([...(DEFECT_PHRASES[checkId] ?? []), ...(DEFECT_PHRASES.general ?? []), ...custom])];
}

// ---------- Vollständigkeit („nichts vergessen“) ----------

export interface Issue {
  roomId?: string;
  checkId?: string;
  /** DOM-id zum Scrollen und Fokussieren. */
  fieldId?: string;
  message: string;
}

export interface RoomIssue {
  checkId: string;
  kind: 'open' | 'missingDescription' | 'missingPhotos' | 'missingDetail' | 'missingInventory';
  missingCount: number;
  /** Attributname, wenn genau eine Angabe fehlt. */
  detail?: string;
}

export type RuleFlags = {
  requireDetails?: boolean;
  requireContactFields?: boolean;
};

const INVENTORY_REQUIRED = new Set(['kitchenBasic', 'kitchenFitted', 'bathroom']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function flags(over?: RuleFlags) {
  return {
    requireDetails: over?.requireDetails ?? RULES.requireDetails,
    requireContactFields: over?.requireContactFields ?? RULES.requireContactFields,
  };
}

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/** Fehlende Attributnamen bei OK oder Mangel. Nicht vorhanden braucht keine Angaben. */
export function missingAttributes(room: Room, checkId: string): string[] {
  const state = room.checks[checkId];
  if (state !== 'ok' && state !== 'defect') return [];
  return (CHECKS[checkId]?.attributes ?? [])
    .filter((attr) => !room.details[checkId]?.[attr.id])
    .map((attr) => attr.label);
}

function inventoryMissing(room: Room): number {
  if (!INVENTORY_REQUIRED.has(room.templateId)) return 0;
  let count = 0;
  for (const id of getTemplate(room).inventory ?? []) {
    const item = INVENTORY[id];
    if (!item) continue;
    const value = room.inventory[id];
    if (item.type === 'count') {
      if (typeof value !== 'number') count += 1;
    } else if (value !== true && value !== false) count += 1;
  }
  return count;
}

/** Offene Punkte und unvollständige Mängel. Beim Mangel steht das fehlende Foto vor der Beschreibung. */
export function roomIssues(room: Room, over?: RuleFlags): RoomIssue[] {
  const { requireDetails } = flags(over);
  const issues: RoomIssue[] = [];
  for (const [checkId, state] of Object.entries(room.checks)) {
    if (state === 'open') issues.push({ checkId, kind: 'open', missingCount: 0 });
    if (state === 'defect') {
      const d = room.defects[checkId];
      const missing = RULES.minPhotosPerDefect - (d?.photoIds.length ?? 0);
      if (missing > 0) issues.push({ checkId, kind: 'missingPhotos', missingCount: missing });
      if (RULES.defectNeedsDescription && !d?.description.trim()) {
        issues.push({ checkId, kind: 'missingDescription', missingCount: 0 });
      }
    }
    if (requireDetails) {
      const labels = missingAttributes(room, checkId);
      if (labels.length === 1) {
        issues.push({ checkId, kind: 'missingDetail', missingCount: 1, detail: labels[0] });
      } else if (labels.length > 1) {
        issues.push({ checkId, kind: 'missingDetail', missingCount: labels.length });
      }
    }
  }
  const openInventory = inventoryMissing(room);
  if (openInventory > 0) {
    issues.push({ checkId: '', kind: 'missingInventory', missingCount: openInventory });
  }
  return issues;
}

/** Klartext mit Element und Grund. Die Foto-Zahl kommt aus dem Issue, nicht aus einer festen 2. */
export function issueLabel(issue: RoomIssue, room?: Pick<Room, 'label'>): string {
  if (issue.kind === 'missingInventory') {
    const name = room?.label ?? 'Raum';
    return issue.missingCount === 1
      ? `${name}: 1 Ausstattungspunkt offen`
      : `${name}: ${issue.missingCount} Ausstattungspunkte offen`;
  }
  const name = CHECKS[issue.checkId]?.label ?? issue.checkId;
  if (issue.kind === 'open') return `${name}: noch nicht geprüft`;
  if (issue.kind === 'missingDescription') return `${name}: Beschreibung fehlt`;
  if (issue.kind === 'missingDetail') {
    if (issue.missingCount === 1 && issue.detail) return `${name}: ${issue.detail} fehlt`;
    return `${name}: ${issue.missingCount} Angaben fehlen`;
  }
  return issue.missingCount === 1 ? `${name}: 1 Foto fehlt` : `${name}: ${issue.missingCount} Fotos fehlen`;
}

export function photoCountLabel(count: number, min: number = RULES.minPhotosPerDefect): string {
  return `Foto (${count}/${min})`;
}

/** Statuszeile im Sheet. `min` bleibt die Regel, damit die Fachseite die Zahl ändern kann. */
export function photoStatusLabel(count: number, min: number = RULES.minPhotosPerDefect): string {
  if (count >= min) return count === 1 ? '✓ 1 Foto' : `✓ ${count} Fotos`;
  const missing = min - count;
  return missing === 1 ? 'Noch 1 Foto nötig' : `Noch ${missing} Fotos nötig`;
}

export function sheetCloseLabel(issue: RoomIssue): string {
  if (issue.kind === 'missingPhotos') {
    return issue.missingCount === 1
      ? 'Schließen – 1 Foto fehlt noch'
      : `Schließen – ${issue.missingCount} Fotos fehlen noch`;
  }
  if (issue.kind === 'missingDescription') return 'Schließen – Beschreibung fehlt noch';
  if (issue.kind === 'missingDetail') {
    if (issue.missingCount === 1 && issue.detail) return `Schließen – ${issue.detail} fehlt noch`;
    return `Schließen – ${issue.missingCount} Angaben fehlen noch`;
  }
  return 'Schließen';
}

export function completeRoom(room: Room, now = new Date()): DecisionResult {
  const issues = roomIssues(room);
  if (issues.length) return { ok: false, reason: issues.map((issue) => issueLabel(issue, room)).join(' · ') };
  return { ok: true, room: { ...room, completedAt: now.toISOString() } };
}

export function roomProgress(room: Room): { done: number; total: number } {
  const states = Object.values(room.checks);
  return { done: states.filter((s) => s !== 'open').length, total: states.length };
}

/** Eine Status-Pill für die Raumliste. Offen hat keine. */
export function roomStatusLabel(room: Room): { label: string; tone: 'ok' | 'warning' } | null {
  if (!room.completedAt) return null;
  const defects = Object.values(room.checks).filter((state) => state === 'defect').length;
  if (defects === 0) return { label: '✓ erledigt', tone: 'ok' };
  if (defects === 1) return { label: '✓ 1 Mangel', tone: 'warning' };
  return { label: `✓ ${defects} Mängel`, tone: 'warning' };
}

/** Ausstattung: zuerst Ja/Nein, dann Zähler. Unbekannte IDs fallen weg. */
export function inventoryGroups(ids: readonly string[]): { present: string[]; counts: string[] } {
  const present: string[] = [];
  const counts: string[] = [];
  for (const id of ids) {
    const item = INVENTORY[id];
    if (!item) continue;
    if (item.type === 'count') counts.push(id);
    else present.push(id);
  }
  return { present, counts };
}

/** Statuszeile unter dem Raumtitel. */
export function roomHeadline(room: Room): string {
  const states = Object.values(room.checks);
  const open = states.filter((state) => state === 'open').length;
  const defects = states.filter((state) => state === 'defect').length;
  if (open === 1) return '1 offen';
  if (open > 1) return `${open} offen`;
  if (defects === 1) return '1 Mangel';
  if (defects > 1) return `${defects} Mängel`;
  return 'Keine Mängel';
}

/** Erster konkreter Punkt eines offenen Raums, plus Anzahl der weiteren. */
export function finishRoomLine(room: Room): { message: string; checkId?: string } {
  const issues = roomIssues(room);
  const first = issues[0];
  if (!first) return { message: `${room.label}: nicht abgeschlossen` };
  const more = issues.length > 1 ? ` (+${issues.length - 1} weitere)` : '';
  return { message: `${room.label}: ${finishIssueBody(first)}${more}`, checkId: first.checkId || undefined };
}

function finishIssueBody(issue: RoomIssue): string {
  if (issue.kind === 'missingInventory') {
    return issue.missingCount === 1
      ? '1 Ausstattungspunkt offen'
      : `${issue.missingCount} Ausstattungspunkte offen`;
  }
  const name = CHECKS[issue.checkId]?.label ?? issue.checkId;
  if (issue.kind === 'open') return `${name} – noch nicht geprüft`;
  if (issue.kind === 'missingDescription') return `${name} – Beschreibung fehlt`;
  if (issue.kind === 'missingPhotos') {
    return issue.missingCount === 1
      ? `${name} – 1 Foto fehlt`
      : `${name} – ${issue.missingCount} Fotos fehlen`;
  }
  if (issue.kind === 'missingDetail') {
    if (issue.missingCount === 1 && issue.detail) return `${name} – ${issue.detail} fehlt`;
    return `${name} – ${issue.missingCount} Angaben fehlen`;
  }
  return name;
}

export function protocolIssues(p: Protocol, over?: RuleFlags): Issue[] {
  const { requireContactFields } = flags(over);
  const issues: Issue[] = [];
  const street = p.property.street.trim();
  const postalCode = p.property.postalCode.trim();
  const city = p.property.city.trim();
  if (!street) issues.push({ fieldId: 'field-street', message: 'Straße fehlt' });
  if (!postalCode) issues.push({ fieldId: 'field-postalCode', message: 'PLZ fehlt' });
  else if (!/^\d{5}$/.test(postalCode))
    issues.push({ fieldId: 'field-postalCode', message: 'PLZ: 5 Ziffern' });
  if (!city) issues.push({ fieldId: 'field-city', message: 'Ort fehlt' });
  if (!p.landlord.name.trim()) {
    issues.push({ fieldId: 'field-landlord-name', message: 'Name Vermieter/Verwalter fehlt' });
  }
  p.tenants.forEach((tenant, index) => {
    if (!tenant.name.trim())
      issues.push({ fieldId: `field-tenant-${index}-name`, message: 'Name Mieter fehlt' });
  });
  for (const meter of p.meters) {
    if (!meter.reading.trim()) {
      issues.push({
        fieldId: `field-meter-${meter.id}-reading`,
        message: `${METER_LABEL[meter.kind].label}: Stand fehlt`,
      });
    }
  }
  const emailError = (value: string, fieldId: string, who: string) => {
    if (value.trim() && !isValidEmail(value)) issues.push({ fieldId, message: `${who}: E-Mail ungültig` });
  };
  emailError(p.landlord.email, 'field-landlord-email', 'Vermieter/Verwalter');
  p.tenants.forEach((tenant, index) => {
    if (!tenant.noEmail) emailError(tenant.email, `field-tenant-${index}-email`, 'Mieter');
  });
  if (requireContactFields) {
    if (!p.property.unit.trim()) issues.push({ fieldId: 'field-unit', message: 'Lage fehlt' });
    if (!p.property.objectNumber.trim())
      issues.push({ fieldId: 'field-objectNumber', message: 'Objekt-Nr. fehlt' });
    if (!p.landlord.phone.trim()) {
      issues.push({ fieldId: 'field-landlord-phone', message: 'Telefon Vermieter/Verwalter fehlt' });
    }
    if (!p.landlord.email.trim()) {
      issues.push({ fieldId: 'field-landlord-email', message: 'E-Mail Vermieter/Verwalter fehlt' });
    }
    p.tenants.forEach((tenant, index) => {
      if (!tenant.phone.trim())
        issues.push({ fieldId: `field-tenant-${index}-phone`, message: 'Telefon Mieter fehlt' });
      if (!tenant.noEmail && !tenant.email.trim()) {
        issues.push({ fieldId: `field-tenant-${index}-email`, message: 'E-Mail Mieter fehlt' });
      }
    });
  }
  for (const room of p.rooms) {
    if (!room.completedAt) {
      const line = finishRoomLine(room);
      issues.push({ roomId: room.id, checkId: line.checkId, message: line.message });
    }
  }
  return issues;
}

/** Hinweise, die den Abschluss nicht sperren. */
export function recommendedIssues(p: Protocol, over?: RuleFlags): Issue[] {
  const { requireDetails, requireContactFields } = flags(over);
  const issues: Issue[] = [];
  if (!requireContactFields) {
    if (!p.property.unit.trim()) issues.push({ fieldId: 'field-unit', message: 'Lage fehlt' });
    if (!p.property.objectNumber.trim())
      issues.push({ fieldId: 'field-objectNumber', message: 'Objekt-Nr. fehlt' });
    if (!p.landlord.phone.trim()) {
      issues.push({ fieldId: 'field-landlord-phone', message: 'Telefon Vermieter/Verwalter fehlt' });
    }
    if (!p.landlord.email.trim()) {
      issues.push({ fieldId: 'field-landlord-email', message: 'E-Mail Vermieter/Verwalter fehlt' });
    }
    p.tenants.forEach((tenant, index) => {
      if (!tenant.phone.trim())
        issues.push({ fieldId: `field-tenant-${index}-phone`, message: 'Telefon Mieter fehlt' });
      if (!tenant.noEmail && !tenant.email.trim()) {
        issues.push({ fieldId: `field-tenant-${index}-email`, message: 'E-Mail Mieter fehlt' });
      }
    });
  }
  if (!requireDetails) {
    for (const room of p.rooms) {
      for (const issue of roomIssues(room, { requireDetails: true })) {
        if (issue.kind !== 'missingDetail') continue;
        issues.push({ roomId: room.id, checkId: issue.checkId, message: issueLabel(issue, room) });
      }
    }
  }
  for (const meter of p.meters) {
    const label = METER_LABEL[meter.kind].label;
    if (!meter.number.trim()) {
      issues.push({ fieldId: `field-meter-${meter.id}-number`, message: `${label}: Zählernummer fehlt` });
    }
    if (!meter.location.trim()) {
      issues.push({ fieldId: `field-meter-${meter.id}-location`, message: `${label}: Ort fehlt` });
    }
    if (meter.photoIds.length === 0) {
      issues.push({ fieldId: `field-meter-${meter.id}-photos`, message: `${label}: Foto fehlt` });
    }
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

export function missingSignatureCount(p: Protocol): number {
  return requiredSigners(p).filter((s) => !signatureFor(p, s)).length;
}

/** Text im gesperrten Versiegeln-Knopf. */
export function missingSignatureLabel(missing: number): string {
  if (missing === 1) return 'Noch 1 Unterschrift fehlt';
  return `Noch ${missing} Unterschriften fehlen`;
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
