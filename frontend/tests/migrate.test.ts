import { describe, expect, it } from 'vitest';
import { createProtocol } from '@/domain/protocol';
import { Protocol } from '@/domain/schema';
import { migrateProtocol } from '@/storage/migrate';

describe('Migration Schema 2', () => {
  it('übernimmt das Übergabe-Datum aus createdAt', () => {
    const fresh = createProtocol('uebergabe', new Date('2026-03-05T22:30:00.000Z'));
    const old: Record<string, unknown> = { ...fresh, schemaVersion: 1 };
    delete old.handoverOn;
    delete old.moveInOn;
    delete old.moveOutOn;
    const migrated = migrateProtocol(old);
    const parsed = Protocol.parse(migrated);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.handoverOn).toBe('2026-03-05');
    expect(parsed.moveInOn).toBe('');
    expect(parsed.moveOutOn).toBe('');
  });

  it('lässt ein aktuelles Protokoll unverändert', () => {
    const fresh = createProtocol('abnahme', new Date('2026-10-23T08:00:00.000Z'));
    expect(migrateProtocol(fresh)).toBe(fresh);
  });
});
