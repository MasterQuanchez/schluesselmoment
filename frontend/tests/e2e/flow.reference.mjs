// Referenz-Klickpfad des Orchestrators (grün am 22.10.2026, Pixel-7-Viewport, strikte CSP).
// In SM-06 nach @playwright/test überführen. Aufruf: npm run build && npx vite preview --port 4173
// dann in zweitem Terminal: SP=./test-results node tests/e2e/flow.reference.mjs

import fs from 'node:fs';
import { chromium, devices } from 'playwright';

const SP = process.env.SP ?? './test-results';
fs.mkdirSync(`${SP}/shots`, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${SP}/shots/${n}.png`, fullPage: false });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true, locale: 'de-DE' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
await page.goto('http://localhost:4173/#/mehr');
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
const roomCount = await page.locator('.list li').count();
console.log('Räume:', roomCount);
// Flur: keine Mängel
await page.getByRole('link', { name: 'Weiter: Flur' }).click();
await page.getByRole('button', { name: 'Keine Mängel' }).click();
async function tapAllOpen() {
  for (;;) {
    const o = page.locator('.chips .chip[data-state="open"]');
    if ((await o.count()) === 0) break;
    await o.first().click();
  }
}
// Ohne Einzelbestätigung darf der Raum NICHT abschließbar sein
await page.getByRole('button', { name: 'Flur abschließen' }).click();
await page.getByText('Bitte noch erledigen:').waitFor();
await tapAllOpen();
await shot(page, '04-flur-alle-bestaetigt');
await page.getByRole('button', { name: 'Flur abschließen' }).click();
// Küche: Mix wie im Screenshot, Backofen-Mangel mit 2 Fotos
await page.getByRole('heading', { name: 'Küche', level: 1 }).waitFor();
await page.getByRole('button', { name: /^Wände:/ }).click();
await page.getByRole('button', { name: /^Tür\/Rahmen:/ }).click();
await page.getByRole('button', { name: /^Steckdosen\/Schalter:/ }).click();
await shot(page, '05-kueche-schnellcheck');
await page.getByRole('button', { name: /^Backofen innen:/ }).click();
await page.getByRole('button', { name: /^Backofen innen:/ }).click();
// Abschließen ohne alles → Hinweise
await page.getByRole('button', { name: 'Küche abschließen' }).click();
await page.getByText('Bitte noch erledigen:').waitFor();
await shot(page, '06-kueche-hinweise');
await page.getByRole('button', { name: 'Keine Mängel' }).click(); // sollte abgelehnt werden (Mangel markiert)
await page.getByText('Es ist noch ein Mangel markiert').waitFor();
// restliche offenen Punkte: alle offenen Chips einmal tippen
for (;;) {
  const open = page.locator('.chips .chip[data-state="open"]');
  if ((await open.count()) === 0) break;
  await open.first().click();
}
const defect = page.locator('section.card--defect');
await defect.locator('.chip--phrase', { hasText: 'Backofen verschmutzt' }).click();
await defect.locator('textarea').press('End');
await defect.locator('textarea').pressSequentially(', eingebrannte Fettreste');
await defect
  .locator('input[type=file]')
  .setInputFiles([`tests/e2e/fixtures/foto1.jpg`, `tests/e2e/fixtures/foto2.jpg`]);
await defect.locator('.thumb img').nth(1).waitFor();
await page.locator('.chip--phrase', { hasText: 'Besenrein' }).last().click();
await page.locator('.chip--phrase', { hasText: 'Normale Abnutzung' }).last().click();
await page.locator('.chip--phrase', { hasText: 'Zählerschrank verschmutzt' }).last().click();
await page.getByRole('heading', { name: 'Schnellcheck' }).scrollIntoViewIfNeeded();
await shot(page, '07-kueche-mangel');
await defect.scrollIntoViewIfNeeded();
await shot(page, '08-kueche-mangel-fotos');
console.log('Notiz:', await page.getByLabel('Notizen zum Raum').inputValue());
await page.getByRole('button', { name: 'Küche abschließen' }).click();
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
    await page.getByRole('button', { name: 'Spiegel', exact: true }).click();
    await page.getByRole('button', { name: 'Handtuchhaken mehr' }).click();
  }
  if (title === 'Abschluss-Prüfungen') await shot(page, '09-abschlusspruefungen');
  await page.getByRole('button', { name: `${title} abschließen` }).click();
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
async function sign(name) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const c = page.locator('canvas.sigpad');
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 120);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) await page.mouse.move(b.x + 30 + i * 7, b.y + 110 - Math.sin(i / 3) * 40);
  await page.mouse.up();
  await shot(page, `13-unterschrift-${name.split(' ')[0]}`);
  await page.getByRole('button', { name: 'Übernehmen' }).click();
}
await sign('Hausverwaltung');
await sign('Anna Muster');
await shot(page, '14-unterschriften');
await page.getByRole('button', { name: /versiegeln/ }).click();
await page.getByText('Protokoll abgeschlossen und versiegelt').waitFor();
await shot(page, '15-versiegelt');
const [d1] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'PDF speichern' }).click(),
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
console.log('Fehler:', errors.length ? errors : 'keine');
await browser.close();
