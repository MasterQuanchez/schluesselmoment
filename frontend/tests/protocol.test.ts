import { describe, expect, it } from 'vitest';
import { ROOM_TEMPLATES, RULES } from '@/domain/catalog';
import {
  addSignature,
  allSigned,
  appendPhrase,
  applyFeatures,
  backToDraft,
  buildRooms,
  canonicalJson,
  completeRoom,
  computeSealHash,
  confirmAllChecks,
  createProtocol,
  cycleCheck,
  deletionDate,
  isExpired,
  mailRecipients,
  markNoDefects,
  protocolIssues,
  requiredSigners,
  sealProtocol,
  setDetail,
  startSigning,
  updateDefect,
} from '@/domain/protocol';
import { Features, Protocol } from '@/domain/schema';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function filled(): Protocol {
  let p = createProtocol('uebergabe', new Date('2026-10-22T10:00:00Z'));
  p = {
    ...p,
    property: { ...p.property, street: 'Musterstraße 1', city: 'Stuttgart' },
    landlord: { ...p.landlord, name: 'Verwaltung' },
    tenants: [{ name: 'Anna Muster', phone: '', email: '', newAddress: '' }],
  };
  const rooms = p.rooms.map((r) => {
    const done = completeRoom(confirmAllChecks(r));
    if (!done.ok) throw new Error(done.reason);
    return done.room;
  });
  return { ...p, rooms };
}

describe('Raumliste aus Ausstattung', () => {
  it('Standard: Flur, Küche, Bad, 2 Zimmer, Eingang, Abschluss', () => {
    const rooms = buildRooms(Features.parse({}));
    expect(rooms.map((r) => r.id)).toEqual([
      'hallway',
      'kitchen',
      'bath',
      'room-1',
      'room-2',
      'entrance',
      'final',
    ]);
  });

  it('Balkon hat keine Fenster, Türrahmen oder Heizkörper', () => {
    const rooms = buildRooms(Features.parse({ outdoor: 'balcony' }));
    const balcony = rooms.find((r) => r.id === 'outdoor');
    expect(balcony?.label).toBe('Balkon');
    expect(Object.keys(balcony?.checks ?? {})).not.toContain('windows');
    expect(Object.keys(balcony?.checks ?? {})).not.toContain('radiator');
    expect(Object.keys(balcony?.checks ?? {})).not.toContain('door');
  });

  it('Einbauküche fragt Backofen und Kühlschrank ab', () => {
    const rooms = buildRooms(Features.parse({ kitchen: 'fitted' }));
    const k = rooms.find((r) => r.id === 'kitchen');
    expect(Object.keys(k?.checks ?? {})).toContain('oven');
    expect(Object.keys(k?.checks ?? {})).toContain('fridge');
    expect(Object.keys(k?.inventory ?? {}).length).toBeGreaterThan(5);
  });

  it('Ausstattung ändern behält erfasste Räume', () => {
    const p = createProtocol('abnahme');
    const room1 = p.rooms.find((r) => r.id === 'room-1');
    if (!room1) throw new Error('room-1 fehlt');
    const touched = { ...p, rooms: p.rooms.map((r) => (r.id === 'room-1' ? { ...r, note: 'Kratzer' } : r)) };
    const next = applyFeatures(touched, { ...p.features, roomCount: 4 });
    expect(next.rooms.find((r) => r.id === 'room-1')?.note).toBe('Kratzer');
    expect(next.rooms.filter((r) => r.templateId === 'room')).toHaveLength(4);
  });

  it('alle Vorlagen verweisen nur auf bekannte Prüfpunkte', () => {
    for (const t of Object.values(ROOM_TEMPLATES)) expect(t.checks.length).toBeGreaterThan(0);
  });
});

