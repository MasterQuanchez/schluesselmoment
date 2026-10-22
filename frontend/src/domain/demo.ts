/**
 * Fertiges Beispielprotokoll für Vorführung und Test von Unterschrift und PDF.
 * Reine Fachlogik: Fotos setzt die Oberfläche, danach wird die Küche abgeschlossen.
 */
import { CONDITION_PHRASES } from './catalog';
import {
  appendPhrase,
  applyFeatures,
  completeRoom,
  confirmAllChecks,
  createProtocol,
  markNoDefects,
  newId,
  setCheck,
  setDetail,
  updateDefect,
} from './protocol';
import { Features, Protocol, type Room } from './schema';

const DEMO_NOTE = 'DEMO – kein echtes Protokoll';
const OVEN_DEFECT = 'Backofen verschmutzt, eingebrannte Fettreste';

function withDetails(room: Room): Room {
  let next = room;
  if ('walls' in next.checks) next = setDetail(next, 'walls', 'paint', 'new');
  if ('floor' in next.checks) next = setDetail(next, 'floor', 'type', 'parquet');
  if ('ceiling' in next.checks) next = setDetail(next, 'ceiling', 'paint', 'new');
  else if ('door' in next.checks) next = setDetail(next, 'door', 'paint', 'new');
  return next;
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
  let next = withPhrase(withDetails(confirmAllChecks(room)));
  if (room.id === 'kitchen') {
    next = {
      ...next,
      inventory: { ...next.inventory, oven: true, hob: true, fridge: true, sink: true, hood: true },
    };
    next = updateDefect(setCheck(next, 'oven', 'defect'), 'oven', { description: OVEN_DEFECT });
    return next;
  }
  if (room.templateId === 'bathroom') {
    next = { ...next, inventory: { ...next.inventory, washbasin: 1 } };
  }
  const marked = markNoDefects(next);
  const done = completeRoom(marked.ok ? marked.room : next, now);
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
    },
    landlord: {
      name: 'Hausverwaltung Muster GmbH',
      phone: '',
      email: 'verwaltung@example.org',
      newAddress: '',
    },
    tenants: [{ name: 'Anna Muster', phone: '', email: 'anna@example.org', newAddress: '' }],
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
