import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { createDemoProtocol } from '@/domain/demo';
import { completeRoom, confirmAllChecks, createProtocol, cycleCheck, updateDefect } from '@/domain/protocol';
import type { Protocol, Room } from '@/domain/schema';
import { generatePdf, type PdfLayoutMark, pdfFileName } from '@/pdf/generate';

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
      tenants: [{ name: 'Anna Muster', phone: '', email: 'anna@example.org', newAddress: '' }],
    };
    p = {
      ...p,
      rooms: p.rooms.map((r): Room => {
        const all = confirmAllChecks(r);
        if (r.id !== 'kitchen') return all;
        return (['walls', 'ceiling', 'floor'] as const).reduce((room, checkId) => {
          return updateDefect(cycleCheck(room, checkId), checkId, {
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
    for (const mark of layout) expect(bottom(mark)).toBeGreaterThanOrEqual(48 + 24 - 1);

    const dir = new URL('../test-results/sm17/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    const pdfPath = new URL('protokoll.pdf', dir);
    writeFileSync(pdfPath, bytes);
    await renderPages(pdfPath, dir, doc.getPageCount());
  }, 120_000);
});

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

async function renderPages(pdfPath: URL, dir: URL, pages: number) {
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
    await page.goto(`http://127.0.0.1:${addr.port}/render.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 30_000 });
    const pngs = await page.evaluate(() => {
      const bag = window as Window & { __pngs?: string[] };
      return bag.__pngs ?? [];
    });
    if (pngs.length !== pages) {
      throw new Error(`${pngs.length} Bilder, ${pages} Seiten. ${pageErrors.join(' | ')}`);
    }
    pngs.forEach((data, i) => {
      const out = fileURLToPath(new URL(`seite-${i + 1}.png`, dir));
      writeFileSync(out, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
      const size = statSync(out).size;
      if (size < 20_000) throw new Error(`Seite ${i + 1} ist leer (${size} Bytes)`);
    });
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
const out = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const pdfPage = await pdf.getPage(i);
  const viewport = pdfPage.getViewport({ scale: 1.3 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await pdfPage.render({ canvas, viewport }).promise;
  out.push(canvas.toDataURL('image/png'));
}
window.__pngs = out;
document.body.dataset.ready = '1';
</script>`;

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
