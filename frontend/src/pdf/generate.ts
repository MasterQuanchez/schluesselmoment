/**
 * PDF auf dem Gerät (pdf-lib). Layout „Klar“ nach docs/design/vorschlag-klar.html.
 * Icon-Pfade aus docs/design/klar-icons.json (viewBox 24, Strich 1.7).
 * Blöcke werden gemessen und nicht vorgezogen (SM-17). Fotos nur im Anhang.
 */
import fontkit from '@pdf-lib/fontkit';
import {
  degrees,
  LineCapStyle,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from 'pdf-lib';
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
  text?: string;
};

/** Inter Regular: x-Höhe / em. */
export const PDF_X_HEIGHT = 1118 / 2048;

const A4: [number, number] = [595.28, 841.89];
const MM = 72 / 25.4;
const M = 20 * MM;
const TOP = 22 * MM;
const BOTTOM = 18 * MM;
const BUDGET = A4[1] - TOP - BOTTOM;
const PHOTO_H = 112 * MM;
const SECTION_H = 40;
const ROOM_HEAD_H = 36;
const NOTE_RULES = 12;
const NOTE_GAP = 19;
const HAND_NOTE =
  'Handschriftliche Ergänzungen nach dem Abschluss in der App sind nicht von der Prüfsumme erfasst; bitte von beiden Seiten abzeichnen.';

const hex = (value: string) =>
  rgb(
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  );

