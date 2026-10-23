import { describe, expect, it } from 'vitest';
import { CHECKS, DEFECT_PHRASE_PREVIEW, INVENTORY, ROOM_TEMPLATES, RULES } from '@/domain/catalog';
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
  conditionPhrases,
  confirmAllChecks,
  createProtocol,
  cycleCheck,
  defectPhrases,
  deletionDate,
  finishRoomLine,
  getTemplate,
  inventoryGroups,
  isExpired,
  issueLabel,
  localIsoDate,
  mailRecipients,
  markNoDefects,
  missingAttributes,
  missingSignatureLabel,
  parseCount,
  photoCountLabel,
  photoStatusLabel,
  protocolIssues,
  recommendedIssues,
  requiredSigners,
  roomHeadline,
  roomIssues,
  roomStatusLabel,
  sealProtocol,
  setCheck,
  setDetail,
  sheetCloseLabel,
  startSigning,
  stepCount,
  updateDefect,
} from '@/domain/protocol';
import { Features, Protocol, type Room } from '@/domain/schema';
import { href, parse } from '@/router';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function answerRoom(room: Room): Room {
  let next = confirmAllChecks(room);
  for (const [id, state] of Object.entries(next.checks)) {
    if (state !== 'ok' && state !== 'defect') continue;
    for (const attr of CHECKS[id]?.attributes ?? []) {
      const option = attr.options[0];
      if (option) next = setDetail(next, id, attr.id, option.id);
    }
  }
  const inventory = { ...next.inventory };
  for (const id of getTemplate(next).inventory ?? []) {
    const item = INVENTORY[id];
    if (!item) continue;
    inventory[id] = item.type === 'count' ? 1 : true;
  }
  return { ...next, inventory };
}

