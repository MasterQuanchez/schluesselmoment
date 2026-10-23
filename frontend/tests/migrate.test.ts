import { describe, expect, it } from 'vitest';
import { createProtocol } from '@/domain/protocol';
import { Protocol } from '@/domain/schema';
import { migrateProtocol } from '@/storage/migrate';

describe('Migration Schema 3', () => {
  it('übernimmt das Übergabe-Datum aus createdAt und setzt noEmail', () => {
    const fresh = createProtocol('uebergabe', new Date('2026-03-05T22:30:00.000Z'));
    const landlord = { ...fresh.landlord };
    delete (landlord as { noEmail?: boolean }).noEmail;
    const old: Record<string, unknown> = { ...fresh, schemaVersion: 1, landlord };
    delete old.handoverOn;
    delete old.moveInOn;
    delete old.moveOutOn;
    const migrated = migrateProtocol(old);
    const parsed = Protocol.parse(migrated);
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.handoverOn).toBe('2026-03-05');
    expect(parsed.moveInOn).toBe('');
    expect(parsed.moveOutOn).toBe('');
    expect(parsed.landlord.noEmail).toBe(false);
  });

  it('macht aus false bei der Ausstattung eine offene Antwort, true und Zahlen bleiben', () => {
    const fresh = createProtocol('abnahme', new Date('2026-10-23T08:00:00.000Z'));
    const old = {
      ...fresh,
      schemaVersion: 2,
      rooms: fresh.rooms.map((room) =>
        room.id === 'bath' ? { ...room, inventory: { washbasin: true, mirror: false, spots: 2 } } : room,
      ),
    };
    const parsed = Protocol.parse(migrateProtocol(old));
    const bath = parsed.rooms.find((room) => room.id === 'bath');
    expect(bath?.inventory.washbasin).toBe(true);
    expect(bath?.inventory.mirror).toBeNull();
    expect(bath?.inventory.spots).toBe(2);
  });

  it('lässt ein aktuelles Protokoll unverändert', () => {
    const fresh = createProtocol('abnahme', new Date('2026-10-23T08:00:00.000Z'));
    expect(migrateProtocol(fresh)).toBe(fresh);
  });
});