const COLOR = {
  text: hex('#1A2230'),
  muted: hex('#5B6675'),
  light: hex('#8A94A3'),
  navy: hex('#0B1F3A'),
  ok: hex('#0E6B4D'),
  okBg: hex('#EAF6F0'),
  okLine: hex('#9FD3BF'),
  defect: hex('#8A5300'),
  warnBg: hex('#FBF1E3'),
  warnLine: hex('#E9C48A'),
  line: hex('#E3E8EF'),
  noteLine: hex('#C9D1DC'),
  iconBg: hex('#EEF2F8'),
  photoBg: hex('#F4F6F9'),
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

/** Pfade 1:1 aus docs/design/klar-icons.json. */
const ROOM_SVG: Record<string, string> = {
  Flur: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="14.5" cy="12" r=".9" fill="currentColor"/>',
  Küche:
    '<path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 10h20"/><path d="M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/>',
  Bad: '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M7 19l-1 2M17 19l1 2"/>',
  'Zimmer 1 · Wohnzimmer':
    '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
  'Zimmer 2 · Schlafzimmer':
    '<path d="M3 19V6"/><path d="M3 15h18v4"/><path d="M3 11h11a4 4 0 0 1 4 4"/><rect x="5" y="8" width="4" height="3" rx="1"/>',
  Balkon:
    '<path d="M3 11h18"/><path d="M3 21h18"/><path d="M5 11v10M9 11v10M15 11v10M19 11v10"/><path d="M12 3v4M9.5 5.5L12 3l2.5 2.5"/>',
  Keller: '<path d="M4 21v-6h4v-4h4V7h4V3h4"/><path d="M4 21h16"/>',
  'Eingangstür & Briefkasten':
    '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M3 10l9 5 9-5"/><path d="M12 8V3h4"/>',
  'Abschluss-Prüfungen':
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 12.5l2 2 4.5-4.5"/>',
};

const SECTION_SVG = {
  Mängel:
    '<path d="M12 3l9.5 17H2.5z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  'Objekt und Beteiligte':
    '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><circle cx="12" cy="13" r="2"/><path d="M8.5 20a3.5 3.5 0 0 1 7 0"/>',
  Räume: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h9V3M12 12v9"/>',
  Zählerstände: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><path d="M3 19h18"/>',
  Schlüssel: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M16 7l3 3M14 9l2 2"/>',
  Anmerkungen:
    '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h4"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  Unterschriften: '<path d="M3 19c3-6 5-10 7-10s-1 9 2 9 3-6 5-6 2 4 4 4"/><path d="M3 22h18"/>',
  Fotos:
    '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l1.5-2h5L16 6"/><circle cx="12" cy="13" r="3.5"/>',
};

const STATUS_SVG = {
  ok: '<circle cx="8" cy="8" r="7"/><path d="M4.8 8.2l2.1 2.1 4.3-4.4"/>',
  mangel: '<path d="M8 1.6l7 12.4H1z" fill="currentColor"/>',
};

const FONT_URL = {
  jakarta: new URL('./fonts/PlusJakartaSans-SemiBold.ttf', import.meta.url).href,
  regular: new URL('./fonts/Inter-Regular.ttf', import.meta.url).href,
  medium: new URL('./fonts/Inter-Medium.ttf', import.meta.url).href,
  semi: new URL('./fonts/Inter-SemiBold.ttf', import.meta.url).href,
};

type Ink = { height: number; draw: () => void | Promise<void> };
type Piece = Ink & { id: string; chunks?: Ink[] };
type Face = { jakarta: PDFFont; regular: PDFFont; medium: PDFFont; semi: PDFFont; oblique: PDFFont };
type Rgb = ReturnType<typeof rgb>;
type IconPart = { d: string; fill: boolean };
type Fig = { n: number; photoId: string; caption: string; defectKey?: string };
type DefectInfo = {
  key: string;
  m: string;
  roomId: string;
  room: string;
  checkId: string;
  element: string;
  description: string;
  figs: number[];
};

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

/** Zimmer nach Raumtyp, sonst das Sofa. Alle anderen Vorlagen haben ein eigenes Icon. */
export function roomIconKey(room: { templateId: string; label: string }): string {
  switch (room.templateId) {
    case 'hallway':
      return 'Flur';
    case 'kitchenBasic':
    case 'kitchenFitted':
      return 'Küche';
    case 'bathroom':
    case 'guestWc':
      return 'Bad';
    case 'outdoor':
    case 'wintergarden':
      return 'Balkon';
    case 'basement':
      return 'Keller';
    case 'entrance':
      return 'Eingangstür & Briefkasten';
    case 'final':
      return 'Abschluss-Prüfungen';
    default:
      return /schlaf/i.test(room.label) ? 'Zimmer 2 · Schlafzimmer' : 'Zimmer 1 · Wohnzimmer';
  }
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

function figLabel(nums: number[]): string {
  if (nums.length === 0) return '–';
  const first = nums[0] ?? 0;
  if (nums.length === 1) return `Abb. ${first}`;
  const last = nums[nums.length - 1] ?? first;
  const contiguous = nums.every((n, index) => n === first + index);
  return contiguous ? `Abb. ${first}–${last}` : nums.map((n) => `Abb. ${n}`).join(', ');
}

function attr(source: string, name: string): string | undefined {
  return new RegExp(`${name}="([^"]*)"`).exec(source)?.[1];
}

function circlePath(cx: number, cy: number, r: number): string {
  const k = r * 0.5522847498;
  return [
    `M ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}`,
    `C ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} Z`,
  ].join(' ');
}

function rectPath(x: number, y: number, w: number, h: number, rx: number): string {
  const r = Math.min(Math.max(rx, 0), w / 2, h / 2);
  if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`,
  ].join(' ');
}

function iconParts(svg: string): IconPart[] {
  const parts: IconPart[] = [];
  for (const match of svg.matchAll(/<(path|circle|rect)\b([^>]*)\/?>/g)) {
    const kind = match[1];
    const body = match[2] ?? '';
    const fill = /fill="(?!none)/.test(body);
    if (kind === 'path') {
      const d = attr(body, 'd');
      if (d) parts.push({ d, fill });
    } else if (kind === 'circle') {
      parts.push({
        d: circlePath(
          Number(attr(body, 'cx') ?? 0),
          Number(attr(body, 'cy') ?? 0),
          Number(attr(body, 'r') ?? 0),
        ),
        fill,
      });
    } else {
      parts.push({
        d: rectPath(
          Number(attr(body, 'x') ?? 0),
          Number(attr(body, 'y') ?? 0),
          Number(attr(body, 'width') ?? 0),
          Number(attr(body, 'height') ?? 0),
          Number(attr(body, 'rx') ?? 0),
        ),
        fill,
      });
    }
  }
  return parts;
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

const isFinalRoom = (room: Room) => room.templateId === 'final' || room.label.startsWith('Abschluss');

export async function generatePdf(
  p: Protocol,
  loadPhoto: PhotoLoader,
  layout?: PdfLayoutMark[],
  options?: { fonts?: boolean },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const street = p.property.street.trim();
  const zipCity = [p.property.postalCode.trim(), p.property.city.trim()].filter(Boolean).join(' ');
  const address = [street, zipCity].filter(Boolean).join(', ');
  const unit = p.property.unit.trim();
  const addressLine = [address, unit].filter(Boolean).join(' · ') || 'Ohne Adresse';
  doc.setTitle(`${TITLE[p.type]} – ${address || street || 'Ohne Adresse'}`);
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
  const helveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  let face: Face = {
    jakarta: helveticaBold,
    regular: helvetica,
    medium: helvetica,
    semi: helveticaBold,
    oblique: helveticaOblique,
  };
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
        oblique: helveticaOblique,
      };
    } catch (error) {
      console.warn('Schrift nicht geladen. Das PDF nutzt Helvetica.', error);
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
  let continueRoom: Room | null = null;
  const marks: PdfLayoutMark[] = [];
  const number = protocolNumber(p);

  const watch = (target: PDFPage, no: number) => {
    const raw = target.drawText.bind(target);
    const host = target as PDFPage & {
      drawText: (text: string, options?: Parameters<PDFPage['drawText']>[1]) => void;
    };
    host.drawText = (text, textOptions) => {
      raw(text, textOptions);
      if (!text || textOptions?.rotate) return;
      const size = textOptions?.size ?? 0;
      const font = textOptions?.font;
      if (!font || size <= 0) return;
      const x = textOptions?.x ?? 0;
      const mark: PdfLayoutMark = {
        block: 'run',
        page: no,
        y: textOptions?.y ?? 0,
        height: size,
        x,
        width: font.widthOfTextAtSize(text, size),
        text,
      };
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

  const pushMark = (mark: PdfLayoutMark) => {
    marks.push(mark);
    layout?.push(mark);
  };
  const note = (block: string, y0: number, height: number, text?: string) => {
    pushMark({ block, page: pageNo, y: y0, height, text });
  };

  const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if (word === '·') {
        if (!line) continue;
        const kept = `${line} ·`;
        if (f.widthOfTextAtSize(kept, size) <= maxW) line = kept;
        else {
          lines.push(line);
          line = '';
        }
        continue;
      }
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

  const drawTracked = (text: string, x: number, baseline: number, size: number, f: PDFFont, color: Rgb) => {
    let cx = x;
    for (const ch of safe(text)) {
      page.drawText(ch, { x: cx, y: baseline, size, font: f, color });
      cx += f.widthOfTextAtSize(ch, size) + 0.8;
    }
  };

  const drawIcon = (svg: string, left: number, top: number, size: number, color: Rgb, viewBox: number) => {
    const scale = size / viewBox;
    for (const part of iconParts(svg)) {
      page.drawSvgPath(part.d, {
        x: left,
        y: top,
        scale,
        color: part.fill ? color : undefined,
        borderColor: part.fill ? undefined : color,
        borderWidth: part.fill ? 0 : 1.7,
        borderLineCap: LineCapStyle.Round,
      });
    }
  };

  const rounded = (x: number, bottom: number, w: number, h: number, r: number, fill: Rgb, border?: Rgb) => {
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
    page.drawSvgPath(d, {
      x,
      y: bottom + h,
      color: fill,
      borderColor: border,
      borderWidth: border ? 0.75 : 0,
    });
  };

  const brandIcon = (ox: number, bottom: number, size: number) => {
    rounded(ox, bottom, size, size, (121 / 512) * size, COLOR.navy);
    page.drawSvgPath(mapIcon(HOUSE, size), {
      x: ox,
      y: bottom + size,
      borderColor: COLOR.white,
      borderWidth: Math.max(1.05, (11.2 / 512) * size * 3.2),
    });
    page.drawSvgPath(mapIcon(TICK, size), {
      x: ox,
      y: bottom + size,
      borderColor: COLOR.icon,
      borderWidth: Math.max(1.15, (13 / 512) * size * 3.2),
    });
  };

  const hairline = (yLine: number, color: Rgb = COLOR.line, thickness = 0.5) => {
    page.drawLine({
      start: { x: M, y: yLine },
      end: { x: M + width, y: yLine },
      thickness,
      color,
    });
  };

  const drawSection = (label: string, svg: string) => {
    y -= 18;
    const top = y;
    page.drawCircle({ x: M + 8, y: top - 8, size: 8, color: COLOR.navy });
    const iconSize = 9.5;
    const inset = (16 - iconSize) / 2;
    drawIcon(svg, M + inset, top - inset, iconSize, COLOR.white, 24);
    drawTracked(label.toLocaleUpperCase('de-DE'), M + 22, top - 11.5, 8, face.semi, COLOR.navy);
    y = top - 22;
  };

  const section = (label: string, svg: string): Ink => ({
    height: SECTION_H,
    draw() {
      drawSection(label, svg);
    },
  });

  const featureValues = (room: Room, checkId: string) => {
    const def = CHECKS[checkId];
    const parts: string[] = [];
    for (const [attrId, val] of Object.entries(room.details[checkId] ?? {})) {
      if (!val) continue;
      const attribute = def?.attributes?.find((item) => item.id === attrId);
      parts.push(attribute?.options.find((option) => option.id === val)?.label ?? val);
    }
    return parts.join(', ');
  };

  const checkLabel = (checkId: string) => CHECKS[checkId]?.label ?? checkId;

  const defects: DefectInfo[] = [];
  const figs: Fig[] = [];
  let figNo = 1;
  let mangelNo = 1;
  for (const room of p.rooms) {
    for (const [checkId, state] of Object.entries(room.checks)) {
      if (state !== 'defect') continue;
      const photoIds = room.defects[checkId]?.photoIds ?? [];
      const nums: number[] = [];
      const element = checkLabel(checkId);
      const description = (room.defects[checkId]?.description ?? '').trim();
      const key = `defect:${room.id}:${checkId}`;
      const m = `M${mangelNo}`;
      for (const photoId of photoIds) {
        nums.push(figNo);
        const caption = `Abb. ${figNo} · ${m} · ${room.label} · ${element}${description ? ` – ${description}` : ''}`;
        figs.push({ n: figNo, photoId, caption, defectKey: key });
        figNo += 1;
      }
      defects.push({ key, m, roomId: room.id, room: room.label, checkId, element, description, figs: nums });
      mangelNo += 1;
    }
  }
  for (const meter of p.meters) {
    const meta = METER_LABEL[meter.kind];
    const reading = formatReading(meter.reading);
    for (const photoId of meter.photoIds) {
      const caption = `Abb. ${figNo} · Zähler · ${meta.label}, Nr. ${meter.number.trim() || '–'} – Stand ${reading} ${meta.unit}`;
      figs.push({ n: figNo, photoId, caption });
      figNo += 1;
    }
  }

  const defectOf = (roomId: string, checkId: string) =>
    defects.find((item) => item.roomId === roomId && item.checkId === checkId);

  const pillFor = (room: Room) => {
    const count = Object.values(room.checks).filter((state) => state === 'defect').length;
    if (count > 0) {
      return { label: count === 1 ? '1 Mangel' : `${count} Mängel`, tone: 'warn' as const };
    }
    if (Object.values(room.checks).some((state) => state === 'open')) {
      return { label: 'offen', tone: 'open' as const };
    }
    return { label: 'in Ordnung', tone: 'ok' as const };
  };

  const drawRoomHead = (room: Room, title: string) => {
    y -= 12;
    const top = y;
    const key = roomIconKey(room);
    page.drawCircle({ x: M + 10, y: top - 10, size: 10, color: COLOR.iconBg });
    drawIcon(ROOM_SVG[key] ?? ROOM_SVG['Zimmer 1 · Wohnzimmer'] ?? '', M + 4, top - 4, 12, COLOR.navy, 24);
    pushMark({
      block: `room-icon:${room.id}:${key}`,
      page: pageNo,
      y: top,
      height: 20,
      x: M,
      width: 20,
      text: key,
    });
    const pill = pillFor(room);
    const tone =
      pill.tone === 'warn'
        ? { bg: COLOR.warnBg, border: COLOR.warnLine, color: COLOR.defect, svg: STATUS_SVG.mangel }
        : pill.tone === 'ok'
          ? { bg: COLOR.okBg, border: COLOR.okLine, color: COLOR.ok, svg: STATUS_SVG.ok }
          : { bg: COLOR.white, border: COLOR.line, color: COLOR.light, svg: '' };
    const tw = face.semi.widthOfTextAtSize(pill.label, 8);
    const iconS = 9;
    const pillW = 6 + (tone.svg ? iconS + 3 : 0) + tw + 8;
    const pillH = 16;
    const pillX = M + width - pillW;
    const mid = top - 10;
    rounded(pillX, mid - pillH / 2, pillW, pillH, 8, tone.bg, tone.border);
    if (tone.svg) drawIcon(tone.svg, pillX + 6, mid + iconS / 2, iconS, tone.color, 16);
    const textX = pillX + 6 + (tone.svg ? iconS + 3 : 0);
    page.drawText(pill.label, {
      x: textX,
      y: mid - (PDF_X_HEIGHT * 8) / 2,
      size: 8,
      font: face.semi,
      color: tone.color,
    });
    const titleX = M + 27;
    page.drawText(clip(title, face.jakarta, 11.5, Math.max(40, pillX - titleX - 8)), {
      x: titleX,
      y: top - 15,
      size: 11.5,
      font: face.jakarta,
      color: COLOR.navy,
    });
    hairline(top - 24, COLOR.navy, 0.75);
    y = top - 24;
  };

  const remaining = () => y - BOTTOM;
  const openPage = (cont: { id: string } | null) => {
    page = doc.addPage(A4);
    pageNo += 1;
    watch(page, pageNo);
    paintMark(page);
    y = A4[1] - TOP;
    if (!cont || !continueRoom) return;
    const y0 = y;
    drawRoomHead(continueRoom, `${continueRoom.label} (Fortsetzung)`);
    note(`continuation:${cont.id}`, y0, y0 - y);
  };

  const drawPiece = async (piece: Piece) => {
    const y0 = y;
    await piece.draw();
    note(piece.id, y0, y0 - y);
  };

  const placeTogether = async (parts: Piece[]) => {
    for (const part of parts) await drawPiece(part);
  };

  const place = async (piece: Piece, cont: { id: string } | null) => {
    const chunks = piece.chunks && piece.height > BUDGET ? piece.chunks : [piece];
    for (const chunk of chunks) {
      if (chunk.height > remaining()) openPage(cont && roomHasInk ? cont : null);
      const y0 = y;
      await chunk.draw();
      note(piece.id, y0, y0 - y);
      if (cont) roomHasInk = true;
    }
  };

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

  const checkedRooms = p.rooms.filter((room) => {
    if (room.completedAt) return true;
    const states = Object.values(room.checks);
    return states.length > 0 && states.every((state) => state !== 'open');
  }).length;
  const keySum = p.keys.reduce((sum, key) => sum + key.count, 0);
  const moveIn = p.type === 'uebergabe' && p.moveInOn ? p.moveInOn : '';
  const moveOut = p.type === 'abnahme' && p.moveOutOn ? p.moveOutOn : '';

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

  const metaParts = [
    `Übergabe am ${fmtDay(p.handoverOn)}`,
    moveIn ? `Einzug am ${fmtDay(moveIn)}` : '',
    moveOut ? `Auszug am ${fmtDay(moveOut)}` : '',
    `Protokoll-Nr. ${number}`,
    p.inspector.trim() ? `erstellt von ${p.inspector.trim()}` : '',
  ].filter(Boolean);
  const meta = metaParts.join(' · ');
  const addrLines = wrap(addressLine, face.regular, 12, width);
  const metaLines = wrap(meta, face.regular, 8.5, width);
  const coverH = 34 + 28 + addrLines.length * 17 + metaLines.length * 12 + 52;
  await place(
    {
      id: 'cover',
      height: coverH,
      draw() {
        brandIcon(M, y - 18, 18);
        page.drawText('Schlüsselmoment', {
          x: M + 25,
          y: y - 13,
          size: 10,
          font: face.semi,
          color: COLOR.navy,
        });
        const chip = safe(CHIP[p.type]);
        const chipW = face.regular.widthOfTextAtSize(chip, 9);
        page.drawText(chip, {
          x: M + width - chipW,
          y: y - 13,
          size: 9,
          font: face.regular,
          color: COLOR.muted,
        });
        y -= 34;
        page.drawText(TITLE[p.type], { x: M, y: y - 22, size: 22, font: face.jakarta, color: COLOR.navy });
        y -= 28;
        for (const line of addrLines) {
          page.drawText(line, { x: M, y: y - 12, size: 12, font: face.regular, color: COLOR.text });
          y -= 17;
        }
        for (const line of metaLines) {
          page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
          y -= 12;
        }
        y -= 14;
        hairline(y, COLOR.navy, 0.75);
        y -= 9;
        const baseline = y - 10.5;
        const kpis = [
          { n: String(checkedRooms), label: 'Räume geprüft', warn: false },
          { n: String(defects.length), label: 'Mängel', warn: defects.length > 0 },
          { n: String(p.meters.length), label: 'Zähler', warn: false },
          { n: String(keySum), label: 'Schlüssel', warn: false },
        ];
        let kx = M;
        for (const kpi of kpis) {
          const color = kpi.warn ? COLOR.defect : COLOR.navy;
          page.drawText(kpi.n, { x: kx, y: baseline, size: 10.5, font: face.semi, color });
          const nw = face.semi.widthOfTextAtSize(kpi.n, 10.5);
          page.drawText(kpi.label, {
            x: kx + nw + 4,
            y: baseline,
            size: 10.5,
            font: face.regular,
            color: COLOR.text,
          });
          kx += nw + 4 + face.regular.widthOfTextAtSize(kpi.label, 10.5) + 18;
        }
        y -= 10.5 + 9;
        hairline(y);
        y -= 4;
      },
    },
    null,
  );

  const elW = width * 0.36 - 6;
  const stW = width * 0.17 - 6;
  const mkW = width - width * 0.53 - 2;
  const elX = M;
  const stX = M + width * 0.36;
  const mkX = M + width * 0.53;
  const rowLead = 13;
  const rowPad = 3;

  const paintLines = (lines: string[], x: number, top: number, size: number, f: PDFFont, color: Rgb) => {
    for (const [index, line] of lines.entries()) {
      if (!line) continue;
      page.drawText(line, { x, y: top - rowPad - size - index * rowLead, size, font: f, color });
    }
  };

  const tableRow = (
    id: string,
    element: string,
    state: string,
    features: string,
    tone: 'ok' | 'na' | 'open' | 'defect',
  ): Piece => {
    const elementFont = tone === 'defect' ? face.semi : face.regular;
    const elementLines = wrap(element, elementFont, 9.5, elW);
    const stateFont = tone === 'na' ? face.oblique : tone === 'defect' ? face.semi : face.regular;
    const stateLines = wrap(state, stateFont, 9, stW);
    const featureLines = features.trim() ? wrap(features, face.regular, 9, mkW) : [];
    const lines = Math.max(elementLines.length, stateLines.length, featureLines.length, 1);
    const height = rowPad + lines * rowLead + 2;
    return {
      id,
      height,
      draw() {
        const top = y;
        if (tone === 'defect') {
          page.drawRectangle({ x: M, y: top - height, width, height, color: COLOR.warnBg });
        }
        paintLines(elementLines, elX, top, 9.5, elementFont, COLOR.text);
        const stateColor = tone === 'defect' ? COLOR.defect : COLOR.light;
        paintLines(stateLines, stX, top, 9, stateFont, stateColor);
        paintLines(featureLines, mkX, top, 9, face.regular, tone === 'defect' ? COLOR.text : COLOR.muted);
        y = top - height + 1;
        hairline(y);
        y -= 1;
      },
    };
  };

  const rowsFor = (room: Room): Piece[] => {
    const entries = Object.entries(room.checks);
    const final = isFinalRoom(room);
    const pieces: Piece[] = [];
    let index = 0;
    while (index < entries.length) {
      const [checkId, state] = entries[index] ?? ['', 'open'];
      const values = featureValues(room, checkId);
      if (!final && state === 'ok' && !values) {
        const labels = [checkLabel(checkId)];
        let next = index + 1;
        while (next < entries.length) {
          const [nextId, nextState] = entries[next] ?? ['', 'open'];
          if (nextState !== 'ok' || featureValues(room, nextId)) break;
          labels.push(checkLabel(nextId));
          next += 1;
        }
        pieces.push(tableRow(`check:${room.id}:${checkId}`, labels.join(', '), 'in Ordnung', '', 'ok'));
        index = next;
        continue;
      }
      if (state === 'defect') {
        const info = defectOf(room.id, checkId);
        const body = [values, info?.description ?? ''].filter(Boolean).join(' · ');
        const see = info?.figs.length ? `– siehe ${figLabel(info.figs)}` : '';
        const cell = [body, see].filter(Boolean).join(' ');
        pieces.push(
          tableRow(
            info?.key ?? `defect:${room.id}:${checkId}`,
            checkLabel(checkId),
            info ? `Mangel ${info.m}` : 'Mangel',
            cell,
            'defect',
          ),
        );
      } else if (state === 'na') {
        pieces.push(
          tableRow(`check:${room.id}:${checkId}`, checkLabel(checkId), 'nicht vorhanden', '', 'na'),
        );
      } else if (state === 'open') {
        const label = final ? 'Noch nicht beantwortet' : 'offen';
        pieces.push(tableRow(`check:${room.id}:${checkId}`, checkLabel(checkId), label, values, 'open'));
      } else {
        pieces.push(tableRow(`check:${room.id}:${checkId}`, checkLabel(checkId), 'in Ordnung', values, 'ok'));
      }
      index += 1;
    }
    return pieces;
  };

  const inventoryLine = (label: string, values: string): Ink => {
    const labelW = face.medium.widthOfTextAtSize(label, 8.5) + 6;
    const lines = wrap(values, face.regular, 8.5, width - labelW);
    return {
      height: Math.max(14, lines.length * 12),
      draw() {
        const top = y;
        page.drawText(label, { x: M, y: top - 8.5, size: 8.5, font: face.medium, color: COLOR.muted });
        for (const [index, line] of lines.entries()) {
          page.drawText(line, {
            x: M + labelW,
            y: top - 8.5 - index * 12,
            size: 8.5,
            font: face.regular,
            color: COLOR.text,
          });
        }
        y = top - Math.max(14, lines.length * 12);
      },
    };
  };

  const tailFor = (room: Room): Piece => {
    const present: string[] = [];
    const absent: string[] = [];
    const openItems: string[] = [];
    for (const [key, value] of Object.entries(room.inventory)) {
      const label = INVENTORY[key]?.label ?? key;
      if (value === null) openItems.push(label);
      else if (value === false) absent.push(label);
      else if (value === true) present.push(label);
      else if (typeof value === 'number') present.push(`${label} ${value}`);
    }
    const bits: Ink[] = [];
    if (present.length) bits.push(inventoryLine('Ausstattung vorhanden', present.join(', ')));
    if (absent.length) bits.push(inventoryLine('Nicht vorhanden', absent.join(', ')));
    if (isFinalRoom(room) && p.status !== 'signed' && openItems.length) {
      bits.push(inventoryLine('Noch nicht beantwortet', openItems.join(', ')));
    }
    if (room.note.trim()) bits.push(inventoryLine('Notiz', room.note.trim()));
    bits.push({
      height: 8,
      draw() {
        y -= 8;
      },
    });
    return {
      id: `room-tail:${room.id}`,
      height: bits.reduce((sum, bit) => sum + bit.height, 0),
      draw() {
        for (const bit of bits) bit.draw();
      },
    };
  };

  const overviewHead: Ink = {
    height: 16,
    draw() {
      const heads: Array<{ label: string; x: number; w: number; right?: boolean }> = [
        { label: 'Nr.', x: M, w: width * 0.08 },
        { label: 'Raum', x: M + width * 0.08, w: width * 0.16 },
        { label: 'Element', x: M + width * 0.24, w: width * 0.2 },
        { label: 'Beschreibung', x: M + width * 0.44, w: width * 0.42 },
        { label: 'Fotos', x: M + width * 0.86, w: width * 0.14, right: true },
      ];
      for (const head of heads) {
        const tw = face.medium.widthOfTextAtSize(head.label, 7.5);
        page.drawText(head.label, {
          x: head.right ? head.x + head.w - tw : head.x,
          y: y - 8,
          size: 7.5,
          font: face.medium,
          color: COLOR.muted,
        });
      }
      y -= 12;
      hairline(y);
      y -= 4;
    },
  };

  const overviewRow = (item: DefectInfo): Ink => {
    const descW = width * 0.42 - 6;
    const descLines = wrap(item.description || '–', face.regular, 9, descW);
    const height = Math.max(16, descLines.length * 12 + 4);
    const photos = figLabel(item.figs);
    return {
      height,
      draw() {
        const top = y;
        const baseline = top - 11;
        page.drawText(item.m, { x: M, y: baseline, size: 9, font: face.semi, color: COLOR.defect });
        page.drawText(clip(item.room, face.regular, 9, width * 0.16 - 6), {
          x: M + width * 0.08,
          y: baseline,
          size: 9,
          font: face.regular,
          color: COLOR.text,
        });
        page.drawText(clip(item.element, face.regular, 9, width * 0.2 - 6), {
          x: M + width * 0.24,
          y: baseline,
          size: 9,
          font: face.regular,
          color: COLOR.text,
        });
        for (const [index, line] of descLines.entries()) {
          page.drawText(line, {
            x: M + width * 0.44,
            y: baseline - index * 12,
            size: 9,
            font: face.regular,
            color: COLOR.text,
          });
        }
        const photoW = face.regular.widthOfTextAtSize(photos, 9);
        page.drawText(photos, {
          x: M + width - photoW,
          y: baseline,
          size: 9,
          font: face.regular,
          color: COLOR.text,
        });
        note(`overview:${item.key}`, top, height);
        pushMark({ block: `overview-fig:${item.key}`, page: pageNo, y: baseline, height: 9, text: photos });
        y = top - height + 2;
        hairline(y);
        y -= 2;
      },
    };
  };

  const overviewRows: Ink[] = defects.length
    ? defects.map(overviewRow)
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
  const overviewPieces: Piece[] = [
    { id: 'section:overview', ...section('Mängel', SECTION_SVG.Mängel) },
    {
      id: 'overview:head',
      height: overviewHead.height + (overviewRows[0]?.height ?? 0),
      draw() {
        overviewHead.draw();
        overviewRows[0]?.draw();
      },
    },
    ...overviewRows.slice(1).map((row, index) => ({
      id: `overview:${defects[index + 1]?.key ?? index}`,
      height: row.height,
      draw: () => row.draw(),
    })),
  ];
  await place(
    {
      id: 'section:overview',
      height: overviewPieces.reduce((sum, piece) => sum + piece.height, 0),
      chunks: overviewPieces,
      draw: async () => {
        for (const piece of overviewPieces) await piece.draw();
      },
    },
    null,
  );

  const outdoorLabel: Record<string, string> = {
    balcony: 'Balkon',
    terrace: 'Terrasse',
    loggia: 'Loggia',
    wintergarden: 'Wintergarten',
    none: '',
  };
  const equip = [
    p.features.roomCount > 0 ? `${p.features.roomCount} Zimmer` : '',
    p.features.kitchen === 'fitted' ? 'Einbauküche' : p.features.kitchen === 'basic' ? 'Küche' : '',
    p.features.bathroomCount === 1 ? '1 Bad' : `${p.features.bathroomCount} Bäder`,
    p.features.guestWc ? 'Gäste-WC' : '',
    outdoorLabel[p.features.outdoor] ?? '',
    p.features.basement ? 'Keller' : '',
  ]
    .filter(Boolean)
    .join(', ');
  const facts: Array<{ label: string; value: string }> = [
    { label: 'Ausstattung', value: equip || '–' },
    { label: 'Elektro', value: p.features.elektroUnterPutz ? 'unter Putz' : 'auf Putz' },
  ];
  if (p.property.objectNumber.trim())
    facts.push({ label: 'Objekt-Nr.', value: p.property.objectNumber.trim() });
  if (moveIn) facts.push({ label: 'Einzug am', value: fmtDay(moveIn) });
  if (moveOut) facts.push({ label: 'Auszug zum', value: fmtDay(moveOut) });

  const partyLines = (
    party: { name: string; phone: string; email: string; noEmail?: boolean; newAddress?: string },
    showAddress: boolean,
    maxW: number,
  ) => {
    const lines: Array<{ text: string; font: PDFFont }> = [];
    const push = (value: string, font: PDFFont) => {
      for (const text of wrap(value, font, 9, maxW)) lines.push({ text, font });
    };
    push(party.name.trim() || '–', face.semi);
    if (party.phone.trim()) push(`Telefon ${party.phone.trim()}`, face.regular);
    if (party.noEmail) push('E-Mail: keine angegeben', face.regular);
    else if (party.email.trim()) push(`E-Mail ${party.email.trim()}`, face.regular);
    if (showAddress && party.newAddress?.trim())
      push(`Neue Adresse (nach Auszug): ${party.newAddress.trim()}`, face.regular);
    return lines;
  };

  const leftW = (width - 14) / 2;
  const kvLabelW = 78;
  const kvValueW = leftW - kvLabelW;
  const leftRows = facts.map((fact) => ({
    ...fact,
    lines: wrap(fact.value, face.regular, 9, kvValueW),
  }));
  const leftH = leftRows.reduce((sum, row) => sum + Math.max(14, row.lines.length * 12), 0);
  const personW = (leftW - 10) / 2;
  const leftParty = partyLines(p.landlord, false, personW);
  const rightParty = p.tenants.flatMap((party, index) => {
    const lines = partyLines(party, p.type === 'abnahme', personW);
    return index === 0 ? lines : [{ text: '', font: face.regular }, ...lines];
  });
  const partyH = 14 + Math.max(leftParty.length, rightParty.length, 1) * 12;
  const objectH = SECTION_H + Math.max(leftH, partyH) + 8;
  await place(
    {
      id: 'section:object',
      height: objectH,
      draw() {
        drawSection('Objekt und Beteiligte', SECTION_SVG['Objekt und Beteiligte']);
        const top = y;
        let ly = top;
        for (const row of leftRows) {
          page.drawText(row.label, { x: M, y: ly - 9, size: 8, font: face.medium, color: COLOR.muted });
          for (const [index, line] of row.lines.entries()) {
            page.drawText(line, {
              x: M + kvLabelW,
              y: ly - 9 - index * 12,
              size: 9,
              font: face.regular,
              color: COLOR.text,
            });
          }
          ly -= Math.max(14, row.lines.length * 12);
        }
        const rx = M + leftW + 14;
        page.drawText('Vermieter / Verwaltung', {
          x: rx,
          y: top - 8,
          size: 8,
          font: face.medium,
          color: COLOR.muted,
        });
        page.drawText('Mieterin / Mieter', {
          x: rx + personW + 10,
          y: top - 8,
          size: 8,
          font: face.medium,
          color: COLOR.muted,
        });
        const paintParty = (lines: Array<{ text: string; font: PDFFont }>, x: number) => {
          let py = top - 22;
          for (const line of lines) {
            if (line.text)
              page.drawText(line.text, { x, y: py, size: 9, font: line.font, color: COLOR.text });
            py -= 12;
          }
          return py;
        };
        const endL = paintParty(leftParty, rx);
        const endR = paintParty(rightParty, rx + personW + 10);
        y = Math.min(ly, endL, endR) - 8;
      },
    },
    null,
  );

  let needRoomsHeading = true;
  for (const room of p.rooms) {
    continueRoom = room;
    roomHasInk = false;
    const cont = { id: room.id };
    const prefix: Piece[] = needRoomsHeading
      ? [{ id: 'section:rooms', ...section('Räume', SECTION_SVG.Räume) }]
      : [];
    const head: Piece = {
      id: `room-head:${room.id}`,
      height: ROOM_HEAD_H,
      draw() {
        drawRoomHead(room, room.label);
      },
    };
    const pieces = rowsFor(room);
    const tail = tailFor(room);
    const whole = [...prefix, head, ...pieces, tail];
    const sumH = (parts: Piece[]) => parts.reduce((sum, part) => sum + part.height, 0);
    if (sumH(whole) <= remaining()) {
      await placeTogether(whole);
    } else if (sumH(whole) <= BUDGET) {
      openPage(null);
      await placeTogether(whole);
    } else {
      const first = pieces[0];
      const lead = [...prefix, head, ...(first ? [first] : [])];
      if (sumH(lead) > remaining()) openPage(null);
      await placeTogether(lead);
      roomHasInk = true;
      for (const piece of pieces.slice(first ? 1 : 0)) await place(piece, cont);
      await place(tail, cont);
    }
    needRoomsHeading = false;
    roomHasInk = false;
  }
  continueRoom = null;

  const meterCols: Array<{ label: string; w: number; right: boolean; pad: number }> = [
    { label: 'Zähler', w: 78, right: false, pad: 0 },
    { label: 'Nummer', w: 100, right: false, pad: 0 },
    { label: 'Stand', w: 78, right: true, pad: 16 },
    { label: 'Einheit', w: 46, right: false, pad: 0 },
    { label: 'Ort', w: width - 78 - 100 - 78 - 46 - 40, right: false, pad: 0 },
    { label: 'Foto', w: 40, right: true, pad: 0 },
  ];
  const meterConfirm = p.meters.length
    ? 'Die Mieterseite bestätigt, dass sie die Zählerstände gemeinsam mit dem Verwalter/Vermieter abgelesen hat.'
    : '';
  const meterRowH = 18;
  const meterBodyH = p.meters.length ? p.meters.length * meterRowH : 16;
  const meterNoteH = meterConfirm ? wrap(meterConfirm, face.regular, 8.5, width).length * 12 + 6 : 0;
  await place(
    {
      id: 'section:meters',
      height: SECTION_H + 16 + meterBodyH + meterNoteH,
      draw() {
        drawSection('Zählerstände', SECTION_SVG.Zählerstände);
        let x = M;
        for (const col of meterCols) {
          const tw = face.medium.widthOfTextAtSize(col.label, 7.5);
          page.drawText(col.label, {
            x: col.right ? x + col.w - tw - col.pad : x,
            y: y - 8,
            size: 7.5,
            font: face.medium,
            color: COLOR.muted,
          });
          x += col.w;
        }
        y -= 12;
        hairline(y);
        y -= 4;
        if (!p.meters.length) {
          page.drawText('Keine Zähler erfasst.', {
            x: M,
            y: y - 10,
            size: 9,
            font: face.regular,
            color: COLOR.muted,
          });
          y -= 16;
        }
        const meterFig = figs.filter((fig) => !fig.defectKey);
        let figCursor = 0;
        for (const meter of p.meters) {
          const count = meter.photoIds.length;
          const nums = meterFig.slice(figCursor, figCursor + count).map((fig) => fig.n);
          figCursor += count;
          const cells = [
            METER_LABEL[meter.kind].label,
            meter.number.trim() || '–',
            formatReading(meter.reading),
            METER_LABEL[meter.kind].unit,
            meter.location.trim() || '–',
            figLabel(nums),
          ];
          let cx = M;
          for (const [index, cell] of cells.entries()) {
            const col = meterCols[index];
            if (!col) continue;
            const text = safe(cell);
            const tw = face.regular.widthOfTextAtSize(text, 9);
            page.drawText(text, {
              x: col.right ? cx + col.w - tw - col.pad : cx,
              y: y - 11,
              size: 9,
              font: face.regular,
              color: COLOR.text,
            });
            cx += col.w;
          }
          y -= 14;
          hairline(y);
          y -= 4;
        }
        if (meterConfirm) {
          y -= 4;
          for (const line of wrap(meterConfirm, face.regular, 8.5, width)) {
            page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
            y -= 12;
          }
        }
      },
    },
    null,
  );

  const keyConfirm =
    'Die Mieterseite bestätigt, dass sich außer den hier festgehaltenen Schlüsseln keine weiteren Schlüssel in ihrem Besitz befinden oder befanden.';
  const keyNoteH = wrap(keyConfirm, face.regular, 8.5, width).length * 12 + 6;
  const countRight = M + width * 0.46;
  await place(
    {
      id: 'section:keys',
      height: SECTION_H + 16 + p.keys.length * 16 + keyNoteH,
      draw() {
        drawSection('Schlüssel', SECTION_SVG.Schlüssel);
        page.drawText('Schlüssel', { x: M, y: y - 8, size: 7.5, font: face.medium, color: COLOR.muted });
        const given = 'Übergeben';
        const givenW = face.medium.widthOfTextAtSize(given, 7.5);
        page.drawText(given, {
          x: countRight - givenW,
          y: y - 8,
          size: 7.5,
          font: face.medium,
          color: COLOR.muted,
        });
        page.drawText('Bemerkung', {
          x: countRight + 16,
          y: y - 8,
          size: 7.5,
          font: face.medium,
          color: COLOR.muted,
        });
        y -= 12;
        hairline(y);
        y -= 4;
        for (const key of p.keys) {
          const label = key.kind === 'other' ? key.label.trim() || 'Sonstiger' : KEY_LABEL[key.kind];
          page.drawText(safe(label), { x: M, y: y - 10, size: 9, font: face.regular, color: COLOR.text });
          const count = String(key.count);
          const tw = face.regular.widthOfTextAtSize(count, 9);
          page.drawText(count, {
            x: countRight - tw,
            y: y - 10,
            size: 9,
            font: face.regular,
            color: COLOR.text,
          });
          y -= 14;
          hairline(y);
          y -= 2;
        }
        y -= 4;
        for (const line of wrap(keyConfirm, face.regular, 8.5, width)) {
          page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
          y -= 12;
        }
      },
    },
    null,
  );

  if (p.type === 'abnahme') {
    const body =
      'Ausschluss des deklaratorischen Schuldanerkenntnisses: Der Vermieter bzw. Verwalter behält sich vor, Mängel und Schäden, die erst nach der Abnahme bekannt werden, gegenüber dem ausscheidenden Mieter geltend zu machen.';
    const pad = 8;
    const inner = width - pad * 2;
    const bodyLines = wrap(body, face.regular, 8.5, inner);
    const boxH = pad + 14 + bodyLines.length * 12 + pad;
    await place(
      {
        id: 'section:reservation',
        height: SECTION_H + boxH + 6,
        draw() {
          drawSection('Vorbehalt', SECTION_SVG.Mängel);
          const top = y;
          page.drawRectangle({
            x: M,
            y: top - boxH,
            width,
            height: boxH,
            borderColor: COLOR.line,
            borderWidth: 0.5,
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
              y: lineY - 8.5,
              size: 8.5,
              font: face.regular,
              color: COLOR.muted,
            });
            lineY -= 12;
          }
          y = top - boxH - 6;
        },
      },
      null,
    );
  }

  const noteBody = p.generalNote.trim();
  const noteLines = noteBody ? wrap(noteBody, face.regular, 9.5, width) : [];
  const discLines = wrap(HAND_NOTE, face.regular, 8.5, width);
  const notesH =
    SECTION_H +
    (noteLines.length ? noteLines.length * 13 + 8 : 4) +
    (NOTE_RULES - 1) * NOTE_GAP +
    10 +
    discLines.length * 12;
  await place(
    {
      id: 'section:notes',
      height: notesH,
      draw() {
        drawSection('Anmerkungen', SECTION_SVG.Anmerkungen);
        if (noteLines.length) {
          for (const line of noteLines) {
            page.drawText(line, { x: M, y: y - 9.5, size: 9.5, font: face.regular, color: COLOR.text });
            y -= 13;
          }
          y -= 8;
        } else {
          y -= 4;
        }
        for (let i = 0; i < NOTE_RULES; i++) {
          hairline(y - i * NOTE_GAP, COLOR.noteLine, 0.5);
        }
        y -= (NOTE_RULES - 1) * NOTE_GAP;
        y -= 10;
        for (const line of discLines) {
          page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
          y -= 12;
        }
      },
    },
    null,
  );

  const signers = requiredSigners(p);
  const confirm =
    'Die Unterzeichnenden bestätigen, dass dieses Protokoll vor Ort gemeinsam aufgenommen wurde.';
  const confirmLines = wrap(confirm, face.regular, 8.5, width);
  const sealSentence = 'Prüfsumme (SHA-256 über Daten, Unterschriften, Fotos):';
  const sealLines = p.seal ? wrap(sealSentence, face.regular, 8.5, width) : [];
  const hashLines = !p.seal
    ? []
    : face.regular.widthOfTextAtSize(p.seal.hash, 9) <= width
      ? [p.seal.hash]
      : [p.seal.hash.slice(0, 32), p.seal.hash.slice(32)];
  const pairH = 96;
  const signH =
    SECTION_H +
    confirmLines.length * 12 +
    6 +
    Math.ceil(signers.length / 2) * pairH +
    (p.seal ? 8 + sealLines.length * 12 + hashLines.length * 13 : 16);
  await place(
    {
      id: 'signatures',
      height: signH,
      draw: async () => {
        drawSection('Unterschriften', SECTION_SVG.Unterschriften);
        for (const line of confirmLines) {
          page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
          y -= 12;
        }
        y -= 6;
        const gap = 24;
        const colW = (width - gap) / 2;
        for (let i = 0; i < signers.length; i += 2) {
          const pair = signers.slice(i, i + 2);
          const top = y;
          const lineY = top - 46;
          for (const [col, signer] of pair.entries()) {
            const x = M + col * (colW + gap);
            page.drawLine({
              start: { x, y: lineY },
              end: { x: x + colW, y: lineY },
              thickness: 0.75,
              color: COLOR.text,
            });
            const sig = signatureFor(p, signer);
            if (sig) {
              const raw = sig.image.includes(',') ? (sig.image.split(',')[1] ?? sig.image) : sig.image;
              const img = await doc.embedPng(raw);
              const scale = Math.min(colW / img.width, 38 / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              page.drawImage(img, { x, y: lineY, width: w, height: h });
            }
            const role = signer.role === 'landlord' ? 'Vermieter / Verwaltung' : 'Mieterin / Mieter';
            page.drawText(safe(signer.name || '–'), {
              x,
              y: lineY - 14,
              size: 9,
              font: face.semi,
              color: COLOR.navy,
            });
            const when = sig
              ? `${p.property.city.trim() || 'Ort'}, ${fmtDay(sig.signedAt)}, ${fmtClock(sig.signedAt)} Uhr`
              : 'Ort, Datum, Uhrzeit';
            page.drawText(safe(`${role} · ${when}`), {
              x,
              y: lineY - 26,
              size: 8,
              font: face.regular,
              color: COLOR.muted,
            });
          }
          y = top - pairH;
        }
        if (p.seal) {
          y -= 4;
          for (const line of sealLines) {
            page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
            y -= 12;
          }
          for (const line of hashLines) {
            page.drawText(line, { x: M, y: y - 9, size: 9, font: face.regular, color: COLOR.text });
            y -= 13;
          }
        } else {
          page.drawText('Entwurf – noch keine Prüfsumme.', {
            x: M,
            y: y - 10,
            size: 9,
            font: face.semi,
            color: COLOR.defect,
          });
          y -= 16;
        }
      },
    },
    null,
  );

  if (figs.length) {
    roomHasInk = false;
    openPage(null);
    const y0 = y;
    drawSection('Fotos', SECTION_SVG.Fotos);
    note('section:fotos', y0, y0 - y);
    for (const fig of figs) {
      const captionLines = wrap(fig.caption, face.regular, 8.5, width);
      const capH = 4 + captionLines.length * 12 + 8;
      const image: Ink = {
        height: PHOTO_H,
        draw: async () => {
          const top = y;
          const bottom = top - PHOTO_H;
          page.drawRectangle({ x: M, y: bottom, width, height: PHOTO_H, color: COLOR.photoBg });
          const img = await loadImg(fig.photoId);
          if (img) {
            const scale = Math.min(width / img.width, PHOTO_H / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            page.drawImage(img, {
              x: M + (width - w) / 2,
              y: bottom + (PHOTO_H - h) / 2,
              width: w,
              height: h,
            });
          } else {
            page.drawText('Foto nicht verfügbar', {
              x: M + 8,
              y: bottom + PHOTO_H / 2,
              size: 8,
              font: face.regular,
              color: COLOR.muted,
            });
          }
          y = bottom;
        },
      };
      const caption: Ink = {
        height: capH,
        draw() {
          y -= 4;
          for (const line of captionLines) {
            page.drawText(line, { x: M, y: y - 8.5, size: 8.5, font: face.regular, color: COLOR.muted });
            y -= 12;
          }
          y -= 8;
          if (fig.defectKey) {
            pushMark({
              block: `photo-for:${fig.defectKey}`,
              page: pageNo,
              y,
              height: 1,
              text: `Abb. ${fig.n}`,
            });
          }
        },
      };
      const piece: Piece = {
        id: `photo:${fig.n}`,
        height: image.height + caption.height,
        chunks: image.height + caption.height > BUDGET ? [image, caption] : undefined,
        draw: async () => {
          await image.draw();
          caption.draw();
        },
      };
      await place(piece, null);
    }
  }

  const pages = doc.getPages();
  const footY = 10 * MM;
  for (const [index, pg] of pages.entries()) {
    const saved = page;
    page = pg;
    const checksum = p.seal ? `Prüfsumme ${shortHash(p.seal.hash)}` : 'Entwurf';
    const left = [TITLE[p.type], street, `Protokoll-Nr. ${number}`, checksum].filter(Boolean).join(' · ');
    const pageLabel = `Seite ${index + 1} von ${pages.length}`;
    const pageW = face.regular.widthOfTextAtSize(pageLabel, 8);
    pg.drawText(clip(left, face.regular, 8, width - pageW - 12), {
      x: M,
      y: footY,
      size: 8,
      font: face.regular,
      color: COLOR.muted,
    });
    pg.drawText(pageLabel, {
      x: A4[0] - M - pageW,
      y: footY,
      size: 8,
      font: face.regular,
      color: COLOR.muted,
    });
    page = saved;
  }

  return doc.save();
}
