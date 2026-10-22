/**
 * Fachkatalog – abgeleitet aus dem Word-Protokoll (2021) und den Sprachnachrichten (Nov./Dez. 2025).
 * Reine Daten: Prüfpunkte, Attribute, Raumvorlagen, Ausstattung, Schnellauswahl-Begriffe.
 * Neue Punkte hier ergänzen – UI und PDF lesen ausschließlich aus diesem Katalog.
 */

export interface AttributeDef {
  id: string;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
}

export interface CheckDef {
  id: string;
  label: string;
  /** 'part' = Bauteil (Wände, Boden …), 'function' = Prüfung (Sauberkeit, Backofen …) */
  kind: 'part' | 'function';
  icon: IconName;
  /** Kurze Hilfe für Laien („Anna-sicher“) */
  hint?: string;
  attributes?: ReadonlyArray<AttributeDef>;
}

export interface InventoryDef {
  id: string;
  label: string;
  type: 'bool' | 'count';
}

export interface RoomTemplate {
  id: string;
  label: string;
  checks: ReadonlyArray<string>;
  inventory?: ReadonlyArray<string>;
  /** Schnellauswahl-Gruppen, die zusätzlich zu den allgemeinen Begriffen erscheinen */
  phraseGroups?: ReadonlyArray<string>;
}

export type IconName =
  | 'wall'
  | 'floor'
  | 'ceiling'
  | 'window'
  | 'door'
  | 'radiator'
  | 'tiles'
  | 'socket'
  | 'light'
  | 'water'
  | 'sparkle'
  | 'oven'
  | 'fridge'
  | 'shower'
  | 'box'
  | 'bell'
  | 'mail'
  | 'smoke'
  | 'fence'
  | 'info';

const paint: AttributeDef = {
  id: 'paint',
  label: 'Anstrich',
  options: [
    { id: 'new', label: 'Neu' },
    { id: 'old', label: 'Alt' },
  ],
};
const surface: AttributeDef = {
  id: 'surface',
  label: 'Oberfläche',
  options: [
    { id: 'plaster', label: 'Putz' },
    { id: 'wallpaper', label: 'Tapete' },
    { id: 'smooth', label: 'Glattputz' },
    { id: 'tiles', label: 'Fliesen' },
  ],
};

