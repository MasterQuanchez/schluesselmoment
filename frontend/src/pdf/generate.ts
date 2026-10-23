/**
 * PDF-Erzeugung auf dem Gerät (pdf-lib). Layout nach docs/design/pdf-design-vorlage.html.
 * Umbruch bleibt blockweise: ein Block wird gemessen und nicht vorgezogen (SM-17).
 */
import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { CHECKS, INVENTORY, KEY_LABEL, METER_LABEL } from '@/domain/catalog';
import { requiredSigners, signatureFor } from '@/domain/protocol';
import type { Protocol, Room } from '@/domain/schema';

export type PhotoLoader = (id: string) => Promise<Uint8Array | null>;

/** Nur für Tests: wohin ein Block gesetzt wurde. Die App übergibt das Argument nicht. */
export type PdfLayoutMark = {
  block: string;
  page: number;
  y: number;
  height: number;
  x?: number;
  width?: number;
};

const A4: [number, number] = [595.28, 841.89];
const MM = 72 / 25.4;
const M = 20 * MM;
const TOP = 20 * MM;
const BOTTOM = 22 * MM;
const BUDGET = A4[1] - TOP - BOTTOM;
const TEXT_W = 390;

const hex = (value: string) =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );

const COLOR = {
  text: hex('#1A2230'),
  muted: hex('#5B6675'),
  navy: hex('#0B1F3A'),
  accent: hex('#0A6CB8'),
  ok: hex('#0E6B4D'),
  defect: hex('#8A5300'),
  warnBg: hex('#FBF1E3'),
  line: hex('#E3E8EF'),
  band: hex('#F1F5FB'),
  white: rgb(1, 1, 1),
  icon: hex('#A9BCD6'),
  gray: rgb(0.35, 0.35, 0.35),
};

const TITLE: Record<Protocol['type'], string> = {
  uebergabe: 'Übergabeprotokoll',
  abnahme: 'Abnahmeprotokoll',
  bestandsaufnahme: 'Bestandsaufnahme',
};

const CHIP: Record<Protocol['type'], string> = {
  uebergabe: 'Übergabe · Einzug',
  abnahme: 'Abnahme · Auszug',
  bestandsaufnahme: 'Bestandsaufnahme',
};

const HOUSE =
  'M367.7 270.0 L367.7 372.4 L367.6 375.0 L367.2 377.4 L366.5 379.5 L365.5 381.3 L364.2 382.8 L362.7 384.1 L360.9 385.1 L358.8 385.8 L356.4 386.2 L353.7 386.3 L158.3 386.3 L155.6 386.2 L153.2 385.8 L151.1 385.1 L149.3 384.1 L147.8 382.8 L146.5 381.3 L145.5 379.5 L144.8 377.4 L144.4 375.0 L144.3 372.4 L144.3 246.7 L144.4 243.9 L144.7 241.3 L145.2 238.7 L146.0 236.3 L146.9 233.9 L148.1 231.7 L149.4 229.5 L151.0 227.4 L152.8 225.4 L154.8 223.5 L245.5 144.2 L247.6 142.5 L249.7 141.2 L251.8 140.3 L253.9 139.8 L256.0 139.6 L258.1 139.8 L260.2 140.3 L262.3 141.2 L264.4 142.5 L266.5 144.2 L321.2 192.2';
const TICK =
  'M204.8 279.3 L241.8 316.2 L242.7 317.1 L243.7 317.8 L244.7 318.3 L245.7 318.6 L246.7 318.7 L247.7 318.6 L248.7 318.3 L249.7 317.9 L250.7 317.2 L251.7 316.3 L395.6 176.9';

const FONT_URL = {
  jakarta: new URL('./fonts/PlusJakartaSans-SemiBold.ttf', import.meta.url).href,
  regular: new URL('./fonts/Inter-Regular.ttf', import.meta.url).href,
  medium: new URL('./fonts/Inter-Medium.ttf', import.meta.url).href,
  semi: new URL('./fonts/Inter-SemiBold.ttf', import.meta.url).href,
};

type Ink = { height: number; draw: () => void | Promise<void> };
type Piece = Ink & { id: string; chunks?: Ink[] };
type Slot = { page: PDFPage; x: number; y: number; block: string; align: 'left' | 'right' };
type Face = { jakarta: PDFFont; regular: PDFFont; medium: PDFFont; semi: PDFFont };
type Paint = { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number };

const ascii = (value: string) =>
  value
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function protocolNumber(p: Protocol): string {
  const year = p.handoverOn.slice(0, 4) || '0000';
  const short = p.id.replace(/-/g, '').slice(0, 4).toLowerCase();
  return `SM-${year}-${short || '0000'}`;
}

export function pdfFileName(p: Protocol): string {
  const street = ascii(p.property.street) || 'Objekt';
  return `${p.handoverOn}_${ascii(TITLE[p.type])}_${street}_${protocolNumber(p)}.pdf`;
}

const fmtDay = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function formatReading(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '–';
  const n = Number(trimmed.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return trimmed;
  const [whole, frac] = Math.abs(n).toFixed(1).split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${grouped},${frac}`;
}

function shortHash(hash: string): string {
  return hash.length < 8 ? hash : `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

async function readAsset(href: string): Promise<Uint8Array> {
  if (typeof window === 'undefined') {
    const fs = await import(/* @vite-ignore */ 'node:fs/promises');
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url');
    const fromFile = href.startsWith('file:') ? fileURLToPath(href) : '';
    const name = decodeURIComponent(href.split('/').pop()?.split('?')[0] ?? '');
    const beside = name ? fileURLToPath(new URL(`./fonts/${name}`, import.meta.url)) : '';
    const path = fromFile || beside;
    if (path) return new Uint8Array(await fs.readFile(path));
  }
  const response = await fetch(href);
  if (!response.ok) throw new Error(String(response.status));
  return new Uint8Array(await response.arrayBuffer());
}

async function shrinkJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return bytes;
  try {
    const view = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const bmp = await createImageBitmap(new Blob([view], { type: 'image/jpeg' }));
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (scale >= 1) {
      bmp.close();
      return bytes;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return bytes;
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8),
    );
    return out ? new Uint8Array(await out.arrayBuffer()) : bytes;
  } catch {
    return bytes;
  }
}

function mapIcon(d: string, size: number): string {
  const s = size / 512;
  return d.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_m, cmd: string, xs: string, ys: string) => {
    return `${cmd} ${(Number(xs) * s).toFixed(2)} ${(Number(ys) * s).toFixed(2)}`;
  });
}

