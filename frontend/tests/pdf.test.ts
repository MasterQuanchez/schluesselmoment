import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
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
});
