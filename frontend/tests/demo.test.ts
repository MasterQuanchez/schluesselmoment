import { describe, expect, it } from 'vitest';
import { createDemoProtocol } from '@/domain/demo';
import { completeRoom, protocolIssues, updateDefect } from '@/domain/protocol';
import { Protocol } from '@/domain/schema';

describe('Demo-Protokoll', () => {
  it('ist gültig, schließt alle Räume außer der Küche ab und wird mit zwei Fotos vollständig', () => {
    const p = createDemoProtocol(new Date('2026-10-22T12:00:00Z'));
    expect(Protocol.safeParse(p).success).toBe(true);
    expect(p.type).toBe('abnahme');
    expect(p.status).toBe('draft');
    expect(p.inspector).toBe('Demo');

    const kitchen = p.rooms.find((r) => r.id === 'kitchen');
    if (!kitchen) throw new Error('Küche fehlt');
    expect(kitchen.completedAt).toBeNull();
    for (const room of p.rooms) {
      if (room.id !== 'kitchen') expect(room.completedAt).toBeTruthy();
    }

    const defects = Object.entries(kitchen.checks).filter(([, state]) => state === 'defect');
    expect(defects).toEqual([['oven', 'defect']]);
    expect(kitchen.defects.oven?.description).toBe('Backofen verschmutzt, eingebrannte Fettreste');
    expect(kitchen.defects.oven?.photoIds).toEqual([]);

    const withPhotos = updateDefect(kitchen, 'oven', { photoIds: ['foto-1', 'foto-2'] });
    const done = completeRoom(withPhotos, new Date('2026-10-22T12:05:00Z'));
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const next = { ...p, rooms: p.rooms.map((r) => (r.id === 'kitchen' ? done.room : r)) };
    expect(protocolIssues(next)).toEqual([]);
  });
});
