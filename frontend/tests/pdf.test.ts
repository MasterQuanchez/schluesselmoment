import { readFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createDemoProtocol } from '@/domain/demo';
import { completeRoom, confirmAllChecks, createProtocol, cycleCheck, updateDefect } from '@/domain/protocol';
import type { Protocol, Room } from '@/domain/schema';
import { generatePdf, pdfFileName } from '@/pdf/generate';

describe('PDF', () => {
  it('erzeugt ein lesbares PDF mit Umlauten, Mängeln und Sonderzeichen', async () => {
    let p: Protocol = createProtocol('abnahme', new Date('2026-10-22T10:00:00Z'));
    p = {
      ...p,
      property: {
        ...p.property,
        street: 'Musterweg 15',
        postalCode: '70190',
        city: 'Stuttgart',
        unit: '4. OG rechts',
      },
      landlord: { ...p.landlord, name: 'Hausverwaltung Müller' },
      tenants: [{ name: 'Jürgen Öztürk', phone: '0711 123', email: 'j@example.org', newAddress: '' }],
      generalNote: 'Emoji 🎉 wird ersetzt, „Anführungszeichen“ bleiben lesbar.',
    };
    p = {
      ...p,
      rooms: p.rooms.map((r): Room => {
        const all = confirmAllChecks(r);
        if (r.id !== 'kitchen') return all;
        const d = updateDefect(cycleCheck(all, 'oven'), 'oven', {
          description: 'Backofen stark verschmutzt',
          photoIds: [],
        });
        const c = completeRoom(d);
        return c.ok ? c.room : d;
      }),
    };
    const bytes = await generatePdf(p, async () => null);
    expect(bytes.byteLength).toBeGreaterThan(2000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getTitle()).toContain('Abnahmeprotokoll');
    expect(pdfFileName(p)).toBe('Abnahmeprotokoll_Musterweg-15_2026-10-22.pdf');
    expect(
      pdfFileName({ ...p, type: 'uebergabe', property: { ...p.property, street: 'Große Straße 1' } }),
    ).toBe('Uebergabeprotokoll_Grosse-Strasse-1_2026-10-22.pdf');
  });

  it('setzt Betreff und Keyword nur beim Demo-Protokoll', async () => {
    const demo = await PDFDocument.load(
      await generatePdf(createDemoProtocol(new Date('2026-10-22T12:00:00Z')), async () => null),
    );
    expect(demo.getSubject()).toBe('DEMO – kein echtes Protokoll');
    expect(demo.getKeywords()?.split(/\s+/)).toContain('demo');

    const real = await PDFDocument.load(
      await generatePdf(createProtocol('abnahme', new Date('2026-10-22T10:00:00Z')), async () => null),
    );
    expect(real.getKeywords()?.split(/\s+/) ?? []).not.toContain('demo');
  });

  it('setzt Mangel-Fotos auf die Raum-Seite, nicht in einen Anhang', async () => {
    const foto1 = new Uint8Array(readFileSync(new URL('./e2e/fixtures/foto1.jpg', import.meta.url)));
    const foto2 = new Uint8Array(readFileSync(new URL('./e2e/fixtures/foto2.jpg', import.meta.url)));
    let p: Protocol = createProtocol('abnahme', new Date('2026-10-22T10:00:00Z'));
    p = {
      ...p,
      rooms: p.rooms.map((r): Room => {
        const all = confirmAllChecks(r);
        if (r.id !== 'kitchen') return all;
        return updateDefect(cycleCheck(all, 'walls'), 'walls', {
          description: 'Dübellöcher',
          photoIds: ['foto-1', 'foto-2'],
        });
      }),
    };
    const bytes = await generatePdf(p, async (id) =>
      id === 'foto-1' ? foto1 : id === 'foto-2' ? foto2 : null,
    );
    const doc = await PDFDocument.load(bytes);
    const counts = doc.getPages().map((_, index) => imageCount(doc, index));
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(2);
    const withImages = counts.findIndex((n) => n > 0);
    expect(withImages).toBeGreaterThanOrEqual(0);
    expect(withImages).toBeLessThan(doc.getPageCount() - 1);
  });
});

function imageCount(doc: PDFDocument, index: number): number {
  const resources = doc.getPage(index).node.Resources();
  if (!resources) return 0;
  const xobj = resources.get(PDFName.of('XObject'));
  if (!xobj) return 0;
  const dict = doc.context.lookup(xobj);
  if (!(dict instanceof PDFDict)) return 0;
  let n = 0;
  for (const [, ref] of dict.entries()) {
    const obj = doc.context.lookup(ref);
    if (!(obj instanceof PDFRawStream)) continue;
    if (obj.dict.lookup(PDFName.of('Subtype'))?.toString() === '/Image') n += 1;
  }
  return n;
}
