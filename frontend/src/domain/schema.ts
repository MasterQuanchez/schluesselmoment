/**
 * Datenmodell des Übergabeprotokolls.
 * Eine Quelle der Wahrheit: Zod-Schemas → TypeScript-Typen → Validierung beim Laden aus IndexedDB.
 * Änderungen am Schema: SCHEMA_VERSION erhöhen und Migration in storage/migrate.ts ergänzen.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

export const ProtocolType = z.enum(['uebergabe', 'abnahme', 'bestandsaufnahme']);
export type ProtocolType = z.infer<typeof ProtocolType>;

/** Tri-State je Prüfpunkt (Schnellcheck-Chip): offen → OK → Mangel → offen */
export const CheckState = z.enum(['open', 'ok', 'defect']);
export type CheckState = z.infer<typeof CheckState>;

/** Entscheidung auf Raumebene (großer Schalter oben) */
export const RoomDecision = z.enum(['open', 'noDefects', 'defects']);
export type RoomDecision = z.infer<typeof RoomDecision>;

export const Party = z.object({
  name: z.string().max(200).default(''),
  phone: z.string().max(60).default(''),
  email: z.string().max(200).default(''),
  newAddress: z.string().max(300).default(''),
});
export type Party = z.infer<typeof Party>;

export const Property = z.object({
  street: z.string().max(200).default(''),
  postalCode: z.string().max(12).default(''),
  city: z.string().max(120).default(''),
  unit: z.string().max(120).default(''), // Lage, z. B. „2. OG links“
  objectNumber: z.string().max(40).default(''),
  note: z.string().max(2000).default(''),
});
export type Property = z.infer<typeof Property>;

export const Features = z.object({
  roomCount: z.number().int().min(0).max(20).default(2),
  kitchen: z.enum(['none', 'basic', 'fitted']).default('basic'),
  bathroomCount: z.number().int().min(1).max(5).default(1),
  guestWc: z.boolean().default(false),
  outdoor: z.enum(['none', 'balcony', 'terrace', 'loggia', 'wintergarden']).default('none'),
  basement: z.boolean().default(false),
  elektroUnterPutz: z.boolean().default(true),
});
export type Features = z.infer<typeof Features>;

export const Defect = z.object({
  description: z.string().max(2000).default(''),
  photoIds: z.array(z.string()).default([]),
  /** Vorbereitet für Schadenskalkulation (später, SM-07): Menge × Einheitspreis. In v1 ohne Oberfläche. */
  quantity: z.number().min(0).nullable().default(null),
  unit: z.enum(['m2', 'm', 'stk', 'pauschal']).nullable().default(null),
  unitPriceCents: z.number().int().min(0).nullable().default(null),
});
export type Defect = z.infer<typeof Defect>;

export const Room = z.object({
  id: z.string(),
  templateId: z.string(),
  label: z.string().max(120),
  decision: RoomDecision.default('open'),
  /** Prüfpunkt-ID → Zustand. Nur Prüfpunkte der Vorlage (plus ggf. zugeschaltete). */
  checks: z.record(z.string(), CheckState).default({}),
  /** Prüfpunkt-ID → Attribut-ID → Wert, z. B. walls → paint → 'new'. Optional. */
  details: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /** Prüfpunkt-ID → Mangel (nur wenn checks[id] === 'defect') */
  defects: z.record(z.string(), Defect).default({}),
  /** Ausstattung: Geräte/Einrichtung → vorhanden (bool) oder Anzahl (number) */
  inventory: z.record(z.string(), z.union([z.boolean(), z.number().int().min(0).max(99)])).default({}),
  note: z.string().max(4000).default(''),
  completedAt: z.string().nullable().default(null),
});
export type Room = z.infer<typeof Room>;

export const Meter = z.object({
  id: z.string(),
  kind: z.enum(['electricity', 'gas', 'water_cold', 'water_hot', 'heat', 'hca']),
  number: z.string().max(60).default(''),
  reading: z.string().max(30).default(''),
  location: z.string().max(120).default(''),
  photoIds: z.array(z.string()).default([]),
});
export type Meter = z.infer<typeof Meter>;

export const KeyItem = z.object({
  id: z.string(),
  kind: z.enum(['apartment', 'building', 'basement', 'mailbox', 'room', 'other']),
  label: z.string().max(120).default(''),
  count: z.number().int().min(0).max(99).default(0),
});
export type KeyItem = z.infer<typeof KeyItem>;

export const SignatureRole = z.enum(['landlord', 'tenant']);
export type SignatureRole = z.infer<typeof SignatureRole>;

export const Signature = z.object({
  role: SignatureRole,
  partyIndex: z.number().int().min(0).default(0),
  name: z.string().max(200),
  /** PNG als data:-URL (klein, ~10–30 kB). Nur aus dem eigenen Canvas erzeugt. */
  image: z.string().startsWith('data:image/png;base64,'),
  signedAt: z.string(),
});
export type Signature = z.infer<typeof Signature>;

export const Seal = z.object({
  algorithm: z.literal('SHA-256'),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  sealedAt: z.string(),
});
export type Seal = z.infer<typeof Seal>;

export const Protocol = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  type: ProtocolType,
  /** draft = bearbeitbar · signing = Inhalt gesperrt, nur Unterschriften · signed = versiegelt */
  status: z.enum(['draft', 'signing', 'signed']).default('draft'),
  createdAt: z.string(),
  updatedAt: z.string(),
  inspector: z.string().max(200).default(''),
  property: Property,
  features: Features,
  landlord: Party,
  tenants: z.array(Party).min(1),
  rooms: z.array(Room),
  meters: z.array(Meter).default([]),
  keys: z.array(KeyItem).default([]),
  generalNote: z.string().max(4000).default(''),
  signatures: z.array(Signature).default([]),
  seal: Seal.nullable().default(null),
  /** Zeitpunkt des ersten Teilens (Versand). Startet die Löschfrist (config.retentionDays). */
  sharedAt: z.string().nullable().default(null),
});
export type Protocol = z.infer<typeof Protocol>;

export const PhotoRecord = z.object({
  id: z.string(),
  protocolId: z.string(),
  blob: z.instanceof(Blob),
  width: z.number(),
  height: z.number(),
  createdAt: z.string(),
});
export type PhotoRecord = z.infer<typeof PhotoRecord>;

/** Gerätebezogene Einstellungen (kein Server: gelten nur auf diesem Gerät). */
export const Settings = z.object({
  id: z.literal('device'),
  customPhrases: z.array(z.string().min(1).max(80)).max(100).default([]),
  inspectorName: z.string().max(200).default(''),
  /** iOS-Hinweis „Zum Home-Bildschirm“. Default, damit alte Geräte ohne Schemaversion lesbar bleiben. */
  dismissedIosInstallHint: z.boolean().default(false),
});
export type Settings = z.infer<typeof Settings>;