export async function generatePdf(
  p: Protocol,
  loadPhoto: PhotoLoader,
  layout?: PdfLayoutMark[],
  options?: { fonts?: boolean },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const address = [p.property.street, [p.property.postalCode, p.property.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const addressLine = [address, p.property.unit].filter(Boolean).join(' · ') || 'Ohne Adresse';
  doc.setTitle(`${TITLE[p.type]} – ${address || p.property.street || 'Ohne Adresse'}`);
  doc.setAuthor(p.landlord.name.trim() || 'Schlüsselmoment');
  doc.setCreator('Schlüsselmoment');
  doc.setProducer('Schlüsselmoment (pdf-lib)');
  doc.setCreationDate(new Date(p.createdAt));
  doc.setLanguage('de-DE');
  const demo = p.inspector === 'Demo';
  doc.setSubject(demo ? 'DEMO – kein echtes Protokoll' : `${TITLE[p.type]} – ${address || 'Ohne Adresse'}`);
  const keywords = [
    ...(p.seal ? [`sha256:${p.seal.hash}`, `protocol:${p.id}`] : []),
    ...(demo ? ['demo'] : []),
  ];
  if (keywords.length) doc.setKeywords(keywords);

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let face: Face = { jakarta: helveticaBold, regular: helvetica, medium: helvetica, semi: helveticaBold };
  if (options?.fonts !== false) {
    try {
      const [jakarta, regular, medium, semi] = await Promise.all([
        readAsset(FONT_URL.jakarta),
        readAsset(FONT_URL.regular),
        readAsset(FONT_URL.medium),
        readAsset(FONT_URL.semi),
      ]);
      const embed = (bytes: Uint8Array) =>
        doc.embedFont(bytes, { subset: false, features: { liga: false, kern: false } });
      face = {
        jakarta: await embed(jakarta),
        regular: await embed(regular),
        medium: await embed(medium),
        semi: await embed(semi),
      };
    } catch (error) {
      console.warn('Schrift nicht geladen. Das PDF nutzt Helvetica.', error);
      face = { jakarta: helveticaBold, regular: helvetica, medium: helvetica, semi: helveticaBold };
    }
  }

  const known = new Map<string, boolean>();
  const safe = (value: string) =>
    [...value.replace(/\r?\n/g, ' ')]
      .map((ch) => {
        let ok = known.get(ch);
        if (ok === undefined) {
          try {
            face.regular.encodeText(ch);
            face.semi.encodeText(ch);
            face.jakarta.encodeText(ch);
            ok = true;
          } catch {
            ok = false;
          }
          known.set(ch, ok);
        }
        return ok ? ch : '?';
      })
      .join('');

  let page: PDFPage = doc.addPage(A4);
  let pageNo = 1;
  let y = A4[1] - TOP;
  const width = A4[0] - 2 * M;
  let roomHasInk = false;
  const slots: Slot[] = [];
  const marks: PdfLayoutMark[] = [];
  const number = protocolNumber(p);

  const watch = (target: PDFPage, no: number) => {
    const raw = target.drawText.bind(target);
    const host = target as PDFPage & {
      drawText: (text: string, options?: Parameters<PDFPage['drawText']>[1]) => void;
    };
    host.drawText = (text, options) => {
      raw(text, options);
      if (!text || options?.rotate) return;
      const size = options?.size ?? 0;
      const font = options?.font;
      if (!font || size <= 0) return;
      const x = options?.x ?? 0;
      const w = font.widthOfTextAtSize(text, size);
      const mark: PdfLayoutMark = { block: 'run', page: no, y: options?.y ?? 0, height: size, x, width: w };
      marks.push(mark);
      layout?.push(mark);
    };
  };
  watch(page, pageNo);

  const paintMark = (target: PDFPage) => {
    if (!demo) return;
    target.drawText('DEMO', {
      x: 150,
      y: 280,
      size: 96,
      font: face.jakarta,
      color: COLOR.gray,
      opacity: 0.08,
      rotate: degrees(45),
    });
  };
  paintMark(page);

  const note = (block: string, y0: number, height: number) => {
    const mark = { block, page: pageNo, y: y0, height };
    marks.push(mark);
    layout?.push(mark);
  };
  const remaining = () => y - BOTTOM;

  const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
      else {
        if (line) lines.push(line);
        let rest = word;
        while (f.widthOfTextAtSize(rest, size) > maxW && rest.length > 1) {
          let i = rest.length;
          while (i > 1 && f.widthOfTextAtSize(rest.slice(0, i), size) > maxW) i--;
          lines.push(rest.slice(0, i));
          rest = rest.slice(i);
        }
        line = rest;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const clip = (text: string, f: PDFFont, size: number, maxW: number) => {
    const raw = safe(text);
    if (f.widthOfTextAtSize(raw, size) <= maxW) return raw;
    const ell = '…';
    let end = raw.length;
    while (end > 0 && f.widthOfTextAtSize(`${raw.slice(0, end)}${ell}`, size) > maxW) end -= 1;
    return `${raw.slice(0, end).trimEnd()}${ell}`;
  };

  const textH = (s: string, size: number, f: PDFFont = face.regular, maxW = TEXT_W, gap = 0) =>
    wrap(s, f, size, maxW).length * (size + 4) + gap;

  const paintText = (
    s: string,
    size: number,
    f: PDFFont,
    color: ReturnType<typeof rgb>,
    x = M,
    gap = 0,
    maxW = TEXT_W,
  ) => {
    const lh = size + 4;
    for (const line of wrap(s, f, size, maxW)) {
      if (line) page.drawText(line, { x, y: y - size, size, font: f, color });
      y -= lh;
    }
    y -= gap;
  };

  const drawTracked = (
    s: string,
    x: number,
    baseline: number,
    size: number,
    f: PDFFont,
    color: ReturnType<typeof rgb>,
  ) => {
    let cx = x;
    for (const ch of safe(s)) {
      page.drawText(ch, { x: cx, y: baseline, size, font: f, color });
      cx += f.widthOfTextAtSize(ch, size) + 0.9;
    }
  };

  const rounded = (x: number, bottom: number, w: number, h: number, r: number, paint: Paint) => {
    const rr = Math.min(r, w / 2, h / 2);
    const d = [
      `M ${rr} 0`,
      `L ${w - rr} 0`,
      `Q ${w} 0 ${w} ${rr}`,
      `L ${w} ${h - rr}`,
      `Q ${w} ${h} ${w - rr} ${h}`,
      `L ${rr} ${h}`,
      `Q 0 ${h} 0 ${h - rr}`,
      `L 0 ${rr}`,
      `Q 0 0 ${rr} 0 Z`,
    ].join(' ');
    page.drawSvgPath(d, { x, y: bottom + h, ...paint });
  };

  const icon = (ox: number, bottom: number, size: number) => {
    rounded(ox, bottom, size, size, (121 / 512) * size, { color: COLOR.navy });
    const house = Math.max(1.05, (11.2 / 512) * size * 3.2);
    page.drawSvgPath(mapIcon(HOUSE, size), {
      x: ox,
      y: bottom + size,
      borderColor: COLOR.white,
      borderWidth: house,
    });
    page.drawSvgPath(mapIcon(TICK, size), {
      x: ox,
      y: bottom + size,
      borderColor: COLOR.icon,
      borderWidth: Math.max(1.15, (13 / 512) * size * 3.2),
    });
  };

  const rule = (yLine: number) => {
    page.drawLine({
      start: { x: M, y: yLine },
      end: { x: M + width, y: yLine },
      thickness: 0.5,
      color: COLOR.line,
    });
  };

  const openPage = (cont: { label: string; id: string } | null) => {
    page = doc.addPage(A4);
    pageNo += 1;
    watch(page, pageNo);
    paintMark(page);
    y = A4[1] - TOP;
    if (!cont) return;
    const y0 = y;
    page.drawText(safe(`${cont.label} (Fortsetzung)`), {
      x: M,
      y: y - 12,
      size: 12.5,
      font: face.jakarta,
      color: COLOR.navy,
    });
    y -= 20;
    note(`continuation:${cont.id}`, y0, 20);
  };

  const place = async (piece: Piece, cont: { label: string; id: string } | null) => {
    const chunks = piece.chunks && piece.height > BUDGET ? piece.chunks : [piece];
    for (const chunk of chunks) {
      if (chunk.height > remaining()) openPage(roomHasInk ? cont : null);
      const y0 = y;
      await chunk.draw();
      note(piece.id, y0, y0 - y);
      if (cont) roomHasInk = true;
    }
  };

  const placeTogether = async (parts: Piece[], cont: { label: string; id: string } | null) => {
    const sum = parts.reduce((s, part) => s + part.height, 0);
    if (sum > remaining()) openPage(roomHasInk ? cont : null);
    for (const part of parts) {
      const y0 = y;
      await part.draw();
      note(part.id, y0, y0 - y);
    }
    if (cont) roomHasInk = true;
  };

  const section = (num: string, label: string): Ink => ({
    height: 28,
    draw() {
      y -= 10;
      drawTracked(`${num}  ·  ${label.toUpperCase()}`, M, y - 7.5, 7.5, face.semi, COLOR.accent);
      y -= 12;
      rule(y);
      y -= 6;
    },
  });

  const photoGap = 8;
  const frameW = (width - photoGap) / 2;
  const frameH = (frameW * 3) / 4;
  const rowH = frameH + 16;
  const cache = new Map<string, Promise<PDFImage | null>>();
  const loadImg = (id: string) => {
    let pending = cache.get(id);
    if (!pending) {
      pending = (async () => {
        const bytes = await loadPhoto(id);
        if (!bytes) return null;
        try {
          return await doc.embedJpg(await shrinkJpeg(bytes));
        } catch {
          try {
            return await doc.embedJpg(bytes);
          } catch {
            return null;
          }
        }
      })();
      cache.set(id, pending);
    }
    return pending;
  };

  const paintFrames = (imgs: Array<PDFImage | null>, caption: string, nums: number[]) => {
    const top = y;
    imgs.forEach((img, col) => {
      const x = M + col * (frameW + photoGap);
      const bottom = top - frameH;
      rounded(x, bottom, frameW, frameH, 3, { color: COLOR.band, borderColor: COLOR.line, borderWidth: 0.5 });
      if (img) {
        const pad = 2;
        const scale = Math.min((frameW - pad * 2) / img.width, (frameH - pad * 2) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: x + (frameW - w) / 2, y: bottom + (frameH - h) / 2, width: w, height: h });
      } else {
        page.drawText('Foto nicht verfügbar', {
          x: x + 8,
          y: bottom + frameH / 2,
          size: 8,
          font: face.regular,
          color: COLOR.muted,
        });
      }
      page.drawText(safe(`Abb. ${nums[col]} · ${caption}`), {
        x,
        y: bottom - 12,
        size: 8,
        font: face.regular,
        color: COLOR.muted,
      });
    });
    y = top - rowH;
  };

  const detailText = (room: Room, checkId: string) => {
    const def = CHECKS[checkId];
    return Object.entries(room.details[checkId] ?? {})
      .map(([attrId, val]) => {
        const attr = def?.attributes?.find((a) => a.id === attrId);
        return attr ? `${attr.label} ${attr.options.find((o) => o.id === val)?.label ?? val}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  };

  const circleOk = (x: number, baseline: number) => {
    const r = 4.2;
    const cx = x + r;
    const cy = baseline + 3.2;
    page.drawCircle({ x: cx, y: cy, size: r, borderColor: COLOR.ok, borderWidth: 0.9 });
    page.drawSvgPath('M 1.3 4.5 L 3.6 6.8 L 7.5 2.0', {
      x: cx - r,
      y: cy + r,
      borderColor: COLOR.ok,
      borderWidth: 1.05,
    });
  };
  const triangle = (x: number, baseline: number) => {
    page.drawSvgPath('M 4 0.3 L 7.8 7.2 L 0.2 7.2 Z', {
      x,
      y: baseline + 7.6,
      color: COLOR.defect,
    });
  };

  const planRow = (n: string, label: string, state: string, details: string, mLabel: string): Ink => {
    const nameFont = state === 'defect' ? face.semi : face.regular;
    const nameLines = wrap(label, nameFont, 10, 200).filter(Boolean);
    const detail = wrap(details, face.regular, 8.5, width - 340)[0] ?? '';
    const lineCount = Math.max(nameLines.length, 1);
    return {
      height: lineCount * 14 + 2,
      draw() {
        page.drawText(safe(n), { x: M, y: y - 10, size: 8.5, font: face.medium, color: COLOR.muted });
        nameLines.forEach((line, index) => {
          page.drawText(line, {
            x: M + 28,
            y: y - 10 - index * 14,
            size: 10,
            font: nameFont,
            color: COLOR.text,
          });
        });
        if (state === 'ok') {
          circleOk(M + 236, y - 12);
          page.drawText('OK', { x: M + 248, y: y - 10, size: 9, font: face.semi, color: COLOR.ok });
        } else if (state === 'defect') {
          triangle(M + 236, y - 12);
          page.drawText('Mangel', { x: M + 248, y: y - 10, size: 9, font: face.semi, color: COLOR.defect });
          page.drawText(mLabel, { x: M + 292, y: y - 10, size: 8.5, font: face.medium, color: COLOR.muted });
        } else if ((state as string) === 'na') {
          page.drawText('–', { x: M + 248, y: y - 10, size: 9, font: face.regular, color: COLOR.muted });
        } else {
          page.drawText('offen', { x: M + 248, y: y - 10, size: 9, font: face.regular, color: COLOR.muted });
        }
        if (detail)
          page.drawText(detail, { x: M + 340, y: y - 10, size: 8.5, font: face.regular, color: COLOR.muted });
        y -= lineCount * 14 + 2;
      },
    };
  };

  const planHead = (room: Room, roomNo: number, defectCount: number): Ink => {
    const status =
      defectCount === 0 ? 'Keine Mängel' : defectCount === 1 ? '1 Mangel' : `${defectCount} Mängel`;
    return {
      height: 28,
      draw() {
        y -= 8;
        page.drawText(String(roomNo), { x: M, y: y - 12, size: 10, font: face.semi, color: COLOR.muted });
        const label = safe(status);
        const tw = face.semi.widthOfTextAtSize(label, 8) + (defectCount ? 28 : 24);
        const chipX = M + width - tw;
        page.drawText(clip(room.label, face.jakarta, 12.5, chipX - (M + 18) - 8), {
          x: M + 18,
          y: y - 13,
          size: 12.5,
          font: face.jakarta,
          color: COLOR.navy,
        });
        const x = chipX;
        const bottom = y - 16;
        if (defectCount) {
          rounded(x, bottom, tw, 16, 8, { color: COLOR.warnBg });
          triangle(x + 6, y - 13);
          page.drawText(label, { x: x + 16, y: y - 11, size: 8, font: face.semi, color: COLOR.defect });
        } else {
          rounded(x, bottom, tw, 16, 8, { borderColor: COLOR.ok, borderWidth: 0.8 });
          circleOk(x + 4, y - 14);
          page.drawText(label, { x: x + 16, y: y - 11, size: 8, font: face.semi, color: COLOR.ok });
        }
        y -= 20;
      },
    };
  };

  const defects: Array<{
    key: string;
    room: string;
    element: string;
    description: string;
    figs: number[];
    m: string;
  }> = [];
  let fig = 0;
  let mCount = 0;
  for (const room of p.rooms) {
    for (const [checkId, state] of Object.entries(room.checks)) {
      if (state !== 'defect') continue;
      mCount += 1;
      const ids = room.defects[checkId]?.photoIds ?? [];
      defects.push({
        key: `defect:${room.id}:${checkId}`,
        room: room.label,
        element: CHECKS[checkId]?.label ?? checkId,
        description: room.defects[checkId]?.description || '–',
        figs: ids.map(() => ++fig),
        m: `M${mCount}`,
      });
    }
  }
  const infoOf = (key: string) => defects.find((item) => item.key === key);

  const pairGap = 8;
  const pairW = (width - pairGap) / 2;
  const fitPhoto = (img: PDFImage | null, maxW: number, maxH: number) => {
    if (!img || img.width <= 0 || img.height <= 0) return { w: Math.min(maxW, 140), h: 36 };
    const scale = Math.min(maxW / img.width, maxH / img.height);
    return { w: img.width * scale, h: img.height * scale };
  };
  const photoLimits = (img: PDFImage | null, single: boolean) => {
    if (single) return { maxW: 340, maxH: 283 };
    const landscape = !img || img.width >= img.height;
    return { maxW: pairW, maxH: landscape ? (pairW * 3) / 4 : 255 };
  };
  const photoRow = (slice: Array<PDFImage | null>, caption: string, nums: number[], single: boolean): Ink => {
    const boxes = slice.map((img) => {
      const lim = photoLimits(img, single);
      return { img, ...fitPhoto(img, lim.maxW, lim.maxH) };
    });
    const imgH = Math.max(...boxes.map((box) => box.h), 1);
    return {
      height: imgH + 16,
      draw() {
        const top = y;
        for (const [col, box] of boxes.entries()) {
          const x = M + col * (pairW + pairGap);
          const bottom = top - box.h;
          if (box.img) {
            page.drawImage(box.img, { x, y: bottom, width: box.w, height: box.h });
            page.drawRectangle({
              x,
              y: bottom,
              width: box.w,
              height: box.h,
              borderColor: COLOR.line,
              borderWidth: 0.5,
            });
          } else {
            rounded(x, bottom, box.w, box.h, 3, {
              color: COLOR.band,
              borderColor: COLOR.line,
              borderWidth: 0.5,
            });
            page.drawText('Foto nicht verfügbar', {
              x: x + 8,
              y: bottom + 14,
              size: 8,
              font: face.regular,
              color: COLOR.muted,
            });
          }
          const capW = single ? width - col * (pairW + pairGap) : pairW;
          page.drawText(clip(`Abb. ${nums[col] ?? ''} · ${caption}`, face.regular, 8, capW), {
            x,
            y: bottom - 12,
            size: 8,
            font: face.regular,
            color: COLOR.muted,
          });
        }
        y = top - imgH - 16;
      },
    };
  };

  async function planDefect(room: Room, checkId: string, rowNo: string): Promise<Piece> {
    const key = `defect:${room.id}:${checkId}`;
    const info = infoOf(key);
    const ids = room.defects[checkId]?.photoIds ?? [];
    const imgs: Array<PDFImage | null> = [];
    for (const id of ids) imgs.push(await loadImg(id));
    const nums = info?.figs ?? [];
    const row = planRow(
      rowNo,
      CHECKS[checkId]?.label ?? checkId,
      'defect',
      detailText(room, checkId) || '—',
      info?.m ?? '',
    );
    const title = `${info?.m ?? ''} · ${CHECKS[checkId]?.label ?? checkId}`;
    const desc = info?.description || '–';
    const descH = textH(desc, 10, face.regular, TEXT_W - 16);
    const caption = `${info?.m ?? ''} · ${room.label} · ${CHECKS[checkId]?.label ?? checkId}`;
    const barred = (ink: Ink): Ink => ({
      height: ink.height,
      draw() {
        const y0 = y;
        ink.draw();
        page.drawLine({
          start: { x: M + 4, y: y0 },
          end: { x: M + 4, y },
          thickness: 2,
          color: COLOR.defect,
        });
      },
    });
    const body = barred({
      height: 18 + descH,
      draw() {
        page.drawText(safe(title), { x: M + 14, y: y - 12, size: 10, font: face.semi, color: COLOR.text });
        y -= 18;
        paintText(desc, 10, face.regular, COLOR.text, M + 14, 0, TEXT_W - 16);
      },
    });
    const photos: Ink[] = [];
    const alone = imgs.length === 1;
    for (let i = 0; i < imgs.length; i += 2) {
      photos.push(barred(photoRow(imgs.slice(i, i + 2), caption, nums.slice(i, i + 2), alone)));
    }
    const chunks: Ink[] = [row, body, ...photos];
    return {
      id: key,
      height: chunks.reduce((sum, chunk) => sum + chunk.height, 0),
      chunks,
      draw() {
        for (const chunk of chunks) chunk.draw();
      },
    };
  }

  const planTail = (room: Room): Ink => {
    const inv = Object.entries(room.inventory)
      .filter(([, v]) => v === true || (typeof v === 'number' && v > 0))
      .map(([k, v]) =>
        typeof v === 'number' ? `${INVENTORY[k]?.label ?? k} ${v}` : (INVENTORY[k]?.label ?? k),
      );
    const bits: Ink[] = [];
    if (inv.length) {
      const s = `Ausstattung: ${inv.join(', ')}`;
      bits.push({
        height: textH(s, 8.5, face.regular, width - 8),
        draw: () => paintText(s, 8.5, face.regular, COLOR.muted, M, 0, width - 8),
      });
    }
    if (room.note.trim()) {
      const s = `Notiz: ${room.note}`;
      bits.push({
        height: textH(s, 8.5, face.regular, width - 8),
        draw: () => paintText(s, 8.5, face.regular, COLOR.text, M, 0, width - 8),
      });
    }
    bits.push({
      height: 8,
      draw() {
        rule(y - 4);
        y -= 8;
      },
    });
    return {
      height: bits.reduce((sum, bit) => sum + bit.height, 0),
      draw() {
        for (const bit of bits) bit.draw();
      },
    };
  };

  const rowsFor = (room: Room, roomNo: number) => {
    const entries = Object.entries(room.checks);
    const plain = (id: string, state: string) => state === 'ok' && !detailText(room, id);
    const single = room.templateId === 'final' || room.label.startsWith('Abschluss');
    const rows: Array<{ n: string; checkId: string; label: string; state: string; details: string }> = [];
    let i = 0;
    let n = 1;
    while (i < entries.length) {
      const [checkId, state] = entries[i] ?? ['', 'open'];
      if (!single && plain(checkId, state)) {
        const labels = [CHECKS[checkId]?.label ?? checkId];
        let j = i + 1;
        while (j < entries.length) {
          const [nextId, nextState] = entries[j] ?? ['', 'open'];
          if (!plain(nextId, nextState)) break;
          labels.push(CHECKS[nextId]?.label ?? nextId);
          j += 1;
        }
        rows.push({ n: `${roomNo}.${n}`, checkId, label: labels.join(' · '), state: 'ok', details: '—' });
        n += 1;
        i = j;
        continue;
      }
      rows.push({
        n: `${roomNo}.${n}`,
        checkId,
        label: CHECKS[checkId]?.label ?? checkId,
        state,
        details: detailText(room, checkId) || '—',
      });
      n += 1;
      i += 1;
    }
    return rows;
  };

  const moveIn = p.type === 'uebergabe' && p.moveInOn ? p.moveInOn : '';
  const moveOut = p.type === 'abnahme' && p.moveOutOn ? p.moveOutOn : '';
  const checkedRooms = p.rooms.filter((room) => room.completedAt).length;
  const keySum = p.keys.reduce((sum, key) => sum + key.count, 0);
  const missingKeys = (['apartment', 'building', 'basement', 'mailbox'] as const).filter(
    (kind) => !p.keys.some((key) => key.kind === kind && key.count > 0),
  ).length;

  if (demo) {
    await place(
      {
        id: 'demo-banner',
        height: 16,
        draw() {
          page.drawText('Demo – nicht rechtsverbindlich', {
            x: M,
            y: y - 10,
            size: 8,
            font: face.semi,
            color: COLOR.defect,
          });
          y -= 16;
        },
      },
      null,
    );
  }

  await place(
    {
      id: 'cover:brand',
      height: 86,
      draw() {
        icon(M, y - 18, 18);
        page.drawText('Schlüsselmoment', {
          x: M + 24,
          y: y - 13,
          size: 10.5,
          font: face.semi,
          color: COLOR.navy,
        });
        const chip = safe(CHIP[p.type]);
        const cw = face.medium.widthOfTextAtSize(chip, 8) + 16;
        rounded(M + width - cw, y - 16, cw, 16, 8, { borderColor: COLOR.line, borderWidth: 0.6 });
        page.drawText(chip, {
          x: M + width - cw + 8,
          y: y - 12,
          size: 8,
          font: face.medium,
          color: COLOR.navy,
        });
        y -= 26;
        page.drawText(safe(TITLE[p.type]), {
          x: M,
          y: y - 24,
          size: 24,
          font: face.jakarta,
          color: COLOR.navy,
        });
        y -= 28;
        page.drawText(clip(address || 'Ohne Adresse', face.regular, 13, width), {
          x: M,
          y: y - 13,
          size: 13,
          font: face.regular,
          color: COLOR.text,
        });
        y -= 18;
        const meta = `Übergabe am ${fmtDay(p.handoverOn)} · ${number}${p.inspector ? ` · Erstellt von ${p.inspector}` : ''}`;
        page.drawText(clip(meta, face.regular, 9, width), {
          x: M,
          y: y - 9,
          size: 9,
          font: face.regular,
          color: COLOR.muted,
        });
        y -= 14;
      },
    },
    null,
  );

  const landlordLines = [
    p.landlord.name,
    [p.landlord.email, p.landlord.phone].filter(Boolean).join(' · '),
  ].filter(Boolean);
  const tenant = p.tenants[0];
  const tenantLines = tenant
    ? [
        tenant.name,
        [tenant.email, tenant.newAddress ? `neue Anschrift: ${tenant.newAddress}` : '']
          .filter(Boolean)
          .join(' · '),
      ].filter(Boolean)
    : [];
  const colW = width / 2 - 14;
  const fold = (lines: string[]) =>
    (lines.length ? lines : ['–']).flatMap((line) => wrap(line, face.regular, 10, colW));
  const leftLines = fold(landlordLines);
  const rightLines = fold(tenantLines);
  const partyLines = Math.max(leftLines.length, rightLines.length, 1);
  await place(
    {
      id: 'section:parties',
      height: 28 + 20 + partyLines * 13,
      draw() {
        section('01', 'Beteiligte').draw();
        const top = y;
        page.drawText('Vermieter / Verwaltung', {
          x: M,
          y: top - 8,
          size: 8,
          font: face.medium,
          color: COLOR.muted,
        });
        page.drawText('Mieterin / Mieter', {
          x: M + width / 2,
          y: top - 8,
          size: 8,
          font: face.medium,
          color: COLOR.muted,
        });
        let left = top - 22;
        for (const line of leftLines) {
          page.drawText(line, { x: M, y: left, size: 10, font: face.regular, color: COLOR.text });
          left -= 13;
        }
        let right = top - 22;
        for (const line of rightLines) {
          page.drawText(line, {
            x: M + width / 2,
            y: right,
            size: 10,
            font: face.regular,
            color: COLOR.text,
          });
          right -= 13;
        }
        y = Math.min(left, right) - 4;
      },
    },
    null,
  );

  const kpis = [
    { v: String(checkedRooms), t: 'Räume geprüft', warn: false },
    { v: String(defects.length), t: 'Mängel', warn: defects.length > 0 },
    { v: String(p.meters.length), t: 'Zähler abgelesen', warn: false },
    { v: String(keySum), t: 'Schlüssel übergeben', warn: false },
  ];
  await place(
    {
      id: 'cover:kpis',
      height: 64,
      draw() {
        const gap = 8;
        const w = (width - gap * 3) / 4;
        for (const [i, kpi] of kpis.entries()) {
          const x = M + i * (w + gap);
          rounded(x, y - 56, w, 56, 6, { color: COLOR.band });
          page.drawText(kpi.v, {
            x: x + 10,
            y: y - 30,
            size: 20,
            font: face.jakarta,
            color: kpi.warn ? COLOR.defect : COLOR.navy,
          });
          page.drawText(clip(kpi.t, face.regular, 8, w - 20), {
            x: x + 10,
            y: y - 46,
            size: 8,
            font: face.regular,
            color: COLOR.muted,
          });
        }
        y -= 64;
      },
    },
    null,
  );

  const cols = [36, 78, 96, width - 290, 44, 36];
  const overviewRows: Ink[] = defects.length
    ? defects.map((item) => ({
        height: 18,
        draw() {
          const figLabel =
            item.figs.length > 1
              ? `${item.figs[0]}–${item.figs[item.figs.length - 1]}`
              : item.figs.length
                ? String(item.figs[0])
                : '–';
          const cells = [item.m, item.room, item.element, item.description, figLabel];
          let x = M;
          cells.forEach((cell, i) => {
            const col = cols[i] ?? 36;
            const max = col - 4;
            const line =
              i === 3 ? clip(cell, face.regular, 9, max) : (wrap(cell, face.regular, 9, max)[0] ?? '');
            const tw = face.regular.widthOfTextAtSize(line, 9);
            page.drawText(line, {
              x: i === 4 ? x + col - tw - 4 : x,
              y: y - 11,
              size: 9,
              font: face.regular,
              color: COLOR.text,
            });
            x += col;
          });
          slots.push({ page, x: M + width, y: y - 11, block: item.key, align: 'right' });
          rule(y - 16);
          y -= 18;
        },
      }))
    : [
        {
          height: 16,
          draw() {
            page.drawText('Keine Mängel.', {
              x: M,
              y: y - 10,
              size: 9,
              font: face.regular,
              color: COLOR.muted,
            });
            y -= 16;
          },
        },
      ];
  const headRow: Ink = {
    height: 16,
    draw() {
      const heads = ['Nr.', 'Raum', 'Element', 'Beschreibung', 'Abb.', 'Seite'];
      let x = M;
      heads.forEach((label, i) => {
        const col = cols[i] ?? 36;
        const tw = face.medium.widthOfTextAtSize(label, 8);
        page.drawText(label, {
          x: i >= 4 ? x + col - tw - 4 : x,
          y: y - 8,
          size: 8,
          font: face.medium,
          color: COLOR.muted,
        });
        x += col;
      });
      rule(y - 12);
      y -= 16;
    },
  };
  await place(
    {
      id: 'section:overview',
      height: 28 + headRow.height + overviewRows.reduce((sum, row) => sum + row.height, 0),
      chunks: [
        section('02', 'Mängelübersicht'),
        {
          height: headRow.height + (overviewRows[0]?.height ?? 0),
          draw() {
            headRow.draw();
            overviewRows[0]?.draw();
          },
        },
        ...overviewRows.slice(1),
      ],
      draw() {
        section('02', 'Mängelübersicht').draw();
        headRow.draw();
        for (const row of overviewRows) row.draw();
      },
    },
    null,
  );

  const equip = [
    `${p.features.roomCount} Zimmer`,
    p.features.kitchen === 'fitted'
      ? 'Einbauküche'
      : p.features.kitchen === 'basic'
        ? 'Küche'
        : 'keine Küche',
    `${p.features.bathroomCount} Bad`,
    p.features.guestWc ? 'Gäste-WC' : '',
    p.features.outdoor !== 'none'
      ? { balcony: 'Balkon', terrace: 'Terrasse', loggia: 'Loggia', wintergarden: 'Wintergarten' }[
          p.features.outdoor
        ]
      : '',
    p.features.basement ? 'Keller' : '',
    `Elektro unter Putz: ${p.features.elektroUnterPutz ? 'Ja' : 'Nein'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const labelW = 92;
  const valueX = M + labelW;
  const valueW = width - labelW;
  const kv = (label: string, value: string): Ink => {
    const h = Math.max(16, textH(value, 9.5, face.regular, valueW));
    return {
      height: h,
      draw() {
        const top = y;
        page.drawText(label, { x: M, y: top - 10, size: 8.5, font: face.medium, color: COLOR.muted });
        paintText(value, 9.5, face.regular, COLOR.text, valueX, 0, valueW);
        if (y > top - h) y = top - h;
      },
    };
  };
  const objectBits: Ink[] = [section('03', 'Objekt'), kv('Ausstattung', equip)];
  if (moveIn) objectBits.push(kv('Einzug am', fmtDay(moveIn)));
  if (moveOut) objectBits.push(kv('Auszug zum', fmtDay(moveOut)));
  if (p.type === 'abnahme') {
    objectBits.push({
      height: 16,
      draw() {
        const top = y;
        page.drawText('Vorbehalt', { x: M, y: top - 10, size: 8.5, font: face.medium, color: COLOR.muted });
        const lead = 'Erklärt – siehe Seite ';
        page.drawText(lead, { x: valueX, y: top - 10, size: 9.5, font: face.regular, color: COLOR.text });
        slots.push({
          page,
          x: valueX + face.regular.widthOfTextAtSize(lead, 9.5),
          y: top - 10,
          block: 'section:reservation',
          align: 'left',
        });
        y = top - 16;
      },
    });
  }
  await place(
    {
      id: 'section:object',
      height: objectBits.reduce((sum, bit) => sum + bit.height, 0),
      draw() {
        for (const bit of objectBits) bit.draw();
      },
    },
    null,
  );

  let needRoomsHeading = true;
  for (const [roomIndex, room] of p.rooms.entries()) {
    roomHasInk = false;
    const roomNo = roomIndex + 1;
    const cont = { label: room.label, id: room.id };
    const defectIds = Object.entries(room.checks)
      .filter(([, state]) => state === 'defect')
      .map(([id]) => id);
    const head = planHead(room, roomNo, defectIds.length);
    const pieces: Piece[] = [];
    for (const row of rowsFor(room, roomNo)) {
      if (row.state === 'defect') pieces.push(await planDefect(room, row.checkId, row.n));
      else
        pieces.push({
          id: `check:${room.id}:${row.n}`,
          ...planRow(row.n, row.label, row.state, row.details, ''),
        });
    }
    const tail = planTail(room);
    const prefix: Piece[] = needRoomsHeading ? [{ id: 'section:rooms', ...section('04', 'Räume') }] : [];
    const headPiece: Piece = { id: `room-head:${room.id}`, ...head };
    const whole = [...prefix, headPiece, ...pieces, { id: `room-tail:${room.id}`, ...tail }];
    const sumH = (parts: Piece[]) => parts.reduce((sum, part) => sum + part.height, 0);
    if (defectIds.length === 0 && sumH(whole) <= BUDGET) {
      await placeTogether(whole, cont);
      needRoomsHeading = false;
      roomHasInk = false;
      continue;
    }
    const three = pieces.slice(0, Math.min(3, pieces.length));
    const fixed = (needRoomsHeading ? 28 : 0) + head.height;
    const first = pieces[0];
    let opening: Piece[] = three;
    let rest = pieces.slice(three.length);
    if (fixed + sumH(three) > BUDGET) {
      if (first && fixed + first.height <= BUDGET) {
        opening = [first];
        rest = pieces.slice(1);
      } else if (first?.chunks?.[0] && fixed + first.chunks[0].height <= BUDGET) {
        const chunk = first.chunks[0];
        opening = [{ id: first.id, height: chunk.height, draw: () => chunk.draw() }];
        rest = [
          ...first.chunks
            .slice(1)
            .map((part) => ({ id: first.id, height: part.height, draw: () => part.draw() })),
          ...pieces.slice(1),
        ];
      } else {
        opening = [];
        rest = pieces;
      }
    }
    await placeTogether([...prefix, headPiece, ...opening], cont);
    needRoomsHeading = false;
    for (const piece of rest) await place(piece, cont);
    await place({ id: `room-tail:${room.id}`, ...tail }, cont);
    roomHasInk = false;
  }

  const meterHeader: Ink = {
    height: 16,
    draw() {
      const heads = [
        ['Zähler', 110, false],
        ['Zählernummer', 120, false],
        ['Stand', 72, true],
        ['Einheit', 52, false],
        ['Ort', 80, false],
      ] as const;
      let x = M;
      for (const [label, col, right] of heads) {
        const tw = face.medium.widthOfTextAtSize(label, 8);
        page.drawText(label, {
          x: right ? x + col - tw - 10 : x,
          y: y - 8,
          size: 8,
          font: face.medium,
          color: COLOR.muted,
        });
        x += col;
      }
      page.drawText('Abb.', { x: M + width - 24, y: y - 8, size: 8, font: face.medium, color: COLOR.muted });
      rule(y - 12);
      y -= 16;
    },
  };
  const meterInks: Ink[] = [meterHeader];
  if (!p.meters.length) {
    meterInks.push({
      height: 16,
      draw() {
        page.drawText('Keine Zähler erfasst.', {
          x: M,
          y: y - 10,
          size: 9,
          font: face.regular,
          color: COLOR.muted,
        });
        y -= 16;
      },
    });
  }
  for (const meter of p.meters) {
    const imgs: Array<PDFImage | null> = [];
    for (const id of meter.photoIds) imgs.push(await loadImg(id));
    const nums = meter.photoIds.map(() => ++fig);
    const reading = formatReading(meter.reading);
    meterInks.push({
      height: 18 + Math.ceil(imgs.length / 2) * rowH,
      draw() {
        const cells = [
          METER_LABEL[meter.kind].label,
          meter.number || '–',
          reading,
          METER_LABEL[meter.kind].unit,
          meter.location || '–',
        ];
        const meterCols = [110, 120, 72, 52, 80];
        let x = M;
        cells.forEach((cell, i) => {
          const col = meterCols[i] ?? 40;
          const text = safe(cell);
          const tw = face.regular.widthOfTextAtSize(text, 9);
          const pad = i === 2 ? 10 : i === 3 ? 4 : 0;
          page.drawText(text, {
            x: i === 2 ? x + col - tw - pad : x + pad,
            y: y - 11,
            size: 9,
            font: face.regular,
            color: COLOR.text,
          });
          x += col;
        });
        page.drawText(nums.length ? String(nums[0]) : '–', {
          x: M + width - 20,
          y: y - 11,
          size: 9,
          font: face.regular,
          color: COLOR.text,
        });
        rule(y - 16);
        y -= 18;
        for (let i = 0; i < imgs.length; i += 2) {
          paintFrames(imgs.slice(i, i + 2), `Zähler ${METER_LABEL[meter.kind].label}`, nums.slice(i, i + 2));
        }
      },
    });
  }
  const meterConfirm =
    'Der Mieter bestätigt, dass er die Zählerstände gemeinsam mit dem Verwalter/Vermieter abgelesen hat.';
  await place(
    {
      id: 'section:meters',
      height:
        28 +
        meterInks.reduce((sum, ink) => sum + ink.height, 0) +
        textH(meterConfirm, 8.5, face.regular, width, 4),
      chunks: [
        section('05', 'Zählerstände'),
        ...meterInks,
        {
          height: textH(meterConfirm, 8.5, face.regular, width, 4),
          draw: () => paintText(meterConfirm, 8.5, face.regular, COLOR.muted, M, 4, width),
        },
      ],
      draw() {
        section('05', 'Zählerstände').draw();
        for (const ink of meterInks) ink.draw();
        paintText(meterConfirm, 8.5, face.regular, COLOR.muted, M, 4, width);
      },
    },
    null,
  );

  const keyConfirm =
    'Der Mieter bestätigt, dass sich außer den hier festgehaltenen Schlüsseln keine weiteren Schlüssel in seinem Besitz befinden oder befanden.';
  const keyRows: Ink[] = p.keys.map((key) => ({
    height: 16,
    draw() {
      const label = key.kind === 'other' ? key.label || 'Sonstiger' : KEY_LABEL[key.kind];
      page.drawText(safe(label), { x: M, y: y - 10, size: 9, font: face.regular, color: COLOR.text });
      page.drawText(String(key.count), {
        x: M + 180,
        y: y - 10,
        size: 9,
        font: face.regular,
        color: COLOR.text,
      });
      page.drawText('—', { x: M + 250, y: y - 10, size: 9, font: face.regular, color: COLOR.muted });
      rule(y - 14);
      y -= 16;
    },
  }));
  keyRows.push({
    height: 16,
    draw() {
      page.drawText('Es fehlen', { x: M, y: y - 10, size: 9, font: face.semi, color: COLOR.text });
      page.drawText(String(missingKeys), {
        x: M + 180,
        y: y - 10,
        size: 9,
        font: face.semi,
        color: COLOR.text,
      });
      y -= 16;
    },
  });
  await place(
    {
      id: 'section:keys',
      height:
        28 +
        16 +
        keyRows.reduce((sum, row) => sum + row.height, 0) +
        textH(keyConfirm, 8.5, face.regular, width, 4),
      draw() {
        section('06', 'Schlüssel').draw();
        for (const [label, x] of [
          ['Schlüssel', M],
          ['Übergeben', M + 180],
          ['Bemerkung', M + 250],
        ] as const) {
          page.drawText(label, { x, y: y - 8, size: 8, font: face.medium, color: COLOR.muted });
        }
        rule(y - 12);
        y -= 16;
        for (const row of keyRows) row.draw();
        paintText(keyConfirm, 8.5, face.regular, COLOR.muted, M, 4, width);
      },
    },
    null,
  );

  if (p.generalNote.trim()) {
    await place(
      {
        id: 'section:notes',
        height: 20 + textH(p.generalNote, 10, face.regular, TEXT_W),
        draw() {
          drawTracked('ANMERKUNGEN', M, y - 8, 7.5, face.semi, COLOR.accent);
          y -= 16;
          paintText(p.generalNote, 10, face.regular, COLOR.text);
        },
      },
      null,
    );
  }

  if (p.type === 'abnahme') {
    const pad = 10;
    const inner = width - pad * 2;
    const body =
      'Ausschluss des deklaratorischen Schuldanerkenntnisses: Der Vermieter bzw. Verwalter behält sich vor, Mängel und Schäden, die erst nach der Abnahme bekannt werden, gegenüber dem ausscheidenden Mieter geltend zu machen.';
    const bodyLines = wrap(body, face.regular, 9.5, inner);
    const boxH = pad + 14 + bodyLines.length * 13.5 + pad;
    await place(
      {
        id: 'section:reservation',
        height: 28 + boxH + 8,
        draw() {
          section('07', 'Vorbehalt').draw();
          const top = y;
          page.drawRectangle({
            x: M,
            y: top - boxH,
            width,
            height: boxH,
            borderColor: COLOR.line,
            borderWidth: 0.6,
          });
          page.drawText('Vorbehalt der Verwaltung', {
            x: M + pad,
            y: top - pad - 9,
            size: 9,
            font: face.semi,
            color: COLOR.navy,
          });
          let lineY = top - pad - 14;
          for (const line of bodyLines) {
            page.drawText(line, {
              x: M + pad,
              y: lineY - 9.5,
              size: 9.5,
              font: face.regular,
              color: COLOR.text,
            });
            lineY -= 13.5;
          }
          y = top - boxH - 8;
        },
      },
      null,
    );
  }

  const signers = requiredSigners(p);
  const confirm =
    'Die Unterzeichnenden bestätigen, dass dieses Protokoll vor Ort gemeinsam aufgenommen wurde.';
  const signH =
    28 +
    textH(confirm, 8.5, face.regular, TEXT_W, 8) +
    Math.ceil(signers.length / 2) * 104 +
    (p.seal ? 64 : 20);
  await place(
    {
      id: 'signatures',
      height: signH,
      draw: async () => {
        section('08', 'Unterschriften').draw();
        paintText(confirm, 8.5, face.regular, COLOR.muted, M, 8, TEXT_W);
        const colW = (width - 28) / 2;
        for (let i = 0; i < signers.length; i += 2) {
          const pair = signers.slice(i, i + 2);
          const top = y;
          for (const [col, signer] of pair.entries()) {
            const x = M + col * (colW + 28);
            const sig = signatureFor(p, signer);
            page.drawLine({
              start: { x, y: top - 54 },
              end: { x: x + colW, y: top - 54 },
              thickness: 0.75,
              color: COLOR.text,
            });
            if (sig) {
              const raw = sig.image.includes(',') ? (sig.image.split(',')[1] ?? sig.image) : sig.image;
              const img = await doc.embedPng(raw);
              const scale = Math.min(colW / img.width, 48 / img.height);
              page.drawImage(img, { x, y: top - 52, width: img.width * scale, height: img.height * scale });
            }
            const role = signer.role === 'landlord' ? 'Vermieter / Verwaltung' : 'Mieterin / Mieter';
            page.drawText(safe(signer.name || '–'), {
              x,
              y: top - 68,
              size: 9,
              font: face.medium,
              color: COLOR.navy,
            });
            page.drawText(role, { x, y: top - 80, size: 8.5, font: face.regular, color: COLOR.muted });
            const when = sig
              ? `${p.property.city}, ${fmtDay(sig.signedAt)}, ${fmtClock(sig.signedAt)} Uhr`
              : 'Ort, Datum, Uhrzeit';
            page.drawText(safe(when), { x, y: top - 92, size: 8.5, font: face.regular, color: COLOR.muted });
          }
          y = top - 104;
        }
        if (p.seal) {
          const sentence =
            'SHA-256 über alle Protokolldaten, Unterschriften und Fotos. Jede nachträgliche Änderung ergibt eine andere Prüfsumme.';
          const lines = wrap(sentence, face.regular, 7.5, width - 20);
          const boxH = 28 + lines.length * 10;
          rounded(M, y - boxH, width, boxH, 6, { color: COLOR.band });
          page.drawText('Prüfsumme', { x: M + 10, y: y - 14, size: 9, font: face.semi, color: COLOR.navy });
          lines.forEach((line, i) => {
            page.drawText(line, {
              x: M + 10,
              y: y - 26 - i * 10,
              size: 7.5,
              font: face.regular,
              color: COLOR.muted,
            });
          });
          page.drawText(p.seal.hash, {
            x: M + 10,
            y: y - boxH + 8,
            size: 7.5,
            font: face.regular,
            color: COLOR.text,
          });
          y -= boxH + 8;
        } else {
          paintText('Entwurf – noch keine Prüfsumme.', 9, face.semi, COLOR.defect);
        }
      },
    },
    null,
  );

  for (const slot of slots) {
    const hit = marks.find((mark) => mark.block === slot.block);
    const label = hit ? String(hit.page) : '–';
    const size = slot.align === 'left' ? 9.5 : 9;
    const tw = face.regular.widthOfTextAtSize(label, size);
    const x = slot.align === 'right' ? slot.x - tw : slot.x;
    slot.page.drawText(label, {
      x,
      y: slot.y,
      size,
      font: face.regular,
      color: COLOR.text,
    });
    if (hit) {
      const mark = { block: `overview:${slot.block}`, page: hit.page, y: slot.y, height: 9 };
      marks.push(mark);
      layout?.push(mark);
    }
  }

  const pages = doc.getPages();
  for (const [i, pg] of pages.entries()) {
    const saved = page;
    page = pg;
    const footY = 10 * MM;
    if (i > 0) {
      icon(M, A4[1] - 10 * MM - 11, 10);
      const chip = safe(CHIP[p.type]);
      pg.drawText(chip, {
        x: M + 14,
        y: A4[1] - 10 * MM - 1,
        size: 8,
        font: face.medium,
        color: COLOR.navy,
      });
      const chipW = face.medium.widthOfTextAtSize(chip, 8);
      const addrMax = A4[0] - M - (M + 14 + chipW + 10);
      const right = clip(addressLine, face.regular, 8, Math.max(40, addrMax));
      pg.drawText(right, {
        x: A4[0] - M - face.regular.widthOfTextAtSize(right, 8),
        y: A4[1] - 10 * MM - 1,
        size: 8,
        font: face.regular,
        color: COLOR.muted,
      });
      pg.drawLine({
        start: { x: M, y: A4[1] - 10 * MM - 10 },
        end: { x: A4[0] - M, y: A4[1] - 10 * MM - 10 },
        thickness: 0.5,
        color: COLOR.line,
      });
    }
    pg.drawLine({
      start: { x: M, y: footY + 14 },
      end: { x: A4[0] - M, y: footY + 14 },
      thickness: 0.5,
      color: COLOR.line,
    });
    if (i === pages.length - 1) {
      icon(M, footY + 2, 10);
      pg.drawText('Erstellt mit Schlüsselmoment', {
        x: M + 14,
        y: footY + 4,
        size: 7.5,
        font: face.regular,
        color: COLOR.muted,
      });
    }
    const checksum = p.seal ? `Prüfsumme ${shortHash(p.seal.hash)}` : 'Entwurf';
    const left = `Protokoll-Nr. ${number} · ${checksum}`;
    const pageLabel = `Seite ${i + 1} von ${pages.length}`;
    const pageW = face.regular.widthOfTextAtSize(pageLabel, 7.5);
    pg.drawText(clip(left, face.regular, 7.5, width - pageW - 12), {
      x: M,
      y: footY - 8,
      size: 7.5,
      font: face.regular,
      color: COLOR.muted,
    });
    pg.drawText(pageLabel, {
      x: A4[0] - M - pageW,
      y: footY - 8,
      size: 7.5,
      font: face.regular,
      color: COLOR.muted,
    });
    page = saved;
  }

  return doc.save();
}
