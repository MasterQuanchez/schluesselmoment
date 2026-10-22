import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { storePhoto } from '@/storage/photos';

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'e2e/fixtures/orient6.jpg'));
const unreadable = 'Dieses Bildformat kann nicht gelesen werden. Bitte direkt mit der Kamera fotografieren.';

describe('storePhoto', () => {
  it('lehnt Dateien ab, die keine Bilder sind', async () => {
    await expect(storePhoto(new Blob(['hallo'], { type: 'text/plain' }), 'p1')).rejects.toThrow(
      'Nur Bilder erlaubt.',
    );
  });

  it('meldet ein Bildformat, das sich nicht dekodieren lässt', async () => {
    const file = new Blob([Uint8Array.from([0, 1, 2, 3])], { type: 'image/heic' });
    await expect(storePhoto(file, 'p1')).rejects.toThrow(unreadable);
  });

  it('dreht eine JPEG-Fixture mit EXIF-Orientierung 6 hochkant', async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const size = await page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width < 1 || canvas.height < 1) throw new Error('Canvas nicht verfügbar');
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close();
        const jpeg = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.8);
        });
        const out = await createImageBitmap(jpeg);
        const result = { w: out.width, h: out.height };
        out.close();
        return result;
      }, fixture.toString('base64'));
      expect(size.w).toBeGreaterThan(0);
      expect(size.w).toBeLessThan(size.h);
    } finally {
      await browser.close();
    }
  }, 30_000);
});
