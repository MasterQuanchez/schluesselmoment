/**
 * Hebt gespeicherte Protokolle auf die aktuelle Schemaversion.
 * Version 1 hat kein Übergabe-Datum: es wird der Kalendertag von `createdAt` (die ersten 10 Zeichen).
 */
import { SCHEMA_VERSION } from '@/domain/schema';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function datePrefix(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const head = value.slice(0, 10);
  return DATE.test(head) ? head : null;
}

export function migrateProtocol(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const protocol = raw as Record<string, unknown>;
  const version = typeof protocol.schemaVersion === 'number' ? protocol.schemaVersion : 1;
  if (version >= SCHEMA_VERSION) return raw;
  return {
    ...protocol,
    schemaVersion: SCHEMA_VERSION,
    handoverOn: datePrefix(protocol.createdAt) ?? datePrefix(protocol.handoverOn) ?? '1970-01-01',
    moveInOn: typeof protocol.moveInOn === 'string' ? protocol.moveInOn : '',
    moveOutOn: typeof protocol.moveOutOn === 'string' ? protocol.moveOutOn : '',
  };
}
