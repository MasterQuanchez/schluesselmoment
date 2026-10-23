// Referenz-Klickpfad des Orchestrators (grün am 22.10.2026, Pixel-7-Viewport, strikte CSP).
// In SM-06 nach @playwright/test überführen. Aufruf: npm run build && npx vite preview --port 4173
// dann in zweitem Terminal: SP=./test-results node tests/e2e/flow.reference.mjs

import fs from 'node:fs';
import { chromium, devices } from 'playwright';

const SP = process.env.SP ?? './test-results';
const deviceName = process.env.DEVICE ?? 'Pixel 7';
const tag = deviceName.toLowerCase().replace(/\s+/g, '');
fs.mkdirSync(SP, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${SP}/${tag}-${n}.png`, fullPage: false });
const browser = await chromium.launch();
const device =
  deviceName === '360'
    ? {
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 7'].userAgent,
      }
    : devices[deviceName];
if (!device) throw new Error(`Unbekanntes Gerät: ${deviceName}`);
const ctx = await browser.newContext({
  ...device,
  colorScheme: 'dark',
  acceptDownloads: true,
  locale: 'de-DE',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
await page.goto('http://localhost:4173/#/mehr');
const bg = await page.evaluate(() =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-current-color-background-main')
    .trim()
    .toLowerCase(),
);
console.log('Gerät:', deviceName, 'Hintergrund:', bg);
if (bg !== '#ffffff' && bg !== '#fff') errors.push(`Theme nicht hell: ${bg}`);
await page.getByLabel('Mein Name', { exact: false }).fill('Nina');
await page.getByPlaceholder('z. B. Silikon im Bad erneuern').fill('Zählerschrank verschmutzt');
await page.getByRole('button', { name: 'Begriff hinzufügen' }).click();
await shot(page, '00-mehr');
await page.goto('http://localhost:4173/');
await page.getByText('Noch keine Protokolle').waitFor();
await shot(page, '01-home-leer');
await page.getByLabel('Neues Protokoll').click();
await page.getByRole('button', { name: 'Abnahme (Auszug)' }).click();
await page.getByLabel('Straße und Nr.').fill('Musterstraße 1');
await page.getByLabel('PLZ').fill('70190');
await page.getByLabel('Ort').fill('Stuttgart');
await page.getByLabel('Lage (z. B. 2. OG links)').fill('3. OG links');
console.log('Erstellt von vorbelegt:', await page.getByLabel('Erstellt von').inputValue());
// Einbauküche + Balkon
await page.getByRole('button', { name: 'Einbau' }).click();
await page.getByRole('button', { name: 'Balkon' }).click();
await page.getByLabel('Vermieter/Verwalter: Name').fill('Hausverwaltung Beispiel GmbH');
await page.getByLabel('Mieter: Name').fill('Anna Muster');
await page.getByLabel('E-Mail').nth(1).fill('anna@example.org');
await shot(page, '02-basis');
await page.getByRole('link', { name: 'Weiter zu den Räumen' }).click();
await page.getByRole('heading', { name: 'Räume' }).waitFor();
await shot(page, '03-raeume');
await noOverflow('Räume');
const roomCount = await page.locator('.list li').count();
console.log('Räume:', roomCount);
// Flur: keine Mängel, zwei Details über das Sheet, Rest einzeln
await page.getByRole('link', { name: 'Weiter: Flur' }).click();
await page.getByRole('button', { name: 'Keine Mängel' }).click();
async function tapAllOpen() {
  for (;;) {
    const o = page.locator('.chips .chip[data-state="open"]');
    if ((await o.count()) === 0) break;
    await o.first().click();
  }
}
await page.getByText('Bitte tippen Sie jeden Punkt einmal an.').waitFor();
await page.getByRole('button', { name: /noch nicht geprüft/ }).waitFor();
await shot(page, 'sm11-offen');
await page.getByRole('button', { name: 'Details zu Decke' }).click();
const decke = page.getByRole('dialog');
await decke.getByRole('heading', { name: 'Decke' }).waitFor();
await shot(page, 'sm11-sheet');
await decke.getByRole('button', { name: 'Neu', exact: true }).click();
await decke.getByRole('button', { name: 'Fertig', exact: true }).click();
await page.getByRole('button', { name: 'Details zu Boden' }).click();
const boden = page.getByRole('dialog');
await boden.getByRole('button', { name: 'Parkett', exact: true }).click();
await boden.getByRole('button', { name: 'Fertig', exact: true }).click();
await page.locator('[data-check="ceiling"] .chip[data-state="ok"]').waitFor();
await page.locator('[data-check="floor"] .chip[data-state="ok"]').waitFor();
await tapAllOpen();
await shot(page, '04-flur-alle-bestaetigt');
await page.getByRole('button', { name: /Flur fertig – weiter/ }).waitFor();
await shot(page, 'sm11-fertig');
await page.getByRole('button', { name: /Flur fertig – weiter/ }).click();
// Küche: Mangel ohne Foto schließen, ein Foto nachreichen.
await page.getByRole('heading', { name: 'Küche', level: 1 }).waitFor();
await tapAllOpen();
await shot(page, '05-kueche-schnellcheck');
await page.getByRole('button', { name: /^Wände:/ }).click();
const walls = page.getByRole('dialog');
await walls.getByRole('heading', { name: 'Wände' }).waitFor();
await shot(page, 'sm16-sheet');
await walls.getByRole('button', { name: 'Schließen – 1 Foto fehlt noch' }).click();
await page.getByRole('button', { name: /Wände: 1 Foto fehlt/ }).waitFor();
await shot(page, 'sm16-foto-fehlt');
await page.getByRole('button', { name: /Wände: 1 Foto fehlt/ }).click();
const again = page.getByRole('dialog');
await again.locator('#sheet-photos').waitFor();
await again.locator('input[type=file]:not([capture])').setInputFiles(['tests/e2e/fixtures/orient6.jpg']);
await again.locator('.thumb img').first().waitFor();
const orient = await again
  .locator('.thumb img')
  .first()
  .evaluate(async (img) => {
    if (typeof img.decode === 'function') await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
console.log('EXIF-Foto:', orient.w, '×', orient.h);
if (!(orient.w > 0 && orient.w < orient.h)) errors.push(`EXIF-Orientierung: ${orient.w}×${orient.h}`);
await again.getByRole('button', { name: 'Dübellöcher', exact: true }).click();
await shot(page, 'sm16-mangel');
await again.getByRole('button', { name: 'Fertig', exact: true }).click();
await page.locator('.chip--phrase', { hasText: 'Besenrein' }).click();
await page.locator('.chip--phrase', { hasText: 'Normale Abnutzung' }).click();
await page.getByRole('heading', { name: 'Schnellcheck' }).scrollIntoViewIfNeeded();
await shot(page, '07-kueche-mangel');
await page.getByRole('button', { name: /Mangel: Wände/ }).scrollIntoViewIfNeeded();
await shot(page, '08-kueche-mangel-fotos');
console.log('Notiz:', await page.getByLabel('Notizen zum Raum').inputValue());
await page.getByRole('button', { name: /Küche fertig – weiter/ }).click();
await page
  .waitForFunction(() => document.querySelector('h1')?.textContent?.trim() !== 'Küche', null, {
    timeout: 5000,
  })
  .catch(async () => {
    await shot(page, 'ERR-kueche');
    console.log('Küche nicht abgeschlossen:', await page.locator('.notice, .toast').allTextContents());
    process.exit(1);
  });
// restliche Räume: keine Mängel
for (let i = 0; i < 20; i++) {
  const h1 = page.getByRole('heading', { level: 1 });
  await h1.waitFor();
  const title = (await h1.textContent()).trim();
  if (title === 'Räume') break;
  await page.getByRole('button', { name: 'Keine Mängel' }).click();
  await tapAllOpen();
  if (title === 'Bad') {
    await page.getByRole('button', { name: 'Spiegel: Ja', exact: true }).click();
    await page.getByRole('button', { name: 'Handtuchhaken mehr' }).click();
  }
  if (title === 'Abschluss-Prüfungen') await shot(page, '09-abschlusspruefungen');
  await page
    .getByRole('button', { name: new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} fertig`) })
    .click();
  await page.waitForFunction((t) => document.querySelector('h1')?.textContent?.trim() !== t, title);
}
await shot(page, '10-raeume-fertig');
await page.getByRole('link', { name: /Alle Räume erledigt/ }).click();
await page.getByRole('button', { name: '+ Strom' }).click();
await page.getByLabel('Zähler-Nr.').fill('1ESY1160 1234');
await page.getByLabel('Stand').fill('12345,6');
await page.getByRole('button', { name: 'Wohnungstür mehr' }).click();
await page.getByRole('button', { name: 'Wohnungstür mehr' }).click();
await shot(page, '11-zaehler');
await page.getByRole('link', { name: 'Weiter zum Abschluss' }).click();
await page.getByText('Alles erfasst').waitFor();
await shot(page, '12-abschluss');
// Entwurf-PDF
const [d0] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Entwurf als PDF ansehen' }).click(),
]);
await d0.saveAs(`${SP}/entwurf.pdf`);
await page.getByRole('button', { name: /Inhalt festschreiben/ }).click();
async function noOverflow(where) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth);
  if (!ok) {
    const detail = await page.evaluate(
      () => `${document.documentElement.scrollWidth}≠${window.innerWidth}`,
    );
    errors.push(`Überlauf ${where}: ${detail}`);
  }
}
async function sign(name) {
  await page.getByRole('button', { name: new RegExp(`Unterschreiben: ${name}`) }).click();
  const c = page.locator('canvas.sigpad');
  await c.waitFor();
  await noOverflow(`Unterschrift ${name}`);
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 120);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) await page.mouse.move(b.x + 30 + i * 7, b.y + 110 - Math.sin(i / 3) * 40);
  await page.mouse.up();
  await page.getByText('Hier mit dem Finger unterschreiben').waitFor({ state: 'hidden' });
  await shot(page, `13-unterschrift-${name.split(' ')[0]}`);
  await page.getByRole('button', { name: 'Übernehmen' }).click();
}
await sign('Hausverwaltung');
await sign('Anna Muster');
await shot(page, '14-unterschriften');
await page.getByRole('button', { name: /versiegeln/ }).click();
await page.getByText('Protokoll abgeschlossen und versiegelt').waitFor();
await shot(page, '15-versiegelt');
await page.getByRole('button', { name: 'PDF vorbereiten' }).click();
await page.getByText(/\d+ Seiten/).waitFor();
await shot(page, '15b-pdf-vorschau');
const [d1] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Per E-Mail senden' }).click(),
]);
await d1.saveAs(`${SP}/final.pdf`);
console.log('PDF:', d1.suggestedFilename());
// Sperre prüfen: Raum ist schreibgeschützt
await page.goto(page.url().replace('abschluss', 'raeume/kitchen'));
await page.getByRole('heading', { name: 'Küche', level: 1 }).waitFor();
console.log(
  'Keine-Mängel-Button deaktiviert:',
  await page.getByRole('button', { name: 'Keine Mängel' }).isDisabled(),
);
// Persistenz: Reload
await page.goto('http://localhost:4173/');
await page.reload();
console.log('Home:', (await page.locator('.list-item').first().textContent()).replace(/\s+/g, ' '));
await page.getByText('Musterstraße 1').waitFor();
await shot(page, '16-home');
const iosCard = page.getByText('Zum Home-Bildschirm hinzufügen');
if (await iosCard.count()) {
  await iosCard.scrollIntoViewIfNeeded();
  await shot(page, '17-ios-hinweis');
}
console.log('Fehler:', errors.length ? errors : 'keine');
await browser.close();
