/**
 * Protokolldaten als Dateianlage im PDF (Vergleich). Rein: Bytes rein, Protokoll oder Fehler raus.
 * pdf-lib wird erst beim Lesen geladen.
 */
import { sha256Hex } from '@/domain/protocol';
import { Protocol, type Protocol as ProtocolData, SCHEMA_VERSION } from '@/domain/schema';
import { migrateProtocol } from '@/storage/migrate';

export const PROTOCOL_FILE = 'schluesselmoment-protokoll.json';
export const PROTOCOL_FORMAT = 'schluesselmoment/1';

export const PDF_PROTOCOL_MISSING = 'Dieses PDF enthält keine Schlüsselmoment-Daten';
export const PDF_PROTOCOL_NEWER = 'Neuere Version – App aktualisieren';
export const PDF_PROTOCOL_DAMAGED = 'Die Schlüsselmoment-Daten in diesem PDF sind beschädigt.';

export type PhotoBytes = (id: string) => Promise<Uint8Array | null>;

export type ReadEmbeddedProtocol =
  | {
      ok: true;
      protocol: ProtocolData;
      photoHashes: Record<string, string>;
      sealHash: string | null;
    }
  | { ok: false; error: string };

const HEX = /^[0-9a-f]{64}$/;

export async function photoHashesOf(p: ProtocolData, loadPhoto: PhotoBytes): Promise<Record<string, string>> {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const room of p.rooms) {
    for (const defect of Object.values(room.defects)) {
      for (const id of defect.photoIds) add(id);
    }
  }
  for (const meter of p.meters) {
    for (const id of meter.photoIds) add(id);
  }
  const hashes: Record<string, string> = {};
  for (const id of ids) {
    const bytes = await loadPhoto(id);
    if (bytes) hashes[id] = await sha256Hex(bytes);
  }
  return hashes;
}

export function encodeProtocolFile(p: ProtocolData, photoHashes: Record<string, string>): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      format: PROTOCOL_FORMAT,
      schemaVersion: p.schemaVersion,
      protocol: p,
      photoHashes,
      sealHash: p.seal?.hash ?? null,
    }),
  );
}

const fail = (error: string): ReadEmbeddedProtocol => ({ ok: false, error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function hashMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const hashes: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string' || !HEX.test(item)) return null;
    hashes[key] = item;
  }
  return hashes;
}

export async function readEmbeddedProtocol(bytes: Uint8Array): Promise<ReadEmbeddedProtocol> {
  const pdf = await import('pdf-lib');
  let doc: InstanceType<typeof pdf.PDFDocument>;
  try {
    doc = await pdf.PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    return fail(PDF_PROTOCOL_MISSING);
  }

  let file: Uint8Array;
  try {
    const found = fileBytes(doc, pdf, PROTOCOL_FILE);
    if (!found) return fail(PDF_PROTOCOL_MISSING);
    file = found;
  } catch {
    return fail(PDF_PROTOCOL_DAMAGED);
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(file));
  } catch {
    return fail(PDF_PROTOCOL_DAMAGED);
  }
  if (!isRecord(body)) return fail(PDF_PROTOCOL_DAMAGED);
  if (typeof body.format !== 'string' || !body.format.startsWith('schluesselmoment/')) {
    return fail(PDF_PROTOCOL_MISSING);
  }
  if (body.format !== PROTOCOL_FORMAT) return fail(PDF_PROTOCOL_NEWER);

  const version = body.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail(PDF_PROTOCOL_DAMAGED);
  }
  if (version > SCHEMA_VERSION) return fail(PDF_PROTOCOL_NEWER);
  if (!isRecord(body.protocol)) return fail(PDF_PROTOCOL_DAMAGED);
  const innerVersion = body.protocol.schemaVersion;
  if (typeof innerVersion === 'number' && innerVersion > SCHEMA_VERSION) return fail(PDF_PROTOCOL_NEWER);
  if (innerVersion !== version) return fail(PDF_PROTOCOL_DAMAGED);

  const photoHashes = hashMap(body.photoHashes);
  if (!photoHashes) return fail(PDF_PROTOCOL_DAMAGED);
  const sealHash = body.sealHash;
  if (sealHash !== null && (typeof sealHash !== 'string' || !HEX.test(sealHash))) {
    return fail(PDF_PROTOCOL_DAMAGED);
  }

  const migrated = migrateProtocol(body.protocol);
  const parsed = Protocol.safeParse(migrated);
  if (!parsed.success) return fail(PDF_PROTOCOL_DAMAGED);
  const seal = parsed.data.seal?.hash ?? null;
  if (sealHash !== seal) return fail(PDF_PROTOCOL_DAMAGED);
  return { ok: true, protocol: parsed.data, photoHashes, sealHash };
}

type PdfLib = typeof import('pdf-lib');

function fileBytes(
  doc: InstanceType<PdfLib['PDFDocument']>,
  pdf: PdfLib,
  fileName: string,
): Uint8Array | null {
  const names = doc.catalog.lookup(pdf.PDFName.of('Names'));
  if (!(names instanceof pdf.PDFDict)) return null;
  const embedded = names.lookup(pdf.PDFName.of('EmbeddedFiles'));
  if (!(embedded instanceof pdf.PDFDict)) return null;
  return findNamed(embedded, pdf, fileName);
}

function findNamed(node: InstanceType<PdfLib['PDFDict']>, pdf: PdfLib, fileName: string): Uint8Array | null {
  const kids = node.lookup(pdf.PDFName.of('Kids'));
  if (kids instanceof pdf.PDFArray) {
    for (let index = 0; index < kids.size(); index += 1) {
      const kid = kids.lookup(index);
      if (kid instanceof pdf.PDFDict) {
        const found = findNamed(kid, pdf, fileName);
        if (found) return found;
      }
    }
  }
  const list = node.lookup(pdf.PDFName.of('Names'));
  if (!(list instanceof pdf.PDFArray)) return null;
  for (let index = 0; index < list.size(); index += 2) {
    const name = textOf(list.lookup(index), pdf);
    if (name !== fileName) continue;
    const spec = list.lookup(index + 1);
    if (!(spec instanceof pdf.PDFDict)) return null;
    const ef = spec.lookup(pdf.PDFName.of('EF'));
    if (!(ef instanceof pdf.PDFDict)) return null;
    const stream = ef.lookup(pdf.PDFName.of('F'));
    if (!(stream instanceof pdf.PDFRawStream)) return null;
    return pdf.decodePDFRawStream(stream).decode();
  }
  return null;
}

function textOf(value: unknown, pdf: PdfLib): string {
  if (value instanceof pdf.PDFHexString || value instanceof pdf.PDFString) return value.decodeText();
  return '';
}