export const CHECKS: Record<string, CheckDef> = {
  walls: { id: 'walls', label: 'Wände', kind: 'part', icon: 'wall', attributes: [paint, surface] },
  ceiling: { id: 'ceiling', label: 'Decke', kind: 'part', icon: 'ceiling', attributes: [paint, surface] },
  floor: {
    id: 'floor',
    label: 'Boden',
    kind: 'part',
    icon: 'floor',
    attributes: [
      {
        id: 'type',
        label: 'Belag',
        options: [
          { id: 'pvc', label: 'PVC' },
          { id: 'tiles', label: 'Fliesen' },
          { id: 'laminate', label: 'Laminat' },
          { id: 'parquet', label: 'Parkett' },
          { id: 'planks', label: 'Holzdielen' },
          { id: 'carpet', label: 'Teppich' },
        ],
      },
    ],
  },
  windows: {
    id: 'windows',
    label: 'Fenster',
    kind: 'part',
    icon: 'window',
    hint: 'Öffnen, schließen, kippen. Rollladen hoch und runter.',
    attributes: [
      {
        id: 'glass',
        label: 'Verglasung',
        options: [
          { id: 'single', label: 'Einfach' },
          { id: 'double', label: 'Doppelt' },
          { id: 'triple', label: 'Dreifach' },
        ],
      },
      {
        id: 'material',
        label: 'Material',
        options: [
          { id: 'plastic', label: 'Kunststoff' },
          { id: 'wood', label: 'Holz' },
          { id: 'alu', label: 'Aluminium' },
        ],
      },
      {
        id: 'shutter',
        label: 'Rollladen',
        options: [
          { id: 'yes', label: 'Ja' },
          { id: 'no', label: 'Nein' },
        ],
      },
      paint,
    ],
  },
  door: { id: 'door', label: 'Tür/Rahmen', kind: 'part', icon: 'door', attributes: [paint] },
  radiator: {
    id: 'radiator',
    label: 'Heizkörper',
    kind: 'part',
    icon: 'radiator',
    attributes: [
      paint,
      {
        id: 'kind',
        label: 'Art',
        options: [
          { id: 'normal', label: 'Normal' },
          { id: 'towel', label: 'Handtuch' },
          { id: 'electric', label: 'Elektro' },
        ],
      },
    ],
  },
  tileSplash: { id: 'tileSplash', label: 'Fliesenspiegel', kind: 'part', icon: 'tiles' },
  sockets: {
    id: 'sockets',
    label: 'Steckdosen/Schalter',
    kind: 'part',
    icon: 'socket',
    hint: 'Abdeckungen vollständig? Keine Bohrlöcher daneben?',
  },
  balustrade: { id: 'balustrade', label: 'Brüstung', kind: 'part', icon: 'fence', attributes: [paint] },
  // Funktionsprüfungen
  clean: { id: 'clean', label: 'Sauberkeit', kind: 'function', icon: 'sparkle' },
  mold: {
    id: 'mold',
    label: 'Stockflecken',
    kind: 'function',
    icon: 'water',
    hint: 'Ecken, Fensterlaibung, hinter Möbeln.',
  },
  silicone: { id: 'silicone', label: 'Silikonfugen', kind: 'function', icon: 'water' },
  limescale: { id: 'limescale', label: 'Kalk Duschfliesen', kind: 'function', icon: 'shower' },
  faucets: { id: 'faucets', label: 'Wasserhähne', kind: 'function', icon: 'water' },
  showerHead: {
    id: 'showerHead',
    label: 'Duschkopf',
    kind: 'function',
    icon: 'shower',
    hint: 'Verkalkt? Haare im Abfluss?',
  },
  lights: { id: 'lights', label: 'Lichter', kind: 'function', icon: 'light' },
  oven: {
    id: 'oven',
    label: 'Backofen innen',
    kind: 'function',
    icon: 'oven',
    hint: 'Tür öffnen und hineinschauen.',
  },
  fridge: {
    id: 'fridge',
    label: 'Kühlschrank aus & offen',
    kind: 'function',
    icon: 'fridge',
    hint: 'Sauber, ausgeschaltet, Tür offen (sonst Schimmel).',
  },
  intercom: { id: 'intercom', label: 'Sprechanlage', kind: 'function', icon: 'bell' },
  outdoorLight: { id: 'outdoorLight', label: 'Außenlampe', kind: 'function', icon: 'light' },
  mailboxLabel: { id: 'mailboxLabel', label: 'Briefkasten beschriftet', kind: 'function', icon: 'mail' },
  basementLabel: { id: 'basementLabel', label: 'Kellerabteil beschriftet', kind: 'function', icon: 'box' },
  // Abschluss-Prüfungen (Pflicht laut Word-Protokoll)
  noTenantItems: {
    id: 'noTenantItems',
    label: 'Keine Restgegenstände',
    kind: 'function',
    icon: 'box',
    hint: 'Putzzeug, Duschvorhang, Rollos, Regale, Lampen, Vorhangstangen, angebohrte Halter.',
  },
  boilerHose: { id: 'boilerHose', label: 'Therme: Füllschlauch da', kind: 'function', icon: 'water' },
  serviceInvoice: { id: 'serviceInvoice', label: 'Wartungsrechnung 12 Mon.', kind: 'function', icon: 'box' },
  commonAreas: {
    id: 'commonAreas',
    label: 'Gemeinschaftsflächen frei',
    kind: 'function',
    icon: 'box',
    hint: 'Treppenhaus, Dachboden, Kellerflure, Hof: kein Sperrmüll des Mieters.',
  },
  smokeDetectors: { id: 'smokeDetectors', label: 'Rauchwarnmelder', kind: 'function', icon: 'smoke' },
};