function filled(): Protocol {
  let p = createProtocol('uebergabe', new Date('2026-10-22T10:00:00Z'));
  p = {
    ...p,
    property: {
      ...p.property,
      street: 'Musterstraße 1',
      postalCode: '70173',
      city: 'Stuttgart',
      unit: '1. OG',
      objectNumber: '7',
    },
    landlord: { ...p.landlord, name: 'Verwaltung', phone: '0711 111', email: 'v@example.org' },
    tenants: [
      {
        name: 'Anna Muster',
        phone: '0711 222',
        email: 'anna@example.org',
        noEmail: false,
        newAddress: '',
      },
    ],
  };
  const rooms = p.rooms.map((r) => {
    const done = completeRoom(answerRoom(r));
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

  it('Chip-Zyklus nur offen ↔ OK; Mangel und Nicht vorhanden nur über setCheck', () => {
    let r = room();
    r = cycleCheck(r, 'walls');
    expect(r.checks.walls).toBe('ok');
    expect(r.decision).toBe('open');
    r = cycleCheck(r, 'walls');
    expect(r.checks.walls).toBe('open');
    r = setCheck(r, 'walls', 'defect');
    expect(r.checks.walls).toBe('defect');
    expect(r.decision).toBe('defects');
    expect(r.defects.walls).toBeTruthy();
    r = cycleCheck(r, 'walls');
    expect(r.checks.walls).toBe('open');
    expect(r.defects.walls).toBeTruthy();
    r = setCheck(r, 'walls', 'na');
    expect(r.checks.walls).toBe('na');
    expect(missingAttributes(r, 'walls')).toEqual([]);
    const allNa = Object.keys(r.checks).reduce((acc, id) => setCheck(acc, id, 'na'), r);
    expect(allNa.decision).toBe('noDefects');
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
    const r = setCheck(room(), 'floor', 'defect');
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
    const defect = setCheck(room(), 'floor', 'defect');
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
    let x = setCheck(answerRoom(room()), 'floor', 'defect');
    expect(completeRoom(x).ok).toBe(false);
    x = updateDefect(x, 'floor', { description: 'Kratzer im Parkett', photoIds: ['a'] });
    expect(completeRoom(x).ok).toBe(RULES.minPhotosPerDefect <= 1);
    x = updateDefect(x, 'floor', { photoIds: ['a', 'b'] });
    expect(completeRoom(x).ok).toBe(true);
  });

  it('nennt Element und Grund, Foto vor der Beschreibung', () => {
    expect(issueLabel({ checkId: 'ceiling', kind: 'open', missingCount: 0 })).toBe(
      'Decke: noch nicht geprüft',
    );
    expect(issueLabel({ checkId: 'walls', kind: 'missingDescription', missingCount: 0 })).toBe(
      'Wände: Beschreibung fehlt',
    );
    expect(issueLabel({ checkId: 'walls', kind: 'missingPhotos', missingCount: 1 })).toBe(
      'Wände: 1 Foto fehlt',
    );
    expect(issueLabel({ checkId: 'walls', kind: 'missingPhotos', missingCount: 2 })).toBe(
      'Wände: 2 Fotos fehlen',
    );
    expect(sheetCloseLabel({ checkId: 'walls', kind: 'missingPhotos', missingCount: 1 })).toBe(
      'Schließen – 1 Foto fehlt noch',
    );
    expect(photoCountLabel(1, 2)).toBe('Foto (1/2)');
    expect(photoCountLabel(0, 1)).toBe('Foto (0/1)');
    expect(photoStatusLabel(0, 2)).toBe('Noch 2 Fotos nötig');
    expect(photoStatusLabel(1, 2)).toBe('Noch 1 Foto nötig');
    expect(photoStatusLabel(1, 1)).toBe('✓ 1 Foto');
    expect(photoStatusLabel(2, 2)).toBe('✓ 2 Fotos');

    const defect = setCheck(confirmAllChecks(room()), 'walls', 'defect');
    const open = roomIssues(defect, { requireDetails: false });
    const firstOpen = open[0];
    if (!firstOpen) throw new Error('Issue fehlt');
    expect(open.map((issue) => issue.kind)).toEqual(['missingPhotos', 'missingDescription']);
    expect(firstOpen.missingCount).toBe(RULES.minPhotosPerDefect);
    expect(issueLabel(firstOpen)).toContain('Wände:');

    const missing = RULES.minPhotosPerDefect - 1;
    const first = roomIssues(updateDefect(defect, 'walls', { photoIds: ['a'] }), {
      requireDetails: false,
    })[0];
    if (!first) throw new Error('Issue fehlt');
    if (missing > 0) {
      expect(first).toMatchObject({ checkId: 'walls', kind: 'missingPhotos', missingCount: missing });
      expect(issueLabel(first)).toBe(
        missing === 1 ? 'Wände: 1 Foto fehlt' : `Wände: ${missing} Fotos fehlen`,
      );
    } else {
      expect(first.kind).toBe('missingDescription');
    }
  });

  it('Mangel-Vorschläge gehören zum Element, Zustandsbegriffe zur Notiz', () => {
    const walls = defectPhrases('walls', ['Eigener Begriff']);
    expect(walls[0]).toBe('Dübellöcher');
    expect(walls).toContain('Fehlt');
    expect(walls).not.toContain('Fachgerecht renoviert');
    expect(walls).not.toContain('Kühlschrank verschmutzt');
    expect(walls.at(-1)).toBe('Eigener Begriff');
    expect(walls.length).toBeGreaterThan(DEFECT_PHRASE_PREVIEW);
    expect(defectPhrases('oven')).toContain('Backofen verschmutzt');
    expect(defectPhrases('oven')).not.toContain('Dübellöcher');
    expect(conditionPhrases()).toContain('Besenrein');
    expect(conditionPhrases()).not.toContain('Dübellöcher');
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

describe('Daten und Status', () => {
  it('setzt das Übergabe-Datum auf den lokalen Kalendertag', () => {
    const now = new Date(2026, 9, 23, 15, 0, 0);
    const p = createProtocol('abnahme', now);
    expect(p.handoverOn).toBe('2026-10-23');
    expect(p.handoverOn).toBe(localIsoDate(now));
    expect(p.moveInOn).toBe('');
    expect(p.moveOutOn).toBe('');
    expect(p.schemaVersion).toBe(3);
  });

  it('nennt die Raum-Pill nur bei erledigten Räumen', () => {
    const open = buildRooms(Features.parse({}))[0];
    expect(open).toBeTruthy();
    if (!open) return;
    expect(roomStatusLabel(open)).toBeNull();
    const done = { ...open, completedAt: '2026-10-23T10:00:00.000Z' };
    expect(roomStatusLabel(done)).toEqual({ label: '✓ erledigt', tone: 'ok' });
    const one = { ...done, checks: { ...done.checks, walls: 'defect' as const } };
    expect(roomStatusLabel(one)).toEqual({ label: '✓ 1 Mangel', tone: 'warning' });
    const two = { ...one, checks: { ...one.checks, ceiling: 'defect' as const } };
    expect(roomStatusLabel(two)).toEqual({ label: '✓ 2 Mängel', tone: 'warning' });
  });

  it('ordnet Ausstattung in Vorhanden und Anzahl', () => {
    const kitchen = ROOM_TEMPLATES.kitchenFitted?.inventory ?? [];
    const groups = inventoryGroups(kitchen);
    expect(groups.present.length).toBeGreaterThan(0);
    expect(groups.counts.length).toBeGreaterThan(0);
    expect(groups.present.includes('oven')).toBe(true);
    expect(groups.counts.includes('bakingTray')).toBe(true);
    expect(inventoryGroups(['fehlt'])).toEqual({ present: [], counts: [] });
  });

  it('nennt fehlende Angaben und Ausstattung', () => {
    const hallway = buildRooms(Features.parse({}))[0];
    if (!hallway) throw new Error('kein Raum');
    const walls = setCheck(hallway, 'walls', 'ok');
    const both = roomIssues(walls).find((issue) => issue.checkId === 'walls');
    expect(both).toMatchObject({ kind: 'missingDetail', missingCount: 2 });
    expect(issueLabel(both ?? { checkId: 'walls', kind: 'missingDetail', missingCount: 2 })).toBe(
      'Wände: 2 Angaben fehlen',
    );
    const one = setDetail(walls, 'walls', 'paint', 'new');
    const left = roomIssues(one).find((issue) => issue.checkId === 'walls');
    expect(issueLabel(left ?? { checkId: 'walls', kind: 'missingDetail', missingCount: 1 })).toBe(
      'Wände: Oberfläche fehlt',
    );
    expect(
      sheetCloseLabel(
        left ?? { checkId: 'walls', kind: 'missingDetail', missingCount: 1, detail: 'Oberfläche' },
      ),
    ).toBe('Schließen – Oberfläche fehlt noch');
    expect(roomIssues(walls, { requireDetails: false }).some((issue) => issue.kind === 'missingDetail')).toBe(
      false,
    );

    const bath = buildRooms(Features.parse({})).find((r) => r.id === 'bath');
    if (!bath) throw new Error('Bad fehlt');
    const openInventory = roomIssues(confirmAllChecks(bath)).find(
      (issue) => issue.kind === 'missingInventory',
    );
    expect(openInventory?.missingCount).toBe(11);
    expect(
      issueLabel(openInventory ?? { checkId: '', kind: 'missingInventory', missingCount: 11 }, bath),
    ).toBe('Bad: 11 Ausstattungspunkte offen');
    const oneAnswered = { ...bath, inventory: { ...bath.inventory, mirror: false } };
    expect(roomIssues(oneAnswered).find((issue) => issue.kind === 'missingInventory')?.missingCount).toBe(10);
    const guest = buildRooms(Features.parse({ guestWc: true })).find((r) => r.id === 'guestWc');
    if (!guest) throw new Error('Gäste-WC fehlt');
    expect(roomIssues(confirmAllChecks(guest)).some((issue) => issue.kind === 'missingInventory')).toBe(
      false,
    );
  });

  it('Statuszeile: offen vor Mängeln, sonst keine Mängel', () => {
    const hallway = buildRooms(Features.parse({}))[0];
    if (!hallway) throw new Error('kein Raum');
    let r = hallway;
    expect(roomHeadline(r)).toBe(`${Object.keys(r.checks).length} offen`);
    r = setCheck(r, 'walls', 'defect');
    expect(roomHeadline(r)).toMatch(/offen$/);
    r = Object.keys(r.checks).reduce((acc, id) => setCheck(acc, id, id === 'walls' ? 'defect' : 'ok'), r);
    expect(roomHeadline(r)).toBe('1 Mangel');
    r = Object.keys(r.checks).reduce((acc, id) => setCheck(acc, id, 'na'), r);
    expect(roomHeadline(r)).toBe('Keine Mängel');
  });

  it('Pflichtfelder blockieren, Empfehlungen nicht; Keine E-Mail lässt die Mieter-Mail weg', () => {
    const base = createProtocol('abnahme');
    const tenant = base.tenants[0];
    if (!tenant) throw new Error('Mieter fehlt');
    const named = {
      ...base,
      property: { ...base.property, street: 'Musterstraße 1', postalCode: '12', city: 'Stuttgart' },
      landlord: { ...base.landlord, name: 'Verwaltung', email: 'kaputt' },
      tenants: [{ ...tenant, name: 'Anna' }],
      meters: [
        { id: 'm1', kind: 'electricity' as const, number: '', reading: '', location: '', photoIds: [] },
      ],
    };
    const meter = named.meters[0];
    if (!meter) throw new Error('Zähler fehlt');
    const messages = protocolIssues(named).map((issue) => issue.message);
    expect(messages).toContain('PLZ: 5 Ziffern');
    expect(messages).toContain('Vermieter/Verwalter: E-Mail ungültig');
    expect(messages).toContain('Lage fehlt');
    expect(messages).toContain('Strom: Stand fehlt');
    expect(messages).not.toContain('Strom: Zählernummer fehlt');
    expect(recommendedIssues(named).map((issue) => issue.message)).toEqual([
      'Strom: Zählernummer fehlt',
      'Strom: Ort fehlt',
      'Strom: Foto fehlt',
    ]);

    const relaxed = protocolIssues(named, { requireContactFields: false }).map((issue) => issue.message);
    expect(relaxed).not.toContain('Lage fehlt');
    expect(recommendedIssues(named, { requireContactFields: false }).map((issue) => issue.message)).toContain(
      'Lage fehlt',
    );

    const noMail = {
      ...named,
      property: { ...named.property, postalCode: '70173', unit: '1', objectNumber: '1' },
      landlord: { ...named.landlord, phone: '1', email: 'v@example.org' },
      tenants: [{ ...tenant, name: 'Anna', phone: '2', email: '', noEmail: true }],
      meters: [{ ...meter, reading: '1' }],
    };
    expect(protocolIssues(noMail).some((issue) => issue.message.includes('E-Mail Mieter'))).toBe(false);
  });

  it('nennt die fehlenden Unterschriften', () => {
    expect(missingSignatureLabel(1)).toBe('Noch 1 Unterschrift fehlt');
    expect(missingSignatureLabel(3)).toBe('Noch 3 Unterschriften fehlen');
  });
});

describe('Versand & Aufbewahrung', () => {
  it('Empfänger: gültige, eindeutige Adressen inkl. fester Kopie', () => {
    const p = createProtocol('uebergabe');
    const q = {
      ...p,
      landlord: { ...p.landlord, email: 'verwaltung@example.org' },
      tenants: [
        { name: 'A', phone: '', email: 'A@Example.org ', noEmail: false, newAddress: '' },
        { name: 'B', phone: '', email: 'kaputt', noEmail: false, newAddress: '' },
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

  it('Anzahl bleibt offen, bis plus, minus oder eine Eingabe eine Zahl setzt', () => {
    expect(stepCount(null, 1)).toBe(1);
    expect(stepCount(null, -1)).toBe(0);
    expect(stepCount(0, -1)).toBe(null);
    expect(stepCount(2, 1)).toBe(3);
    expect(parseCount('')).toBe(null);
    expect(parseCount('–')).toBe(null);
    expect(parseCount('0')).toBe(0);
    expect(parseCount('4')).toBe(4);
  });

  it('Abschluss nennt den ersten Punkt und wie viele weitere offen sind', () => {
    const hallway = buildRooms(Features.parse({}))[0];
    if (!hallway) throw new Error('kein Raum');
    const line = finishRoomLine(hallway);
    expect(line.message).toBe('Flur: Wände – noch nicht geprüft (+7 weitere)');
    expect(line.checkId).toBe('walls');
    expect(
      protocolIssues(createProtocol('uebergabe')).some((issue) =>
        issue.message.includes('nicht abgeschlossen'),
      ),
    ).toBe(false);
    const route = { name: 'room' as const, id: 'a', roomId: hallway.id, checkId: 'ceiling' };
    expect(parse(href(route))).toEqual(route);
  });
});
