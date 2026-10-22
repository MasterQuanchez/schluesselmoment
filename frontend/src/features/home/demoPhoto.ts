/** JPEG-Platzhalter fürs Demo-Protokoll. Farben kommen aus den Harbour-Tokens. */
export function createDemoPhoto(label: string): Promise<Blob> {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas nicht verfügbar'));
  ctx.fillStyle = token('--theme-current-color-primary', '#0b1f3a');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = token('--theme-current-color-accent', '#0a6cb8');
  ctx.fillRect(0, 0, canvas.width, 18);
  ctx.fillStyle = token('--theme-current-color-text-contrast', '#ffffff');
  ctx.font = '600 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`DEMO-Foto ${label}`, canvas.width / 2, canvas.height / 2);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht kodiert werden'))),
      'image/jpeg',
      0.8,
    );
  });
}
