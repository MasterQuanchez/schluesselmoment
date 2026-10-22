import { RULES } from '@/domain/catalog';
import { newId } from '@/domain/protocol';
import { deletePhoto, getPhoto, putPhoto } from './db';

/**
 * Foto aufnehmen/auswählen → verkleinern → als JPEG-Blob speichern.
 * Das Neu-Kodieren entfernt EXIF-Daten (u. a. GPS-Position) – Datenschutz.
 */
export async function storePhoto(file: Blob, protocolId: string): Promise<string> {
  const unreadable =
    'Dieses Bildformat kann nicht gelesen werden. Bitte direkt mit der Kamera fotografieren.';
  if (file.type && !file.type.startsWith('image/')) throw new Error('Nur Bilder erlaubt.');
  if (file.size > 40 * 1024 * 1024) throw new Error('Bild ist zu groß (max. 40 MB).');

  const openBitmap = async (): Promise<ImageBitmap> => {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        let url = '';
        try {
          url = URL.createObjectURL(file);
          const img = new Image();
          img.src = url;
          await img.decode();
          const raw = document.createElement('canvas');
          raw.width = img.naturalWidth;
          raw.height = img.naturalHeight;
          const rawCtx = raw.getContext('2d');
          if (!rawCtx || raw.width < 1 || raw.height < 1) throw new Error(unreadable);
          rawCtx.drawImage(img, 0, 0);
          return await createImageBitmap(raw);
        } catch (e) {
          if (e instanceof Error && e.message === unreadable) throw e;
          throw new Error(unreadable);
        } finally {
          if (url) URL.revokeObjectURL(url);
        }
      }
    }
  };

  const bmp = await openBitmap();
  if (bmp.width < 1 || bmp.height < 1) {
    bmp.close();
    throw new Error(unreadable);
  }
  const scale = Math.min(1, RULES.maxPhotoEdgePx / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close();
    throw new Error('Canvas nicht verfügbar');
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht kodiert werden'))),
      'image/jpeg',
      RULES.photoJpegQuality,
    ),
  );
  const id = newId();
  await putPhoto({ id, protocolId, blob, width: w, height: h, createdAt: new Date().toISOString() });
  return id;
}

const urlCache = new Map<string, string>();

/** Object-URL für die Vorschau (wird gecacht; Speicher wird beim Löschen freigegeben). */
export async function photoUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const rec = await getPhoto(id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function removePhoto(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
  await deletePhoto(id);
}
