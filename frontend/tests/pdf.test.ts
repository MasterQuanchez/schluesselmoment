import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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
      tenants: [namedTenant(p, 'Anna Muster', '', 'anna@example.org')],
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
    for (const head of layout.filter((mark) => mark.block.startsWith('room-head:'))) {
      const onPage = layout.filter((mark) => mark.page === head.page);
      const lowest = Math.min(...onPage.map(bottom));
      expect(bottom(head)).toBeGreaterThan(lowest);
    }

    const signatures = layout.filter((mark) => mark.block === 'signatures');
    expect(signatures).toHaveLength(1);
    expect(new Set(signatures.map((mark) => mark.page)).size).toBe(1);
    const contentBottom = (22 * 72) / 25.4 - 1;
    for (const mark of layout) expect(bottom(mark)).toBeGreaterThanOrEqual(contentBottom);
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
});

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
      const bag = window as Window & { __pngs?: string[]; __gray?: string[] };
      return { color: bag.__pngs ?? [], gray: bag.__gray ?? [] };
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
for (let i = 1; i <= pdf.numPages; i++) {
  const pdfPage = await pdf.getPage(i);
  const viewport = pdfPage.getViewport({ scale: 1.3 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await pdfPage.render({ canvas, viewport }).promise;
  out.push(canvas.toDataURL('image/png'));
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
