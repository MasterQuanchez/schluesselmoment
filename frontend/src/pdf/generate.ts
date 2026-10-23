/**
 * PDF-Erzeugung auf dem Gerät (pdf-lib, echtes Text-PDF statt Screenshot).
 * Kein Netz, keine Server: personenbezogene Daten verlassen das Handy erst beim Teilen.
 * Reihenfolge an das Word-Protokoll (2021) angelehnt. Fotos stehen beim Mangel bzw. beim Zähler.
 *
 * Umbruch blockweise: jeder Block wird gemessen und nur dann gesetzt, wenn er noch auf die
 * Seite passt. Ein späterer Block wird nicht vorgezogen.
 */
import { degrees, PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { APP_CONFIG } from '@/config';
import { CHECKS, INVENTORY, KEY_LABEL, METER_LABEL, PROTOCOL_TYPE_LABEL } from '@/domain/catalog';
import { requiredSigners, signatureFor } from '@/domain/protocol';
import type { Protocol, Room } from '@/domain/schema';

export type PhotoLoader = (id: string) => Promise<Uint8Array | null>;

/** Nur für Tests: wohin ein Block gesetzt wurde. Die App übergibt das Argument nicht. */
export type PdfLayoutMark = {
  block: string;
  page: number;
  y: number;
  height: number;
};

const A4: [number, number] = [595.28, 841.89];
const M = 48; // Rand
const hex = (h: string) =>
  rgb(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  );
/** Harbour-Theme (docs/design/phil-theme.md) – Druckfarben, AA-tauglich auf Weiß */
const COLOR = {
  text: hex('#0F1B2D'), // text-regular
  muted: hex('#5F6B7E'), // text-medium
  primary: hex('#0B1F3A'), // primary (Navy)
  primary20: hex('#dce5f2'), // primary-20, Wasserzeichen
  accent: hex('#0A6CB8'), // accent (Ocean)
  ok: hex('#0E6B4D'), // text-success
  defect: hex('#8A5300'), // text-warning
  line: hex('#E3E8EF'), // separator
  band: hex('#F1F5FB'), // primary-10
};

const TITLE: Record<Protocol['type'], string> = {
  uebergabe: 'Übergabeprotokoll',
  abnahme: 'Abnahmeprotokoll',
  bestandsaufnahme: 'Bestandsaufnahme',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const BOTTOM = M + 24;
const BUDGET = A4[1] - M - BOTTOM;
const HEADING_H = 40;
const CONT_H = 9 * 1.35 + 4;

type Ink = { height: number; draw: () => void | Promise<void> };
type Piece = Ink & { id: string; chunks?: Ink[] };

export async function generatePdf(
  p: Protocol,
  loadPhoto: PhotoLoader,
  layout?: PdfLayoutMark[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${TITLE[p.type]} – ${p.property.street}`);
  doc.setAuthor(p.inspector || 'Schlüsselmoment');
  doc.setCreator('Schlüsselmoment');
  doc.setProducer('Schlüsselmoment (pdf-lib)');
  doc.setCreationDate(new Date(p.createdAt));
  const demo = p.inspector === 'Demo';
  if (demo) doc.setSubject('DEMO – kein echtes Protokoll');
  const keywords = [
    ...(p.seal ? [`sha256:${p.seal.hash}`, `protocol:${p.id}`] : []),
    ...(demo ? ['demo'] : []),
  ];
  if (keywords.length) doc.setKeywords(keywords);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  /** WinAnsi kann keine Emojis o. Ä. – unbekannte Zeichen werden ersetzt statt abzustürzen. */
  const safeCache = new Map<string, boolean>();
  const safe = (s: string) =>
    [...s.replace(/[‘’]/g, "'").replace(/[“”„]/g, '"').replace(/\r?\n/g, ' ')]
      .map((ch) => {
        let ok = safeCache.get(ch);
        if (ok === undefined) {
          try {
            font.encodeText(ch);
            ok = true;
          } catch {
            ok = false;
          }
          safeCache.set(ch, ok);
        }
        return ok ? ch : '?';
      })
      .join('');

  let page: PDFPage = doc.addPage(A4);
  let pageNo = 1;
  let y = A4[1] - M;
  const width = A4[0] - 2 * M;
  let roomHasInk = false;

  const note = (block: string, y0: number, height: number) => {
    layout?.push({ block, page: pageNo, y: y0, height });
  };
  const remaining = () => y - BOTTOM;

  const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
      else {
        if (line) lines.push(line);
        let rest = w;
        while (f.widthOfTextAtSize(rest, size) > maxW) {
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

  const textH = (s: string, size: number, f: PDFFont = font, maxW = width, gap = 0) =>
    wrap(s, f, size, maxW).length * size * 1.35 + gap;

  const paintText = (s: string, size: number, f: PDFFont, color: ReturnType<typeof rgb>, x = M, gap = 0) => {
    const maxW = width - (x - M);
    const lh = size * 1.35;
    for (const line of wrap(s, f, size, maxW)) {
      page.drawText(line, { x, y: y - size, size, font: f, color });
      y -= lh;
    }
    y -= gap;
  };

  const paintHeading = (s: string) => {
    y -= 10;
    page.drawRectangle({ x: M, y: y - 20, width, height: 22, color: COLOR.band });
    page.drawText(safe(s.toUpperCase()), { x: M + 8, y: y - 14, size: 10, font: bold, color: COLOR.primary });
    y -= 30;
  };

  const kvH = (value: string) => wrap(value || '–', font, 10, width - 130).length * 10 * 1.35;
  const paintKv = (label: string, value: string) => {
    const size = 10;
    const lines = wrap(value || '–', font, size, width - 130);
    page.drawText(safe(label), { x: M, y: y - size, size, font, color: COLOR.muted });
    for (const line of lines) {
      page.drawText(line, { x: M + 130, y: y - size, size, font, color: COLOR.text });
      y -= size * 1.35;
    }
  };

  const paintRule = () => {
    page.drawLine({
      start: { x: M, y: y - 3 },
      end: { x: M + width, y: y - 3 },
      thickness: 0.5,
      color: COLOR.line,
    });
    y -= 8;
  };

  const openPage = (cont: { label: string; id: string } | null) => {
    page = doc.addPage(A4);
    pageNo += 1;
    y = A4[1] - M;
    if (!cont) return;
    const y0 = y;
    const size = 9;
    page.drawText(safe(`${cont.label} (Fortsetzung)`), {
      x: M,
      y: y - size,
      size,
      font,
      color: COLOR.muted,
    });
    y -= CONT_H;
    note(`continuation:${cont.id}`, y0, CONT_H);
  };

  /**
   * Passt der anstehende Block, bleibt er hier – auch wenn danach noch Luft ist.
   * Passt er nicht, geht er auf die nächste Seite. Der Block dahinter wird nicht
   * vorgezogen, auch wenn mehr als 40 % der Seite frei blieben.
   */
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

  const photoGap = 12;
  const colW = (width - photoGap) / 2;
  const maxPhotoH = 160;
  const cache = new Map<string, Promise<PDFImage | null>>();
  const loadImg = (id: string) => {
    let pending = cache.get(id);
    if (!pending) {
      pending = (async () => {
        const bytes = await loadPhoto(id);
        if (!bytes) return null;
        try {
          return await doc.embedJpg(bytes);
        } catch {
          return null;
        }
      })();
      cache.set(id, pending);
    }
    return pending;
  };

  const scaled = (img: PDFImage | null) => {
    if (!img) return { w: colW, h: 24 };
    const scale = Math.min(colW / img.width, maxPhotoH / img.height);
    return { w: img.width * scale, h: img.height * scale };
  };

  const paintRow = (imgs: Array<PDFImage | null>, caption: string, nums: number[]) => {
    const boxes = imgs.map((img) => scaled(img));
    const rowH = Math.max(...boxes.map((box) => box.h), 24) + 16;
    const top = y;
    imgs.forEach((img, col) => {
      const box = boxes[col];
      if (!box) return;
      const x = M + col * (colW + photoGap);
      if (img) page.drawImage(img, { x, y: top - box.h, width: box.w, height: box.h });
      else page.drawText('Foto nicht verfügbar', { x, y: top - 14, size: 9, font, color: COLOR.muted });
      page.drawText(safe(`Abb. ${nums[col]} – ${caption}`).slice(0, 70), {
        x,
        y: top - box.h - 11,
        size: 8,
        font,
        color: COLOR.text,
      });
    });
    y = top - rowH;
    return rowH;
  };

  let fig = 0;
  const alloc = (n: number) => Array.from({ length: n }, () => ++fig);

  const detailText = (room: Room, checkId: string) => {
    const def = CHECKS[checkId];
    return Object.entries(room.details[checkId] ?? {})
      .map(([attrId, val]) => {
        const attr = def?.attributes?.find((a) => a.id === attrId);
        return attr ? `${attr.label}: ${attr.options.find((o) => o.id === val)?.label ?? val}` : '';
      })
      .filter(Boolean)
      .join(', ');
  };

  const planCheck = (label: string, state: string, details: string): Ink => {
    const detailLines = details ? wrap(details, font, 9, width - 250) : [];
    const extra = Math.max(0, detailLines.length - 1) * 12;
    const mark = state === 'ok' ? 'OK' : state === 'defect' ? 'MANGEL' : 'nicht geprüft';
    const color = state === 'ok' ? COLOR.ok : state === 'defect' ? COLOR.defect : COLOR.muted;
    return {
      height: 14 + extra,
      draw() {
        page.drawText(safe(label), { x: M + 8, y: y - 10, size: 10, font, color: COLOR.text });
        page.drawText(mark, { x: M + 160, y: y - 10, size: 9, font: bold, color });
        for (const [i, line] of detailLines.entries()) {
          page.drawText(line, { x: M + 250, y: y - 10, size: 9, font, color: COLOR.muted });
          if (i < detailLines.length - 1) y -= 12;
        }
        y -= 14;
      },
    };
  };

  const planHead = (room: Room, defectCount: number): Ink => {
    const status =
      defectCount === 0 ? 'Keine Mängel' : defectCount === 1 ? '1 Mangel' : `${defectCount} Mängel`;
    const statusSafe = safe(status);
    const sw = bold.widthOfTextAtSize(statusSafe, 9);
    const color = defectCount ? COLOR.defect : COLOR.ok;
    return {
      height: 24,
      draw() {
        y -= 4;
        page.drawText(safe(room.label), { x: M, y: y - 13, size: 13, font: bold, color: COLOR.text });
        page.drawText(statusSafe, { x: M + width - sw, y: y - 12, size: 9, font: bold, color });
        y -= 20;
      },
    };
  };

  async function planDefect(room: Room, checkId: string, label: string, details: string): Promise<Piece> {
    const d = room.defects[checkId];
    const ids = d?.photoIds ?? [];
    const imgs: Array<PDFImage | null> = [];
    for (const id of ids) imgs.push(await loadImg(id));
    const nums = alloc(ids.length);
    const line = planCheck(label, 'defect', details);
    const desc = `Mangel: ${d?.description || '–'}${nums.length ? ` (Abb. ${nums.join(', ')})` : ''}`;
    const descH = textH(desc, 9.5, font, width - 20);
    const rows: Ink[] = [];
    for (let i = 0; i < imgs.length; i += 2) {
      const slice = imgs.slice(i, i + 2);
      const rowNums = nums.slice(i, i + 2);
      const rowH = Math.max(...slice.map((img) => scaled(img).h), 24) + 16;
      rows.push({
        height: rowH,
        draw: () => {
          paintRow(slice, `${room.label} · ${label}`, rowNums);
        },
      });
    }
    const textInk: Ink = {
      height: line.height + descH,
      draw() {
        line.draw();
        paintText(desc, 9.5, font, COLOR.defect, M + 20);
      },
    };
    const chunkBudget = BUDGET - CONT_H;
    const chunks: Ink[] = [];
    if (textInk.height <= chunkBudget) chunks.push(textInk);
    else {
      chunks.push({ height: line.height, draw: () => line.draw() });
      const descLines = wrap(desc, font, 9.5, width - 20);
      let group: string[] = [];
      let groupH = 0;
      const flush = () => {
        if (!group.length) return;
        const lines = group;
        const h = groupH;
        chunks.push({
          height: h,
          draw() {
            const lh = 9.5 * 1.35;
            for (const lineText of lines) {
              page.drawText(lineText, { x: M + 20, y: y - 9.5, size: 9.5, font, color: COLOR.defect });
              y -= lh;
            }
          },
        });
        group = [];
        groupH = 0;
      };
      for (const lineText of descLines) {
        const lh = 9.5 * 1.35;
        if (group.length && groupH + lh > chunkBudget) flush();
        group.push(lineText);
        groupH += lh;
      }
      flush();
    }
    for (const row of rows) {
      const prev = chunks[chunks.length - 1];
      if (prev && prev.height + row.height <= chunkBudget) {
        const prevDraw = prev.draw;
        chunks[chunks.length - 1] = {
          height: prev.height + row.height,
          draw: () => {
            prevDraw();
            row.draw();
          },
        };
      } else chunks.push(row);
    }
    const height = chunks.reduce((s, chunk) => s + chunk.height, 0);
    return {
      id: `defect:${room.id}:${checkId}`,
      height,
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
        typeof v === 'number' ? `${INVENTORY[k]?.label ?? k}: ${v}` : (INVENTORY[k]?.label ?? k),
      );
    const bits: Array<{ h: number; draw: () => void }> = [];
    if (inv.length) {
      const s = `Ausstattung: ${inv.join(', ')}`;
      bits.push({
        h: textH(s, 9.5, font, width - 8),
        draw: () => paintText(s, 9.5, font, COLOR.muted, M + 8),
      });
    }
    if (room.note.trim()) {
      const s = `Notiz: ${room.note}`;
      bits.push({
        h: textH(s, 9.5, font, width - 8),
        draw: () => paintText(s, 9.5, font, COLOR.text, M + 8),
      });
    }
    bits.push({ h: 8, draw: paintRule });
    return {
      height: bits.reduce((s, bit) => s + bit.h, 0),
      draw() {
        for (const bit of bits) bit.draw();
      },
    };
  };

  // ---------- Kopf ----------
  if (APP_CONFIG.companyName) {
    page.drawText(safe(APP_CONFIG.companyName), { x: M, y: y - 9, size: 9, font: bold, color: COLOR.accent });
    y -= 18;
  }
  page.drawText(safe(TITLE[p.type]), { x: M, y: y - 22, size: 22, font: bold, color: COLOR.primary });
  y -= 32;
  paintText(
    `${p.property.street}, ${p.property.postalCode} ${p.property.city}`.replace(/^, | ,/g, '').trim() ||
      'Ohne Adresse',
    12,
    bold,
    COLOR.text,
  );
  paintText(
    `${PROTOCOL_TYPE_LABEL[p.type]} · erstellt ${fmtDate(p.createdAt)}${p.inspector ? ` von ${p.inspector}` : ''}`,
    10,
    font,
    COLOR.muted,
    M,
    6,
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

  const objectBits: Array<{ h: number; draw: () => void }> = [
    { h: HEADING_H, draw: () => paintHeading('Objekt') },
    { h: kvH(p.property.unit), draw: () => paintKv('Lage', p.property.unit) },
    { h: kvH(p.property.objectNumber), draw: () => paintKv('Objekt-Nr.', p.property.objectNumber) },
    { h: kvH(equip), draw: () => paintKv('Ausstattung', equip) },
  ];
  if (p.property.note) {
    objectBits.push({ h: kvH(p.property.note), draw: () => paintKv('Sonstiges', p.property.note) });
  }
  await place(
    {
      id: 'section:object',
      height: objectBits.reduce((s, bit) => s + bit.h, 0),
      draw() {
        for (const bit of objectBits) bit.draw();
      },
    },
    null,
  );

  const partyBits: Array<{ h: number; draw: () => void }> = [
    { h: HEADING_H, draw: () => paintHeading('Beteiligte') },
    {
      h: kvH([p.landlord.name, p.landlord.phone, p.landlord.email].filter(Boolean).join(' · ')),
      draw: () =>
        paintKv(
          'Vermieter/Verwalter',
          [p.landlord.name, p.landlord.phone, p.landlord.email].filter(Boolean).join(' · '),
        ),
    },
  ];
  for (const [i, t] of p.tenants.entries()) {
    const value = [t.name, t.phone, t.email].filter(Boolean).join(' · ');
    const label = p.tenants.length > 1 ? `Mieter ${i + 1}` : 'Mieter';
    partyBits.push({ h: kvH(value), draw: () => paintKv(label, value) });
  }
  await place(
    {
      id: 'section:parties',
      height: partyBits.reduce((s, bit) => s + bit.h, 0),
      draw() {
        for (const bit of partyBits) bit.draw();
      },
    },
    null,
  );

  let needRoomsHeading = true;
  const headingPiece = (): Piece => ({
    id: 'section:rooms',
    height: HEADING_H,
    draw: () => paintHeading('Räume'),
  });

  for (const room of p.rooms) {
    roomHasInk = false;
    const cont = { label: room.label, id: room.id };
    const defectIds = Object.entries(room.checks)
      .filter(([, state]) => state === 'defect')
      .map(([id]) => id);
    const head = planHead(room, defectIds.length);
    const pieces: Piece[] = [];
    for (const [checkId, state] of Object.entries(room.checks)) {
      const def = CHECKS[checkId];
      const label = def?.label ?? checkId;
      const details = detailText(room, checkId);
      if (state === 'defect') pieces.push(await planDefect(room, checkId, label, details));
      else pieces.push({ id: `check:${room.id}:${checkId}`, ...planCheck(label, state, details) });
    }
    const tail = planTail(room);
    const prefix = needRoomsHeading ? [headingPiece()] : [];
    const whole = [
      ...prefix,
      { id: `room-head:${room.id}`, ...head },
      ...pieces,
      { id: `room-tail:${room.id}`, ...tail },
    ];
    const wholeH = whole.reduce((s, part) => s + part.height, 0);

    if (defectIds.length === 0 && wholeH <= BUDGET) {
      await placeTogether(whole, cont);
      needRoomsHeading = false;
      roomHasInk = false;
      continue;
    }

    const three = pieces.slice(0, Math.min(3, pieces.length));
    const sumH = (parts: Piece[]) => parts.reduce((s, part) => s + part.height, 0);
    const headPiece: Piece = { id: `room-head:${room.id}`, ...head };
    const fixed = (needRoomsHeading ? HEADING_H : 0) + head.height;
    const first = pieces[0];
    let opening: Piece[] = three;
    let rest = pieces.slice(three.length);
    if (fixed + sumH(three) > BUDGET) {
      if (first && fixed + first.height <= BUDGET) {
        opening = [first];
        rest = pieces.slice(1);
      } else if (first?.chunks?.[0] && fixed + first.chunks[0].height <= BUDGET) {
        const chunk = first.chunks[0];
        const leftover = first.chunks.slice(1);
        opening = [{ id: first.id, height: chunk.height, draw: () => chunk.draw() }];
        rest = [
          ...leftover.map((part) => ({ id: first.id, height: part.height, draw: () => part.draw() })),
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

  // ---------- Zähler & Schlüssel ----------
  const meterInks: Ink[] = [];
  if (!p.meters.length) {
    meterInks.push({
      height: textH('Keine Zähler erfasst.', 10, font, width),
      draw: () => paintText('Keine Zähler erfasst.', 10, font, COLOR.muted),
    });
  }
  for (const m of p.meters) {
    const imgs: Array<PDFImage | null> = [];
    for (const id of m.photoIds) imgs.push(await loadImg(id));
    const nums = alloc(m.photoIds.length);
    const value = `Nr. ${m.number || '–'} · Stand ${m.reading || '–'} ${METER_LABEL[m.kind].unit}${m.location ? ` · ${m.location}` : ''}${nums.length ? ` (Abb. ${nums.join(', ')})` : ''}`;
    const caption = `Zähler ${METER_LABEL[m.kind].label}`;
    const rows: Ink[] = [];
    for (let i = 0; i < imgs.length; i += 2) {
      const slice = imgs.slice(i, i + 2);
      const rowNums = nums.slice(i, i + 2);
      const rowH = Math.max(...slice.map((img) => scaled(img).h), 24) + 16;
      rows.push({
        height: rowH,
        draw: () => {
          paintRow(slice, caption, rowNums);
        },
      });
    }
    const blockH = kvH(value) + rows.reduce((s, row) => s + row.height, 0);
    meterInks.push({
      height: blockH,
      draw() {
        paintKv(METER_LABEL[m.kind].label, value);
        for (const row of rows) row.draw();
      },
    });
  }
  const meterConfirm =
    'Der Mieter bestätigt, dass er die Zählerstände gemeinsam mit dem Verwalter/Vermieter abgelesen hat.';
  const metersHeight =
    HEADING_H + meterInks.reduce((s, ink) => s + ink.height, 0) + textH(meterConfirm, 8.5, font, width, 4);
  await place(
    {
      id: 'section:meters',
      height: metersHeight,
      chunks: [
        {
          height: HEADING_H + (meterInks[0]?.height ?? 0),
          draw() {
            paintHeading('Zählerstände');
            meterInks[0]?.draw();
          },
        },
        ...meterInks.slice(1),
        {
          height: textH(meterConfirm, 8.5, font, width, 4),
          draw: () => paintText(meterConfirm, 8.5, font, COLOR.muted, M, 4),
        },
      ],
      draw() {
        paintHeading('Zählerstände');
        for (const ink of meterInks) ink.draw();
        paintText(meterConfirm, 8.5, font, COLOR.muted, M, 4);
      },
    },
    null,
  );

  const keyBits: Array<{ h: number; draw: () => void }> = [
    { h: HEADING_H, draw: () => paintHeading('Schlüssel') },
  ];
  for (const k of p.keys) {
    const label = k.kind === 'other' ? k.label || 'Sonstiger' : KEY_LABEL[k.kind];
    const value = `${k.count} Stück`;
    keyBits.push({ h: kvH(value), draw: () => paintKv(label, value) });
  }
  const keyConfirm =
    'Der Mieter bestätigt, dass sich außer den hier festgehaltenen Schlüsseln keine weiteren Schlüssel in seinem Besitz befinden oder befanden.';
  keyBits.push({
    h: textH(keyConfirm, 8.5, font, width, 4),
    draw: () => paintText(keyConfirm, 8.5, font, COLOR.muted, M, 4),
  });
  await place(
    {
      id: 'section:keys',
      height: keyBits.reduce((s, bit) => s + bit.h, 0),
      draw() {
        for (const bit of keyBits) bit.draw();
      },
    },
    null,
  );

  if (p.generalNote.trim()) {
    const h = HEADING_H + textH(p.generalNote, 10);
    await place(
      {
        id: 'section:notes',
        height: h,
        draw() {
          paintHeading('Anmerkungen');
          paintText(p.generalNote, 10, font, COLOR.text);
        },
      },
      null,
    );
  }

  if (p.type === 'abnahme') {
    const body =
      'Ausschluss des deklaratorischen Schuldanerkenntnisses: Der Vermieter bzw. Verwalter behält sich vor, Mängel und Schäden, die erst nach der Abnahme bekannt werden, gegenüber dem ausscheidenden Mieter geltend zu machen.';
    const h = HEADING_H + textH(body, 9);
    await place(
      {
        id: 'section:reservation',
        height: h,
        draw() {
          paintHeading('Vorbehalt');
          paintText(body, 9, font, COLOR.text);
        },
      },
      null,
    );
  }

  // ---------- Unterschriften, immer eine Seite ----------
  const signers = requiredSigners(p);
  const sealLine = p.seal ? `Versiegelt ${fmtDate(p.seal.sealedAt)} · SHA-256: ${p.seal.hash}` : '';
  const sealHint = p.seal
    ? 'Der Prüfwert bezieht sich auf alle Protokolldaten, Unterschriften und Fotos. Jede nachträgliche Änderung ergibt einen anderen Wert.'
    : '';
  const signTail = p.seal
    ? textH(sealLine, 7.5) + textH(sealHint, 7.5)
    : textH('ENTWURF – nicht versiegelt', 9, bold);
  const signH = HEADING_H + signers.length * 104 + signTail;
  await place(
    {
      id: 'signatures',
      height: signH,
      draw: async () => {
        paintHeading('Unterschriften');
        for (const s of signers) {
          const sig = signatureFor(p, s);
          const boxW = 220;
          page.drawLine({
            start: { x: M, y: y - 70 },
            end: { x: M + boxW, y: y - 70 },
            thickness: 0.7,
            color: COLOR.text,
          });
          if (sig) {
            const raw = sig.image.includes(',') ? (sig.image.split(',')[1] ?? sig.image) : sig.image;
            const img = await doc.embedPng(raw);
            const scale = Math.min(boxW / img.width, 64 / img.height);
            page.drawImage(img, { x: M, y: y - 68, width: img.width * scale, height: img.height * scale });
          }
          const role = s.role === 'landlord' ? 'Vermieter/Verwalter' : 'Mieter';
          page.drawText(safe(`${role}: ${s.name}`), {
            x: M,
            y: y - 82,
            size: 9,
            font: bold,
            color: COLOR.text,
          });
          page.drawText(safe(sig ? `unterschrieben ${fmtDate(sig.signedAt)}` : 'nicht unterschrieben'), {
            x: M,
            y: y - 93,
            size: 8,
            font,
            color: COLOR.muted,
          });
          y -= 104;
        }
        if (p.seal) {
          paintText(sealLine, 7.5, font, COLOR.muted);
          paintText(sealHint, 7.5, font, COLOR.muted);
        } else {
          paintText('ENTWURF – nicht versiegelt', 9, bold, COLOR.defect);
        }
      },
    },
    null,
  );

  // ---------- Fußzeile auf allen Seiten ----------
  const pages = doc.getPages();
  const foot = `${TITLE[p.type]} · ${p.property.street} · ID ${p.id.slice(0, 8)}${p.seal ? ` · SHA-256 ${p.seal.hash.slice(0, 16)}…` : ' · ENTWURF'}`;
  pages.forEach((pg, i) => {
    if (demo) {
      pg.drawText('DEMO', {
        x: 150,
        y: 280,
        size: 96,
        font: bold,
        color: COLOR.primary20,
        opacity: 0.15,
        rotate: degrees(45),
      });
    }
    pg.drawText(safe(foot), { x: M, y: 24, size: 7.5, font, color: COLOR.muted });
    const n = `Seite ${i + 1} von ${pages.length}`;
    pg.drawText(n, {
      x: A4[0] - M - font.widthOfTextAtSize(n, 7.5),
      y: 24,
      size: 7.5,
      font,
      color: COLOR.muted,
    });
  });

  return doc.save();
}

export function pdfFileName(p: Protocol): string {
  const date = (p.seal?.sealedAt ?? p.updatedAt).slice(0, 10);
  // Nur ASCII: manche Android-Apps/Browser verwerfen Dateinamen mit Umlauten (dann heißt die Datei „download“)
  const ascii = (t: string) =>
    t
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
  return `${ascii(TITLE[p.type])}_${ascii(p.property.street) || 'Objekt'}_${date}.pdf`;
}