export const INVENTORY: Record<string, InventoryDef> = {
  oven: { id: 'oven', label: 'Backofen', type: 'bool' },
  hob: { id: 'hob', label: 'Ceranfeld', type: 'bool' },
  stove: { id: 'stove', label: 'Herd', type: 'bool' },
  fridge: { id: 'fridge', label: 'Kühlschrank', type: 'bool' },
  freezer: { id: 'freezer', label: 'Gefrierschrank', type: 'bool' },
  microwave: { id: 'microwave', label: 'Mikrowelle', type: 'bool' },
  hood: { id: 'hood', label: 'Dunstabzug', type: 'bool' },
  sink: { id: 'sink', label: 'Spüle', type: 'bool' },
  dishwasher: { id: 'dishwasher', label: 'Spülmaschine', type: 'bool' },
  counter: { id: 'counter', label: 'Theke', type: 'bool' },
  bakingTray: { id: 'bakingTray', label: 'Backblech', type: 'count' },
  boiler: { id: 'boiler', label: 'Boiler', type: 'bool' },
  upperCabinets: { id: 'upperCabinets', label: 'Oberschränke', type: 'count' },
  lowerCabinets: { id: 'lowerCabinets', label: 'Unterschränke', type: 'count' },
  washbasin: { id: 'washbasin', label: 'Waschbecken', type: 'count' },
  shower: { id: 'shower', label: 'Dusche', type: 'bool' },
  showerScreen: { id: 'showerScreen', label: 'Duschabtrennung/Stange', type: 'bool' },
  bathtub: { id: 'bathtub', label: 'Badewanne', type: 'bool' },
  toilet: { id: 'toilet', label: 'WC', type: 'bool' },
  mirror: { id: 'mirror', label: 'Spiegel', type: 'bool' },
  towelHook: { id: 'towelHook', label: 'Handtuchhaken', type: 'count' },
  towelRail: { id: 'towelRail', label: 'Handtuchhalter', type: 'count' },
  glassShelf: { id: 'glassShelf', label: 'Glasablage', type: 'bool' },
  paperHolder: { id: 'paperHolder', label: 'Klopapierhalter', type: 'bool' },
  spots: { id: 'spots', label: 'Lampen/Spots', type: 'count' },
  bulbSockets: { id: 'bulbSockets', label: 'Baufassungen', type: 'count' },
  smokeDetectorCount: { id: 'smokeDetectorCount', label: 'Rauchwarnmelder', type: 'count' },
};

const ROOM_PARTS = ['walls', 'ceiling', 'floor', 'windows', 'door', 'radiator', 'sockets'] as const;

export const ROOM_TEMPLATES: Record<string, RoomTemplate> = {
  hallway: { id: 'hallway', label: 'Flur', checks: [...ROOM_PARTS, 'lights'] },
  kitchenBasic: {
    id: 'kitchenBasic',
    label: 'Küche',
    checks: [...ROOM_PARTS, 'tileSplash', 'clean', 'mold', 'faucets', 'lights'],
    phraseGroups: ['kitchen'],
  },
  kitchenFitted: {
    id: 'kitchenFitted',
    label: 'Küche (Einbauküche)',
    checks: [...ROOM_PARTS, 'tileSplash', 'clean', 'mold', 'silicone', 'faucets', 'lights', 'oven', 'fridge'],
    inventory: [
      'oven',
      'hob',
      'stove',
      'fridge',
      'freezer',
      'microwave',
      'hood',
      'sink',
      'dishwasher',
      'counter',
      'bakingTray',
      'boiler',
      'upperCabinets',
      'lowerCabinets',
    ],
    phraseGroups: ['kitchen'],
  },
  bathroom: {
    id: 'bathroom',
    label: 'Bad',
    checks: [
      'walls',
      'ceiling',
      'floor',
      'windows',
      'door',
      'radiator',
      'tileSplash',
      'clean',
      'mold',
      'limescale',
      'silicone',
      'faucets',
      'showerHead',
      'lights',
    ],
    inventory: [
      'washbasin',
      'shower',
      'showerScreen',
      'bathtub',
      'toilet',
      'mirror',
      'towelHook',
      'towelRail',
      'glassShelf',
      'paperHolder',
      'spots',
    ],
    phraseGroups: ['bath'],
  },
  guestWc: {
    id: 'guestWc',
    label: 'Gäste-WC',
    checks: [
      'walls',
      'ceiling',
      'floor',
      'windows',
      'door',
      'radiator',
      'tileSplash',
      'clean',
      'mold',
      'silicone',
      'faucets',
      'lights',
    ],
    inventory: ['washbasin', 'toilet', 'mirror', 'towelHook', 'paperHolder', 'spots'],
    phraseGroups: ['bath'],
  },
  room: { id: 'room', label: 'Zimmer', checks: [...ROOM_PARTS] },
  // Balkon/Terrasse: keine Fenster, keine Türrahmen, keine Heizkörper (Sprachnachricht 01.12.2025)
  outdoor: {
    id: 'outdoor',
    label: 'Balkon/Terrasse',
    checks: ['walls', 'ceiling', 'floor', 'balustrade', 'outdoorLight', 'clean'],
  },
  // Wintergarten ist innen: mit Fenstern und ggf. Heizkörper
  wintergarden: {
    id: 'wintergarden',
    label: 'Wintergarten',
    checks: ['walls', 'ceiling', 'floor', 'windows', 'door', 'radiator', 'clean'],
  },
  basement: { id: 'basement', label: 'Keller', checks: ['walls', 'floor', 'door', 'clean', 'basementLabel'] },
  entrance: {
    id: 'entrance',
    label: 'Eingangstür & Briefkasten',
    checks: ['door', 'intercom', 'mailboxLabel'],
  },
  final: {
    id: 'final',
    label: 'Abschluss-Prüfungen',
    checks: ['noTenantItems', 'boilerHose', 'serviceInvoice', 'smokeDetectors', 'commonAreas'],
    inventory: ['bulbSockets', 'smokeDetectorCount'],
  },
};

