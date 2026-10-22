# Briefkasten → Claude

<!-- Neue Einträge oben. Format: ## TT.MM. · SM-xx · Bahn X · Kurztitel -->

## 22.10. · SM-13 · Bahn B · App-Icon F7 „Breakout tick“

Prompt-ID: SM-13 (vorher als SM-09 entworfen; SM-09 = UI-Übernahme aus Prompt 01)
ACs: Icon-Dateien aus `icon/icons-f7/public/` nach `frontend/public/` kopiert (nicht neu gezeichnet). Platzhalter `icon.svg` und `icon-maskable.svg` gelöscht. Quellen `source-icon.svg` und `source-maskable.svg` nach `frontend/assets/brand/`. Ordner `icon/icons-f7/` gelöscht, nicht eingecheckt. `index.html` verweist auf favicon.ico, favicon.svg und apple-touch-icon. VitePWA: vier Manifest-Icons, `any` und `maskable` getrennt, `background_color` `#07142B`, `theme_color` `#0B1F3A`, Precache inkl. png/ico/webmanifest. `useCredentials: true` und `injectRegister: false` unverändert. `public/_headers` unberührt. Kein Logo-Platzhalter in Splash oder Leerzustand (SM-09), deshalb dort nichts geändert.
Ergebnis: Build ✓. Test ✓ (23). `biome check vite.config.ts` ✓ (Exit 0, nur die bekannten Schema-Infos). `npm run lint` im ganzen Frontend ist rot wegen paralleler, nicht zu SM-13 gehörender Dateien (ElementSheet, RoomScreen, generate.ts, Tests) — nicht angefasst und nicht eingecheckt. `dist/manifest.webmanifest` listet 4 Icons (`any` und `maskable` getrennt). Alle Icon-Dateien liegen in `dist/` und in der Precache-Liste von `dist/sw.js` (png, ico, svg, webmanifest). Chrome `Page.getAppManifest`: `errors: []`, vier Icons geladen (64, 192, 512, maskable 512). Maskable: kein Strich außerhalb des inneren 80-Prozent-Kreises. Splash/Leerzustand ohne Logo, unverändert.
Entscheidung: D24.
Offene Punkte: iPhone merkt sich das Icon beim Installieren (SM-10) — App vom Home-Bildschirm löschen und neu hinzufügen. Untracked bleibt `icon/SM-09-app-icon.md` (Prompt-Kopie), nicht eingecheckt.

## 22.10. · SM-01 · Bahn D · Build/PWA geprüft

Ergebnis: GELB
Versionen: node 24.11.1, vite 8.3.5, @vitejs/plugin-react 6.1.2, vite-plugin-pwa 1.3.0, zod 4.6.7, vitest 4.1.11, @biomejs/biome 2.6.2, typescript 6.0.3, react 19.3.1
Befehle: typecheck ✓ · test ✓ (18, davon 1 neu: CSP-Vergleich) · lint ✓ (Exit 0, 2 Infos) · build ✓ · e2e ✓ · pytest ✗ · pii_scan ✗
AC11 Offline: ✓ — Chrome, Pixel-7-Emulation, `navigator.onLine === false`, Service Worker aktiv, Reload, neues Protokoll „Abnahme“ angelegt und Straße gespeichert. Screenshots: `frontend/test-results/sm01/` (gitignored). Kein echtes Android.
AC12 CSP: ✓ — CSP in `public/_headers` und `vercel.json` zeichenweise gleich (Vitest). `vite preview` (Port 4173) sendet diese Header. Nach dem Schrift-Fix: Klickpfad letzte Zeile „Fehler: keine“, keine Fremd-Domain.
Geänderte Dateien: `frontend/vite.config.ts` — `assetsInlineLimit: 0`, damit Vite die kleine Kyrillisch-Schrift nicht als `data:` einbettet (`font-src 'self'` hat sie vorher viermal blockiert). Preview-Header, HSTS ohne `preload`, Lockfile, Header-Test und Biome-Fixes liegen schon in `9133eee`.
Abweichungen/DECISIONS: keine neue Abhängigkeit, kein D19. `vite-plugin-pwa@1.3.0` akzeptiert Vite `^8` als Peer. Install-Warnung nur `glob@11.1.0` deprecated, kein Peer-Konflikt. `npm audit`: 2 moderate, nicht angefasst.
Biome-ignore (Regeln nicht abgeschwächt): `RoomScreen.tsx` (Hinweis-Liste beim Raumwechsel zurücksetzen), `kit.tsx` Feld-Label und Stepper, `base.css` `!important` für reduced motion.
Offene Punkte / Fragen an Claude: `uv` und ein echtes Python fehlen auf diesem Rechner (nur der Store-Stub), deshalb kein `uv sync`, kein pytest, kein `pii_scan`, kein neues `uv.lock`. Biome-Schema steht auf 2.4.0, CLI ist 2.6.2 (`recommended` deprecated) — nicht migriert. Push dieses Commits nicht ausgeführt.
Chunk-Größen: `index-*.js` 374.16 kB (gzip 113.56 kB), `generate-*.js` 428.16 kB (gzip 179.14 kB). Schrift als woff2 in `dist/assets`, darunter `cyrillic-ext` 1.71 kB. `sw.js` und `manifest.webmanifest` vorhanden, Manifest-Link `crossorigin="use-credentials"`, kein Inline-Script.