describe('Schnellerfassung', () => {
  const room = () => {
    const r = buildRooms(Features.parse({}))[0];
    if (!r) throw new Error('kein Raum');
    return r;
  };

  it('Chip-Zyklus: offen → OK → Mangel → offen', () => {
    let r = room();
    r = cycleCheck(r, 'walls');
    expect(r.checks.walls).toBe('ok');
    r = cycleCheck(r, 'walls');
    expect(r.checks.walls).toBe('defect');
    expect(r.decision).toBe('defects');
    expect(r.defects.walls).toBeTruthy();
    r = cycleCheck(r, 'walls');
    expect(r.checks.walls).toBe('open');
  });

  it('Keine Mängel setzt nur die Entscheidung – jeder Punkt bleibt einzeln zu bestätigen', () => {
    const res = markNoDefects(room());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.decision).toBe('noDefects');
    expect(Object.values(res.room.checks).every((s) => s === 'open')).toBe(true);
    expect(completeRoom(res.room).ok).toBe(false);
  });

  it('Keine Mängel ist gesperrt, solange ein Mangel markiert ist', () => {
    const r = cycleCheck(cycleCheck(room(), 'floor'), 'floor');
    expect(markNoDefects(r).ok).toBe(false);
  });

  it('Detail an einem offenen Element setzt nur dieses auf OK', () => {
    const r = room();
    const next = setDetail(r, 'ceiling', 'paint', 'new');
    expect(next.checks.ceiling).toBe('ok');
    expect(next.details.ceiling?.paint).toBe('new');
    expect(Object.entries(next.checks).filter(([id, s]) => id !== 'ceiling' && s !== 'open')).toHaveLength(0);
  });

  it('Detail an einem Mangel lässt den Mangel stehen', () => {
    const defect = cycleCheck(cycleCheck(room(), 'floor'), 'floor');
    const next = setDetail(defect, 'floor', 'type', 'parquet');
    expect(next.checks.floor).toBe('defect');
    expect(next.details.floor?.type).toBe('parquet');
  });

  it('Detail entfernen ändert den Status nicht', () => {
    const marked = setDetail(room(), 'ceiling', 'paint', 'new');
    const cleared = setDetail(marked, 'ceiling', 'paint', 'new');
    expect(cleared.checks.ceiling).toBe('ok');
    expect(cleared.details.ceiling?.paint).toBeUndefined();
  });

  it('Mangel braucht Beschreibung und Mindestanzahl Fotos', () => {
    let x = cycleCheck(confirmAllChecks(room()), 'floor'); // ok → defect
    expect(completeRoom(x).ok).toBe(false);
    x = updateDefect(x, 'floor', { description: 'Kratzer im Parkett', photoIds: ['a'] });
    expect(completeRoom(x).ok).toBe(RULES.minPhotosPerDefect <= 1);
    x = updateDefect(x, 'floor', { photoIds: ['a', 'b'] });
    expect(completeRoom(x).ok).toBe(true);
  });

  it('Schnellauswahl hängt an und vermeidet Doppelungen', () => {
    expect(appendPhrase('', 'Besenrein')).toBe('Besenrein');
    expect(appendPhrase('Besenrein', 'Normale Abnutzung')).toBe('Besenrein, Normale Abnutzung');
    expect(appendPhrase('Alles gut.', 'Besenrein')).toBe('Alles gut. Besenrein');
    expect(appendPhrase('Besenrein', 'besenrein')).toBe('Besenrein');
  });
});

describe('Unterschrift & Versiegelung', () => {
  it('festschreiben nur ohne offene Punkte', () => {
    expect(startSigning(createProtocol('uebergabe')).ok).toBe(false);
    const p = filled();
    expect(protocolIssues(p)).toEqual([]);
    expect(startSigning(p).ok).toBe(true);
  });

  it('versiegeln erst nach allen Unterschriften; Hash ist stabil und reagiert auf Änderungen', async () => {
    const s = startSigning(filled());
    if (!s.ok) throw new Error(s.reason);
    let p = s.protocol;
    expect(requiredSigners(p)).toHaveLength(2);
    expect((await sealProtocol(p, {})).ok).toBe(false);
    for (const signer of requiredSigners(p))
      p = addSignature(p, signer, PNG, new Date('2026-10-22T11:00:00Z'));
    expect(allSigned(p)).toBe(true);
    const sealed = await sealProtocol(p, { a: 'x' });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.protocol.seal?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeSealHash(sealed.protocol, { a: 'x' })).toBe(sealed.protocol.seal?.hash);
    const tampered = { ...sealed.protocol, generalNote: 'nachträglich' };
    expect(await computeSealHash(tampered, { a: 'x' })).not.toBe(sealed.protocol.seal?.hash);
    expect(await computeSealHash(sealed.protocol, { a: 'y' })).not.toBe(sealed.protocol.seal?.hash);
    expect(Protocol.safeParse(sealed.protocol).success).toBe(true);
  });

  it('zurück zur Bearbeitung verwirft Unterschriften', () => {
    const s = startSigning(filled());
    if (!s.ok) throw new Error();
    const signer = requiredSigners(s.protocol)[0];
    if (!signer) throw new Error();
    const p = addSignature(s.protocol, signer, PNG);
    const d = backToDraft(p);
    expect(d.status).toBe('draft');
    expect(d.signatures).toHaveLength(0);
  });

  it('canonicalJson sortiert Schlüssel', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});

describe('Versand & Aufbewahrung', () => {
  it('Empfänger: gültige, eindeutige Adressen inkl. fester Kopie', () => {
    const p = createProtocol('uebergabe');
    const q = {
      ...p,
      landlord: { ...p.landlord, email: 'verwaltung@example.org' },
      tenants: [
        { name: 'A', phone: '', email: 'A@Example.org ', newAddress: '' },
        { name: 'B', phone: '', email: 'kaputt', newAddress: '' },
      ],
    };
    expect(mailRecipients(q, 'objekte@example.org')).toEqual([
      'a@example.org',
      'verwaltung@example.org',
      'objekte@example.org',
    ]);
  });

  it('Löschfrist läuft erst ab Versand eines versiegelten Protokolls', () => {
    const p = createProtocol('uebergabe');
    expect(deletionDate(p, 30)).toBe(null);
    const sent = { ...p, status: 'signed' as const, sharedAt: '2026-10-01T10:00:00.000Z' };
    expect(deletionDate(sent, 30)?.toISOString()).toBe('2026-10-31T10:00:00.000Z');
    expect(isExpired(sent, 30, new Date('2026-10-30T00:00:00Z'))).toBe(false);
    expect(isExpired(sent, 30, new Date('2026-11-01T00:00:00Z'))).toBe(true);
  });
});