/**
 * Schnellauswahl: ein Tipp hängt den Begriff an die Notiz an (frei editierbar).
 * Gruppe 'general' erscheint überall.
 */
export const PHRASES: Record<string, ReadonlyArray<string>> = {
  general: [
    'Besenrein',
    'Fachgerecht renoviert',
    'Normale Abnutzung',
    'Starke Abnutzungserscheinungen',
    'Kratzer im Boden',
    'Dübellöcher',
    'Starker Geruch',
    'Feuchtigkeitsschäden',
    'Schimmelbefall',
    'Nikotinverfärbung',
    'Nicht fachgerecht gestrichen',
    'Lampen des Mieters noch montiert',
    'Vorhangstangen noch montiert',
  ],
  kitchen: [
    'Backofen verschmutzt',
    'Kühlschrank verschmutzt',
    'Fettfilm an Dunstabzug',
    'Arbeitsplatte beschädigt',
  ],
  bath: ['Fugen verfärbt', 'Duschkopf verkalkt', 'Haare im Abfluss', 'Silikon erneuern'],
};

export const PROTOCOL_TYPE_LABEL = {
  uebergabe: 'Übergabe (Einzug)',
  abnahme: 'Abnahme (Auszug)',
  bestandsaufnahme: 'Bestandsaufnahme',
} as const;

export const METER_LABEL = {
  electricity: { label: 'Strom', unit: 'kWh' },
  gas: { label: 'Gas', unit: 'm³' },
  water_cold: { label: 'Kaltwasser', unit: 'm³' },
  water_hot: { label: 'Warmwasser', unit: 'm³' },
  heat: { label: 'Wärme', unit: 'kWh' },
  hca: { label: 'Heizkostenverteiler', unit: 'Einh.' },
} as const;

export const KEY_LABEL = {
  apartment: 'Wohnungstür',
  building: 'Haustür',
  basement: 'Keller',
  mailbox: 'Briefkasten',
  room: 'Zimmertür',
  other: 'Sonstiger',
} as const;

/** Geschäftsregeln an einer Stelle – leicht änderbar, testbar */
export const RULES = {
  /** Sprachnachricht 30.11.2025: „Minimum zwei Bilder“ bei Schaden */
  minPhotosPerDefect: 2,
  /** Mangel braucht eine Beschreibung */
  defectNeedsDescription: true,
  maxPhotoEdgePx: 1600,
  photoJpegQuality: 0.8,
} as const;
