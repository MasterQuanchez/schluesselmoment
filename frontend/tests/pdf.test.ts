import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { chromium } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createDemoProtocol } from '@/domain/demo';
import { completeRoom, confirmAllChecks, createProtocol, setCheck, updateDefect } from '@/domain/protocol';
import type { Protocol, Room } from '@/domain/schema';
import { generatePdf, type PdfLayoutMark, pdfFileName } from '@/pdf/generate';

function namedTenant(p: Protocol, name: string, phone: string, email: string): Protocol['tenants'][number] {
  const tenant = p.tenants[0];
  if (!tenant) throw new Error('Mieter fehlt');
  return { ...tenant, name, phone, email, newAddress: '' };
}

const SIGN_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const HOCH = [
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9V',
  'XVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSk',
  'pKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCACMAFoDASIA',
  'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEB',
  'AQEAAAAAAAAAAAAAAAAAAAQF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmASt',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//9k=',
];

const QUER = [
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9V',
  'XVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSk',
  'pKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCABaAIwDASIA',
  'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB',
  'AQAAAAAAAAAAAAAAAAAAAAT/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCIBYmA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/Z',
];

const DETAIL = [
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9V',
  'XVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSk',
  'pKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCABuAFADASIA',
  'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEB',
  'AQEAAAAAAAAAAAAAAAAAAAIE/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AkASy',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//Z',
];

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
      tenants: [namedTenant(p, 'Jürgen Öztürk', '0711 123', 'j@example.org')],
      generalNote: 'Emoji 🎉 wird ersetzt, „Anführungszeichen“ bleiben lesbar.',
    };
    p = {
      ...p,
      rooms: p.rooms.map((r): Room => {
        const all = confirmAllChecks(r);
        if (r.id !== 'kitchen') return all;
        const d = updateDefect(setCheck(all, 'oven', 'defect'), 'oven', {
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
    expect(doc.getTitle()).toContain('Musterweg 15');
    expect(doc.getAuthor()).toBe('Hausverwaltung Müller');
    expect(doc.getSubject()).toContain('Abnahmeprotokoll');
    expect(doc.catalog.lookup(PDFName.of('Lang'))?.toString()).toContain('de-DE');
    expect(
      pdfFileName({ ...p, handoverOn: '2026-11-02', moveInOn: '2026-01-01', moveOutOn: '2026-11-03' }),
    ).toMatch(/^2026-11-02_Abnahmeprotokoll_Musterweg-15_SM-2026-[0-9a-f]{4}\.pdf$/);
    expect(
      pdfFileName({ ...p, type: 'uebergabe', property: { ...p.property, street: 'Große Straße 1' } }),
    ).toMatch(/^\d{4}-\d{2}-\d{2}_Uebergabeprotokoll_Grosse-Strasse-1_SM-\d{4}-[0-9a-f]{4}\.pdf$/);
  }, 30_000);

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
  }, 30_000);

  it('setzt Mangel-Fotos auf die Raum-Seite, nicht in einen Anhang', async () => {
    const foto1 = new Uint8Array(readFileSync(new URL('./e2e/fixtures/foto1.jpg', import.meta.url)));
    const foto2 = new Uint8Array(readFileSync(new URL('./e2e/fixtures/foto2.jpg', import.meta.url)));
    let p: Protocol = createProtocol('abnahme', new Date('2026-10-22T10:00:00Z'));
    p = {
      ...p,
      rooms: p.rooms.map((r): Room => {
        const all = confirmAllChecks(r);
        if (r.id !== 'kitchen') return all;
        return updateDefect(setCheck(all, 'walls', 'defect'), 'walls', {
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

  it('hält Mangel, Raumkopf und Unterschriften zusammen', async () => {
    const portrait = new Uint8Array(readFileSync(new URL('./e2e/fixtures/portrait.jpg', import.meta.url)));
    const landscape = new Uint8Array(readFileSync(new URL('./e2e/fixtures/landscape.jpg', import.meta.url)));
    const viel = 'An der Fläche sind Dübellöcher, Kratzer und eine Verfärbung neben der Tür. '.repeat(12);
    let p: Protocol = createProtocol('abnahme', new Date('2026-10-23T10:00:00Z'));
    p = {
      ...p,
      inspector: 'Nina',
      property: {
        ...p.property,
        street: 'Musterstraße 1',
        postalCode: '70190',
        city: 'Stuttgart',
        unit: '3. OG links',
      },
      landlord: { ...p.landlord, name: 'Hausverwaltung Beispiel' },
      tenants: [
        {
          ...namedTenant(p, 'Anna Muster', '', 'anna@example.org'),
          newAddress: 'Neue Straße 2, 70174 Stuttgart, Hinterhaus links neben dem Hof',
        },
      ],
    };
    p = {
      ...p,
      rooms: p.rooms.map((r): Room => {
        const all = confirmAllChecks(r);
        if (r.id !== 'kitchen') return all;
        return (['walls', 'ceiling', 'floor'] as const).reduce((room, checkId) => {
          return updateDefect(setCheck(room, checkId, 'defect'), checkId, {
            description: viel,
            photoIds: [`${checkId}-hoch`, `${checkId}-quer`],
          });
        }, all);
      }),
    };
    const layout: PdfLayoutMark[] = [];
    const bytes = await generatePdf(p, async (id) => (id.endsWith('-hoch') ? portrait : landscape), layout);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);

    const defects = layout.filter((mark) => mark.block.startsWith('defect:'));
    const defectIds = [...new Set(defects.map((mark) => mark.block))];
    expect(defectIds).toHaveLength(3);
    for (const id of defectIds) {
      const pages = new Set(defects.filter((mark) => mark.block === id).map((mark) => mark.page));
      expect(pages.size).toBe(1);
    }

    const bottom = (mark: PdfLayoutMark) => mark.y - mark.height;
    const contentRight = 595.28 - (20 * 72) / 25.4;
    for (const head of layout.filter((mark) => mark.block.startsWith('room-head:'))) {
      const onPage = layout.filter((mark) => mark.page === head.page && mark.block !== 'run');
      const lowest = Math.min(...onPage.map(bottom));
      expect(bottom(head)).toBeGreaterThan(lowest);
    }

    const signatures = layout.filter((mark) => mark.block === 'signatures');
    expect(signatures).toHaveLength(1);
    expect(new Set(signatures.map((mark) => mark.page)).size).toBe(1);
    const contentBottom = (22 * 72) / 25.4 - 1;
    for (const mark of layout) {
      if (mark.block === 'run') {
        expect(
          (mark.x ?? 0) + (mark.width ?? 0),
          `Lauf Seite ${mark.page} bei x ${mark.x} Breite ${mark.width}`,
        ).toBeLessThanOrEqual(contentRight + 0.6);
        continue;
      }
      expect(bottom(mark)).toBeGreaterThanOrEqual(contentBottom);
    }
    assertNoTextOverlap(layout);
    for (const id of defectIds) {
      const overview = layout.find((mark) => mark.block === `overview:${id}`);
      const defect = defects.find((mark) => mark.block === id);
      expect(overview?.page).toBe(defect?.page);
      expect(overview?.page).toBeGreaterThan(0);
    }

    const dir = new URL('../test-results/sm17/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    const pdfPath = new URL('protokoll.pdf', dir);
    writeFileSync(pdfPath, bytes);
    await renderPages(pdfPath, dir, doc.getPageCount());
  }, 120_000);

  it('bettet Jakarta und Inter ein und fällt sonst auf Helvetica zurück', async () => {
    const p = createProtocol('abnahme', new Date('2026-10-22T10:00:00Z'));
    const withFonts = fontNames(await PDFDocument.load(await generatePdf(p, async () => null)));
    expect(withFonts).toMatch(/PlusJakarta/);
    expect(withFonts).toMatch(/Inter/);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plain = fontNames(
      await PDFDocument.load(await generatePdf(p, async () => null, undefined, { fonts: false })),
    );
    expect(plain).not.toMatch(/PlusJakarta/);
    expect(plain).toContain('Helvetica');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  }, 30_000);

  it('misst den Bindestrich als Summe der Glyphenbreiten', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const bytes = readFileSync(new URL('../src/pdf/fonts/Inter-Regular.ttf', import.meta.url));
    const font = await doc.embedFont(bytes, { subset: false, features: { liga: false, kern: false } });
    const text = 'SM-2026';
    const size = 12;
    const sum = [...text].reduce((n, ch) => n + font.widthOfTextAtSize(ch, size), 0);
    expect(Math.abs(font.widthOfTextAtSize(text, size) - sum)).toBeLessThan(0.35);
    expect(font.widthOfTextAtSize('-', size)).toBeLessThan(font.widthOfTextAtSize('0', size) * 0.7);
  });

  it('rendert das Demo-Protokoll und bleibt ohne Fotos unter 250 kB', async () => {
    const bytes = await generatePdf(createDemoProtocol(new Date('2026-10-22T12:00:00Z')), async () => null);
    expect(bytes.byteLength).toBeLessThanOrEqual(250 * 1024);
    const doc = await PDFDocument.load(bytes);
    const dir = new URL('../test-results/sm20/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    const pdfPath = new URL('demo.pdf', dir);
    writeFileSync(pdfPath, bytes);
    await renderPages(pdfPath, dir, doc.getPageCount(), true);
  }, 120_000);

  it('rendert Entwurf und unterschriebenes Prüfprotokoll', async () => {
    const fixture = (name: string) =>
      new Uint8Array(readFileSync(new URL(`./e2e/fixtures/${name}`, import.meta.url)));
    const photos: Record<string, Uint8Array> = {
      c1: fixture('portrait.jpg'),
      w1: fixture('portrait.jpg'),
      w2: fixture('landscape.jpg'),
      f1: fixture('landscape.jpg'),
      f2: fixture('portrait.jpg'),
      f3: fixture('foto1.jpg'),
    };
    let p: Protocol = createProtocol('abnahme', new Date('2026-10-23T10:00:00Z'));
    const tenant = namedTenant(p, 'Anna Muster', '0711 123', 'anna@example.org');
    p = {
      ...p,
      moveOutOn: '2026-11-30',
      inspector: 'Nina',
      property: {
        ...p.property,
        street: 'Musterstraße 4',
        postalCode: '70190',
        city: 'Stuttgart',
        unit: '2. OG',
      },
      landlord: { ...p.landlord, name: 'Hausverwaltung Beispiel' },
      tenants: [
        {
          ...tenant,
          email: '',
          noEmail: true,
          newAddress: 'Neue Straße 2, 70174 Stuttgart, Hinterhaus links',
        },
      ],
      keys: p.keys.map((key) =>
        key.kind === 'apartment'
          ? { ...key, count: 2 }
          : key.kind === 'building'
            ? { ...key, count: 1 }
            : key,
      ),
      rooms: p.rooms.map((room): Room => {
        const all = confirmAllChecks(room);
        const done = '2026-10-23T11:00:00.000Z';
        if (room.id === 'hallway') return { ...setCheck(all, 'lights', 'na'), completedAt: done };
        if (room.id !== 'kitchen') return { ...all, completedAt: done };
        const ceiling = updateDefect(setCheck(all, 'ceiling', 'defect'), 'ceiling', {
          description: 'Feuchter Fleck an der Decke',
          photoIds: ['c1'],
        });
        const walls = updateDefect(setCheck(ceiling, 'walls', 'defect'), 'walls', {
          description:
            'Lange Mangelbeschreibung an der Wand, die in der Übersicht gekürzt werden muss, weil sie sonst über die Spalte läuft.',
          photoIds: ['w1', 'w2'],
        });
        const floor = updateDefect(setCheck(walls, 'floor', 'defect'), 'floor', {
          description: 'Kratzer im Boden',
          photoIds: ['f1', 'f2', 'f3'],
        });
        return {
          ...floor,
          completedAt: done,
          inventory: { bakingTray: 2, oven: true, fridge: false, hob: null },
        };
      }),
    };
    const dir = new URL('../test-results/sm20c/', import.meta.url);
    const draftDir = new URL('entwurf/', dir);
    const signedDir = new URL('unterschrieben/', dir);
    mkdirSync(draftDir, { recursive: true });
    mkdirSync(signedDir, { recursive: true });
    const draftLayout: PdfLayoutMark[] = [];
    const draftBytes = await generatePdf(p, async (id) => photos[id] ?? null, draftLayout);
    const draftDoc = await PDFDocument.load(draftBytes);
    const draftPath = new URL('entwurf.pdf', dir);
    writeFileSync(draftPath, draftBytes);
    const draftText = await renderPages(draftPath, draftDir, draftDoc.getPageCount());
    assertNoTextOverlap(draftLayout);
    expectKpi(draftText, '7', 'Räume geprüft');
    expectKpi(draftText, '3', 'Mängel');
    expectKpi(draftText, '3', 'Schlüssel übergeben');
    expect(draftText).toContain('E-Mail: keine angegeben');
    expect(draftText).toContain('Neue Adresse (nach Auszug):');
    expect(draftText).toContain('Vorhanden:');
    expect(draftText).toContain('Backblech 2');
    expect(draftText).toContain('Nicht vorhanden: Kühlschrank');
    expect(draftText).toContain('Offen:');
    expect(draftText).toMatch(/Lichter\s+–\s+Nicht vorhanden/);

    const signedAt = '2026-10-23T15:04:00.000Z';
    const signed: Protocol = {
      ...p,
      status: 'signed',
      signatures: [
        { role: 'landlord', partyIndex: 0, name: p.landlord.name, image: SIGN_PNG, signedAt },
        { role: 'tenant', partyIndex: 0, name: tenant.name, image: SIGN_PNG, signedAt },
      ],
      seal: { algorithm: 'SHA-256', hash: 'ab'.repeat(32), sealedAt: signedAt },
    };
    const signedLayout: PdfLayoutMark[] = [];
    const signedBytes = await generatePdf(signed, async (id) => photos[id] ?? null, signedLayout);
    const signedDoc = await PDFDocument.load(signedBytes);
    const signedPath = new URL('unterschrieben.pdf', dir);
    writeFileSync(signedPath, signedBytes);
    const text = await renderPages(signedPath, signedDir, signedDoc.getPageCount());
    expect(text).not.toMatch(/Alle \d+ Prüfpunkte/);
    expect(text).not.toContain('Keine Restgegenstände ·');
    expect(text).toContain('Keine Restgegenstände');
    expect(text).toContain('Therme: Füllschlauch da');
    expect(text).toContain('Auszug zum');
    expect(text).toContain('30.11.2026');
    expect(text).toContain('…');
    expect(text).not.toContain('Offen:');
    assertNoTextOverlap(signedLayout);
  }, 180_000);

  it('bleibt mit zehn Fotos unter 5 MB', async () => {
    const blobs = tenPhotoJpegs();
    const ids = Array.from({ length: 10 }, (_, index) => `p${index}`);
    let p: Protocol = createProtocol('abnahme', new Date('2026-10-23T10:00:00Z'));
    p = {
      ...p,
      rooms: p.rooms.map((room): Room => {
        const all = confirmAllChecks(room);
        if (room.id !== 'kitchen') return all;
        return updateDefect(setCheck(all, 'walls', 'defect'), 'walls', {
          description: 'Zehn Fotos zur Größenprobe',
          photoIds: ids,
        });
      }),
    };
    const bytes = await generatePdf(p, async (id) => blobs[Number(id.slice(1))] ?? null);
    expect(bytes.byteLength).toBeLessThanOrEqual(5 * 1024 * 1024);
    const dir = new URL('../test-results/sm20b/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('zehn-fotos.pdf', dir), bytes);
    writeFileSync(new URL('zehn-fotos-bytes.txt', dir), `${bytes.byteLength}\n`);
  }, 60_000);
});

function textBox(mark: PdfLayoutMark) {
  const x = mark.x ?? 0;
  const width = mark.width ?? 0;
  return {
    page: mark.page,
    x1: x,
    x2: x + width,
    y1: mark.y - mark.height * 0.2,
    y2: mark.y + mark.height * 0.8,
  };
}

function assertNoTextOverlap(layout: PdfLayoutMark[]) {
  const runs = layout.filter((mark) => mark.block === 'run').map(textBox);
  for (let i = 0; i < runs.length; i++) {
    const a = runs[i];
    if (!a) continue;
    for (let j = i + 1; j < runs.length; j++) {
      const b = runs[j];
      if (!b || a.page !== b.page) continue;
      const ix = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const iy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (ix > 0.8 && iy > 0.8) {
        throw new Error(`Text überlappt auf Seite ${a.page} (${ix.toFixed(1)} × ${iy.toFixed(1)} pt)`);
      }
    }
  }
}

function expectKpi(text: string, value: string, label: string) {
  const at = text.indexOf(label);
  expect(at).toBeGreaterThan(-1);
  expect(text.slice(Math.max(0, at - 12), at + label.length + 12)).toContain(value);
}

function tenPhotoJpegs(): Uint8Array[] {
  const dir = fileURLToPath(new URL('../test-results/sm20b/quellen/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const script = [
    'from PIL import Image, ImageDraw',
    'from pathlib import Path',
    'import sys',
    'out = Path(sys.argv[1])',
    'for i in range(10):',
    '    portrait = i % 2 == 0',
    '    size = (1200, 1600) if portrait else (1600, 1200)',
    '    im = Image.new("RGB", size, (236, 232, 224))',
    '    d = ImageDraw.Draw(im)',
    '    d.rectangle([24, 24, size[0] - 24, size[1] - 24], outline=(11, 31, 58), width=8)',
    '    d.rectangle([80, 180, size[0] - 80, size[1] - 180], fill=(180 - i * 8, 90, 50))',
    '    d.ellipse([size[0] // 2 - 160, size[1] // 3, size[0] // 2 + 160, size[1] // 3 + 280], fill=(40, 110, 160))',
    '    im.save(out / f"{i}.jpg", "JPEG", quality=80)',
  ].join('\n');
  try {
    execFileSync('py', ['-3', '-c', script, dir], { timeout: 60_000 });
    return Array.from({ length: 10 }, (_, index) => new Uint8Array(readFileSync(join(dir, `${index}.jpg`))));
  } catch {
    const jpeg = (parts: string[]) => Uint8Array.from(Buffer.from(parts.join(''), 'base64'));
    const small = [jpeg(HOCH), jpeg(QUER), jpeg(DETAIL)];
    return Array.from({ length: 10 }, (_, index) => small[index % small.length] ?? jpeg(HOCH));
  }
}

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

async function renderPages(pdfPath: URL, dir: URL, pages: number, gray = false) {
  const pdfBytes = readFileSync(pdfPath);
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (path === '/render.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(RENDER_HTML);
      return;
    }
    if (path === '/doc.pdf') {
      res.setHeader('content-type', 'application/pdf');
      res.end(pdfBytes);
      return;
    }
    const rel = relative(pdfjsRoot, join(pdfjsRoot, decodeURIComponent(path)));
    if (rel.startsWith('..') || rel.includes(':')) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const file = join(pdfjsRoot, rel);
      res.setHeader('content-type', contentType(file));
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const pageErrors: string[] = [];
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Lokaler Port fehlt');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const grayQuery = gray ? '?gray=1' : '';
    await page.goto(`http://127.0.0.1:${addr.port}/render.html${grayQuery}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 30_000 });
    const pngs = await page.evaluate(() => {
      const bag = window as Window & { __pngs?: string[]; __gray?: string[]; __text?: string[] };
      return { color: bag.__pngs ?? [], gray: bag.__gray ?? [], text: bag.__text ?? [] };
    });
    if (pngs.color.length !== pages) {
      throw new Error(`${pngs.color.length} Bilder, ${pages} Seiten. ${pageErrors.join(' | ')}`);
    }
    const writePng = (data: string, name: string) => {
      const out = fileURLToPath(new URL(name, dir));
      writeFileSync(out, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
      const size = statSync(out).size;
      if (size < 20_000) throw new Error(`${name} ist leer (${size} Bytes)`);
    };
    for (const [i, data] of pngs.color.entries()) writePng(data, `seite-${i + 1}.png`);
    if (gray) {
      if (pngs.gray.length !== pages) throw new Error(`Graustufen: ${pngs.gray.length} von ${pages}`);
      for (const [i, data] of pngs.gray.entries()) writePng(data, `seite-${i + 1}-grau.png`);
    }
    return pngs.text.join('\n');
  } catch (error) {
    const detail = pageErrors.length ? ` ${pageErrors.join(' | ')}` : '';
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function contentType(file: string): string {
  if (file.endsWith('.wasm')) return 'application/wasm';
  if (file.endsWith('.mjs') || file.endsWith('.js')) return 'text/javascript';
  if (file.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

const RENDER_HTML = `<!doctype html>
<meta charset="utf-8">
<body></body>
<script type="module">
import { getDocument, GlobalWorkerOptions } from '/build/pdf.mjs';
GlobalWorkerOptions.workerSrc = '/build/pdf.worker.mjs';
const data = new Uint8Array(await (await fetch('/doc.pdf')).arrayBuffer());
const pdf = await getDocument({ data }).promise;
const wantGray = new URLSearchParams(location.search).get('gray') === '1';
const out = [];
const grayOut = [];
const texts = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const pdfPage = await pdf.getPage(i);
  const viewport = pdfPage.getViewport({ scale: 1.3 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await pdfPage.render({ canvas, viewport }).promise;
  out.push(canvas.toDataURL('image/png'));
  const content = await pdfPage.getTextContent();
  texts.push(content.items.map((item) => item.str || '').join(' '));
  if (wantGray) {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext('2d');
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(canvas, 0, 0);
    grayOut.push(copy.toDataURL('image/png'));
  }
}
window.__pngs = out;
window.__gray = grayOut;
window.__text = texts;
document.body.dataset.ready = '1';
</script>`;

function fontNames(doc: PDFDocument): string {
  const names: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const fonts = doc.getPage(i).node.Resources()?.lookup(PDFName.of('Font'));
    if (!(fonts instanceof PDFDict)) continue;
    for (const [, ref] of fonts.entries()) {
      const dict = doc.context.lookup(ref);
      if (!(dict instanceof PDFDict)) continue;
      names.push(dict.lookup(PDFName.of('BaseFont'))?.toString() ?? '');
    }
  }
  return names.join(' ');
}

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
