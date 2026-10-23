/**
 * Hebt gespeicherte Protokolle auf die aktuelle Schemaversion.
 * Version 1 hat kein Übergabe-Datum: es wird der Kalendertag von `createdAt` (die ersten 10 Zeichen).
 * Version 2: Ausstattung false wird offen (null), true und Zahlen bleiben. Parteien bekommen noEmail false.
 */
import { SCHEMA_VERSION } from '@/domain/schema';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function datePrefix(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const head = value.slice(0, 10);
  return DATE.test(head) ? head : null;
}

function withNoEmail(party: unknown): unknown {
  if (!party || typeof party !== 'object') return party;
  const value = party as Record<string, unknown>;
  return { ...value, noEmail: typeof value.noEmail === 'boolean' ? value.noEmail : false };
}

function migrateInventory(inventory: unknown): unknown {
  if (!inventory || typeof inventory !== 'object') return inventory;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inventory as Record<string, unknown>)) {
    next[key] = value === false ? null : value;
  }
  return next;
}

export function migrateProtocol(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const protocol = raw as Record<string, unknown>;
  const version = typeof protocol.schemaVersion === 'number' ? protocol.schemaVersion : 1;
  if (version >= SCHEMA_VERSION) return raw;
  const next: Record<string, unknown> = { ...protocol, schemaVersion: SCHEMA_VERSION };
  if (version < 2) {
    next.handoverOn = datePrefix(protocol.createdAt) ?? datePrefix(protocol.handoverOn) ?? '1970-01-01';
    next.moveInOn = typeof protocol.moveInOn === 'string' ? protocol.moveInOn : '';
    next.moveOutOn = typeof protocol.moveOutOn === 'string' ? protocol.moveOutOn : '';
  }
  if (version < 3) {
    next.landlord = withNoEmail(protocol.landlord);
    next.tenants = Array.isArray(protocol.tenants) ? protocol.tenants.map(withNoEmail) : protocol.tenants;
    next.rooms = Array.isArray(protocol.rooms)
      ? protocol.rooms.map((room) => {
          if (!room || typeof room !== 'object') return room;
          const value = room as Record<string, unknown>;
          return { ...value, inventory: migrateInventory(value.inventory) };
        })
      : protocol.rooms;
  }
  return next;
}
