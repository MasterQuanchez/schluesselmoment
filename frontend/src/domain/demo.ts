/**
 * Fertiges Beispielprotokoll für Vorführung und Test von Unterschrift und PDF.
 * Reine Fachlogik: Fotos setzt die Oberfläche, danach wird die Küche abgeschlossen.
 */
import { CHECKS, CONDITION_PHRASES, INVENTORY } from './catalog';
import {
  appendPhrase,
  applyFeatures,
  completeRoom,
  confirmAllChecks,
  createProtocol,
  getTemplate,
  newId,
  setCheck,
  setDetail,
  updateDefect,
} from './protocol';
import { Features, Protocol, type Room } from './schema';

const DEMO_NOTE = 'DEMO – kein echtes Protokoll';
const OVEN_DEFECT = 'Backofen verschmutzt, eingebrannte Fettreste';

function withDetails(room: Room): Room {
  let next = confirmAllChecks(room);
  for (const [id, state] of Object.entries(next.checks)) {
    if (state !== 'ok' && state !== 'defect') continue;
    for (const attr of CHECKS[id]?.attributes ?? []) {
      const option = attr.options[0];
      if (option) next = setDetail(next, id, attr.id, option.id);
    }
  }
  return next;
}

function withInventory(room: Room): Room {
  const inventory = { ...room.inventory };
  for (const id of getTemplate(room).inventory ?? []) {
    const item = INVENTORY[id];
    if (!item) continue;
    inventory[id] = item.type === 'count' ? 1 : true;
  }
  return { ...room, inventory };
}

function withPhrase(room: Room): Room {
  const phrase = CONDITION_PHRASES[0];
  return phrase ? { ...room, note: appendPhrase(room.note, phrase) } : room;
}

function keyCount(kind: Protocol['keys'][number]['kind']): number | undefined {
  switch (kind) {
    case 'apartment':
    case 'building':
      return 2;
    case 'basement':
    case 'mailbox':
      return 1;
    default:
      return undefined;
  }
}

function fillRoom(room: Room, now: Date): Room {
  const next = withPhrase(withInventory(withDetails(room)));
  if (room.id === 'kitchen') {
    return updateDefect(setCheck(next, 'oven', 'defect'), 'oven', { description: OVEN_DEFECT });
  }
  const done = completeRoom(next, now);
  if (!done.ok) throw new Error(`${room.label}: ${done.reason}`);
  return done.room;
}

/** Abnahme mit einem offenen Küchen-Mangel (zwei Fotos fehlen noch). */
export function createDemoProtocol(now = new Date()): Protocol {
  const features = Features.parse({
    roomCount: 2,
    kitchen: 'fitted',
    outdoor: 'balcony',
    basement: true,
  });
  const base = applyFeatures(createProtocol('abnahme', now), features);
  return Protocol.parse({
    ...base,
    inspector: 'Demo',
    property: {
      ...base.property,
      street: 'Musterstraße 1',
      postalCode: '70173',
      city: 'Stuttgart',
      unit: '2. OG links',
      objectNumber: '12',
    },
    landlord: {
      name: 'Hausverwaltung Muster GmbH',
      phone: '0711 123456',
      email: 'verwaltung@example.org',
      noEmail: false,
      newAddress: '',
    },
    tenants: [
      {
        name: 'Anna Muster',
        phone: '0711 654321',
        email: 'anna@example.org',
        noEmail: false,
        newAddress: 'Neue Straße 2, 70174 Stuttgart',
      },
    ],
    rooms: base.rooms.map((room) => fillRoom(room, now)),
    meters: [
      {
        id: newId(),
        kind: 'electricity',
        number: 'DEMO-1234',
        reading: '12345,6',
        location: '',
        photoIds: [],
      },
      { id: newId(), kind: 'water_cold', number: 'DEMO-55', reading: '321,0', location: '', photoIds: [] },
    ],
    keys: base.keys.map((key) => {
      const count = keyCount(key.kind);
      return count === undefined ? key : { ...key, count };
    }),
    generalNote: DEMO_NOTE,
    status: 'draft',
  });
}
