/**
 * PDF-Erzeugung auf dem Gerät (pdf-lib, echtes Text-PDF statt Screenshot).
 * Kein Netz, keine Server: personenbezogene Daten verlassen das Handy erst beim Teilen.
 * Reihenfolge an das Word-Protokoll (2021) angelehnt. Fotos stehen beim Mangel bzw. beim Zähler.
 */
import { degrees, PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { APP_CONFIG } from '@/config';
import { CHECKS, INVENTORY, KEY_LABEL, METER_LABEL, PROTOCOL_TYPE_LABEL } from '@/domain/catalog';
import { requiredSigners, signatureFor } from '@/domain/protocol';
import type { Protocol, Room } from '@/domain/schema';

export type PhotoLoader = (id: string) => Promise<Uint8Array | null>;

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

export async function generatePdf(p: Protocol, loadPhoto: PhotoLoader): Promise<Uint8Array> {
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
  let y = A4[1] - M;
  const width = A4[0] - 2 * M;

  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - M;
  };
  const ensure = (h: number) => {
    if (y - h < M + 24) newPage();
  };

  const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
      else {
        if (line) lines.push(line);
        // sehr lange Wörter hart umbrechen
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

  const text = (
    s: string,
    opts: {
      size?: number;
      f?: PDFFont;
      color?: ReturnType<typeof rgb>;
      x?: number;
      maxW?: number;
      gap?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    const x = opts.x ?? M;
    const lh = size * 1.35;
    for (const line of wrap(s, f, size, opts.maxW ?? width - (x - M))) {
      ensure(lh);
      page.drawText(line, { x, y: y - size, size, font: f, color: opts.color ?? COLOR.text });
      y -= lh;
    }
    y -= opts.gap ?? 0;
  };

  const heading = (s: string) => {
    ensure(40);
    y -= 10;
    page.drawRectangle({ x: M, y: y - 20, width, height: 22, color: COLOR.band });
    page.drawText(safe(s.toUpperCase()), { x: M + 8, y: y - 14, size: 10, font: bold, color: COLOR.primary });
    y -= 30;
  };

  const kv = (label: string, value: string) => {
    const size = 10;
    const lines = wrap(value || '–', font, size, width - 130);
    ensure(lines.length * size * 1.35);
    page.drawText(safe(label), { x: M, y: y - size, size, font, color: COLOR.muted });
    for (const l of lines) {
      page.drawText(l, { x: M + 130, y: y - size, size, font, color: COLOR.text });
      y -= size * 1.35;
    }
  };

  const rule = () => {
    ensure(8);
    page.drawLine({
      start: { x: M, y: y - 3 },
      end: { x: M + width, y: y - 3 },
      thickness: 0.5,
      color: COLOR.line,
    });
    y -= 8;
  };

  // ---------- Kopf ----------
  if (APP_CONFIG.companyName) {
    page.drawText(safe(APP_CONFIG.companyName), { x: M, y: y - 9, size: 9, font: bold, color: COLOR.accent });
    y -= 18;
  }
  page.drawText(safe(TITLE[p.type]), { x: M, y: y - 22, size: 22, font: bold, color: COLOR.primary });
  y -= 32;
  text(
    `${p.property.street}, ${p.property.postalCode} ${p.property.city}`.replace(/^, | ,/g, '').trim() ||
      'Ohne Adresse',
    {
      size: 12,
      f: bold,
    },
  );
  text(
    `${PROTOCOL_TYPE_LABEL[p.type]} · erstellt ${fmtDate(p.createdAt)}${p.inspector ? ` von ${p.inspector}` : ''}`,
    {
      color: COLOR.muted,
      gap: 6,
    },
  );

  heading('Objekt');
  kv('Lage', p.property.unit);
  kv('Objekt-Nr.', p.property.objectNumber);
  const f = p.features;
  kv(
    'Ausstattung',
    [
      `${f.roomCount} Zimmer`,
      f.kitchen === 'fitted' ? 'Einbauküche' : f.kitchen === 'basic' ? 'Küche' : 'keine Küche',
      `${f.bathroomCount} Bad`,
      f.guestWc ? 'Gäste-WC' : '',
      f.outdoor !== 'none'
        ? { balcony: 'Balkon', terrace: 'Terrasse', loggia: 'Loggia', wintergarden: 'Wintergarten' }[
            f.outdoor
          ]
        : '',
      f.basement ? 'Keller' : '',
      `Elektro unter Putz: ${f.elektroUnterPutz ? 'Ja' : 'Nein'}`,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  if (p.property.note) kv('Sonstiges', p.property.note);

  heading('Beteiligte');
  kv(
    'Vermieter/Verwalter',
    [p.landlord.name, p.landlord.phone, p.landlord.email].filter(Boolean).join(' · '),
  );
  for (const [i, t] of p.tenants.entries()) {
    kv(
      p.tenants.length > 1 ? `Mieter ${i + 1}` : 'Mieter',
      [t.name, t.phone, t.email].filter(Boolean).join(' · '),
    );
  }

  // ---------- Räume ----------
  let figCount = 0;
  const photoGap = 12;
  const colW = (width - photoGap) / 2;
  const maxPhotoH = 160;

  /** Zwei Fotos nebeneinander. Die Zeile beginnt nur, wenn sie vollständig auf die Seite passt. */
  const drawFigs = async (ids: string[], caption: string) => {
    for (let i = 0; i < ids.length; i += 2) {
      const slice = ids.slice(i, i + 2);
      const imgs: Array<PDFImage | null> = [];
      for (const id of slice) {
        const bytes = await loadPhoto(id);
        if (!bytes) {
          imgs.push(null);
          continue;
        }
        try {
          imgs.push(await doc.embedJpg(bytes));
        } catch {
          imgs.push(null);
        }
      }
      const scaled = imgs.map((img) => {
        if (!img) return { w: colW, h: 24 };
        const scale = Math.min(colW / img.width, maxPhotoH / img.height);
        return { w: img.width * scale, h: img.height * scale };
      });
      const rowH = Math.max(...scaled.map((box) => box.h), 24) + 16;
      ensure(rowH);
      slice.forEach((_, col) => {
        figCount += 1;
        const img = imgs[col];
        const box = scaled[col];
        if (!box) return;
        const x = M + col * (colW + photoGap);
        if (img) page.drawImage(img, { x, y: y - box.h, width: box.w, height: box.h });
        else page.drawText('Foto nicht verfügbar', { x, y: y - 14, size: 9, font, color: COLOR.muted });
        page.drawText(safe(`Abb. ${figCount} – ${caption}`).slice(0, 70), {
          x,
          y: y - box.h - 11,
          size: 8,
          font,
          color: COLOR.text,
        });
      });
      y -= rowH;
    }
  };

  heading('Räume');
  for (const room of p.rooms) await renderRoom(room);

  async function renderRoom(room: Room) {
    const defects = Object.entries(room.checks).filter(([, s]) => s === 'defect');
    ensure(48);
    y -= 4;
    page.drawText(safe(room.label), { x: M, y: y - 13, size: 13, font: bold, color: COLOR.text });
    const status =
      defects.length === 0 ? 'Keine Mängel' : defects.length === 1 ? '1 Mangel' : `${defects.length} Mängel`;
    const sw = bold.widthOfTextAtSize(status, 9);
    page.drawText(safe(status), {
      x: M + width - sw,
      y: y - 12,
      size: 9,
      font: bold,
      color: defects.length ? COLOR.defect : COLOR.ok,
    });
    y -= 20;

    for (const [checkId, state] of Object.entries(room.checks)) {
      const def = CHECKS[checkId];
      const label = def?.label ?? checkId;
      const details = Object.entries(room.details[checkId] ?? {})
        .map(([attrId, val]) => {
          const attr = def?.attributes?.find((a) => a.id === attrId);
          return attr ? `${attr.label}: ${attr.options.find((o) => o.id === val)?.label ?? val}` : '';
        })
        .filter(Boolean)
        .join(', ');
      ensure(14);
      const mark = state === 'ok' ? 'OK' : state === 'defect' ? 'MANGEL' : 'nicht geprüft';
      page.drawText(safe(label), { x: M + 8, y: y - 10, size: 10, font, color: COLOR.text });
      page.drawText(mark, {
        x: M + 160,
        y: y - 10,
        size: 9,
        font: bold,
        color: state === 'ok' ? COLOR.ok : state === 'defect' ? COLOR.defect : COLOR.muted,
      });
      if (details) {
        const lines = wrap(details, font, 9, width - 250);
        for (const [i, l] of lines.entries()) {
          if (i > 0) ensure(12);
          page.drawText(l, { x: M + 250, y: y - 10, size: 9, font, color: COLOR.muted });
          if (i < lines.length - 1) y -= 12;
        }
      }
      y -= 14;
      if (state === 'defect') {
        const d = room.defects[checkId];
        const ids = d?.photoIds ?? [];
        const nums = ids.map((_, i) => figCount + i + 1);
        text(`Mangel: ${d?.description || '–'}${nums.length ? ` (Abb. ${nums.join(', ')})` : ''}`, {
          x: M + 20,
          size: 9.5,
          color: COLOR.defect,
        });
        await drawFigs(ids, `${room.label} · ${label}`);
      }
    }
    const inv = Object.entries(room.inventory)
      .filter(([, v]) => v === true || (typeof v === 'number' && v > 0))
      .map(([k, v]) =>
        typeof v === 'number' ? `${INVENTORY[k]?.label ?? k}: ${v}` : (INVENTORY[k]?.label ?? k),
      );
    if (inv.length) text(`Ausstattung: ${inv.join(', ')}`, { x: M + 8, size: 9.5, color: COLOR.muted });
    if (room.note.trim()) text(`Notiz: ${room.note}`, { x: M + 8, size: 9.5 });
    rule();
  }

  // ---------- Zähler & Schlüssel ----------
  heading('Zählerstände');
  if (!p.meters.length) text('Keine Zähler erfasst.', { color: COLOR.muted });
  for (const m of p.meters) {
    const nums = m.photoIds.map((_, i) => figCount + i + 1);
    kv(
      `${METER_LABEL[m.kind].label}`,
      `Nr. ${m.number || '–'} · Stand ${m.reading || '–'} ${METER_LABEL[m.kind].unit}${m.location ? ` · ${m.location}` : ''}${
        nums.length ? ` (Abb. ${nums.join(', ')})` : ''
      }`,
    );
    await drawFigs(m.photoIds, `Zähler ${METER_LABEL[m.kind].label}`);
  }
  text(
    'Der Mieter bestätigt, dass er die Zählerstände gemeinsam mit dem Verwalter/Vermieter abgelesen hat.',
    {
      size: 8.5,
      color: COLOR.muted,
      gap: 4,
    },
  );

  heading('Schlüssel');
  for (const k of p.keys)
    kv(k.kind === 'other' ? k.label || 'Sonstiger' : KEY_LABEL[k.kind], `${k.count} Stück`);
  text(
    'Der Mieter bestätigt, dass sich außer den hier festgehaltenen Schlüsseln keine weiteren Schlüssel in seinem Besitz befinden oder befanden.',
    { size: 8.5, color: COLOR.muted, gap: 4 },
  );

  if (p.generalNote.trim()) {
    heading('Anmerkungen');
    text(p.generalNote);
  }

  if (p.type === 'abnahme') {
    heading('Vorbehalt');
    text(
      'Ausschluss des deklaratorischen Schuldanerkenntnisses: Der Vermieter bzw. Verwalter behält sich vor, Mängel und Schäden, die erst nach der Abnahme bekannt werden, gegenüber dem ausscheidenden Mieter geltend zu machen.',
      { size: 9 },
    );
  }

  // ---------- Unterschriften ----------
  heading('Unterschriften');
  for (const s of requiredSigners(p)) {
    const sig = signatureFor(p, s);
    ensure(96);
    const boxW = 220;
    page.drawLine({
      start: { x: M, y: y - 70 },
      end: { x: M + boxW, y: y - 70 },
      thickness: 0.7,
      color: COLOR.text,
    });
    if (sig) {
      const img = await doc.embedPng(sig.image);
      const scale = Math.min(boxW / img.width, 64 / img.height);
      page.drawImage(img, { x: M, y: y - 68, width: img.width * scale, height: img.height * scale });
    }
    const role = s.role === 'landlord' ? 'Vermieter/Verwalter' : 'Mieter';
    page.drawText(safe(`${role}: ${s.name}`), { x: M, y: y - 82, size: 9, font: bold, color: COLOR.text });
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
    text(`Versiegelt ${fmtDate(p.seal.sealedAt)} · SHA-256: ${p.seal.hash}`, {
      size: 7.5,
      color: COLOR.muted,
    });
    text(
      'Der Prüfwert bezieht sich auf alle Protokolldaten, Unterschriften und Fotos. Jede nachträgliche Änderung ergibt einen anderen Wert.',
      {
        size: 7.5,
        color: COLOR.muted,
      },
    );
  } else {
    text('ENTWURF – nicht versiegelt', { size: 9, f: bold, color: COLOR.defect });
  }

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
