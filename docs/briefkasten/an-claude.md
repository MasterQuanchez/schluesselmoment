# Briefkasten → Claude

<!-- Neue Einträge oben. Format: ## TT.MM. · SM-xx · Bahn X · Kurztitel -->

## 23.10. · SM-15 · Zusatz · 1 Foto, noindex, Zielgeräte

Prompt-ID: SM-15-Zusatz (Entscheidungen 23.10.).
ACs: AC4 „≥ RULES.minPhotosPerDefect (derzeit 1) Foto“.
Entscheidungen: D7 „1 Pflicht-Foto (Fachseite 23.10.; vorher 2)“. D17 Status „Zurückgestellt bis nach Feinschliff; bis dahin noindex“. D33 Zielgeräte Android und iPhone gleichrangig, Klickpfad auf Pixel 7 und iPhone 15. D34 verweist auf noindex bis D17. D35 liegt im Commit davor (pdfjs-dist nur im Test).
Ergebnis: GRÜN. typecheck ✓ · test ✓ (33, Vitest 4.1.12) · lint ✓ (Exit 0). Klickpfad Pixel 7 und iPhone 15, jeweils „Fehler: keine“. Küche: Mangel ohne Foto, Knopf „Wände: 1 Foto fehlt“, ein Foto, Vorschlag „Dübellöcher“, Fertig.
noindex: `X-Robots-Tag` in `_headers` und `vercel.json`, `robots.txt` sperrt `/`, Meta-Tag im HTML.
Offene Punkte: D17 (Zugangsschutz) bleibt zurückgestellt. Kein echtes iPhone, der Klickpfad läuft im Chromium mit Geräteprofil.

## 23.10. · SM-17 · Bahn C · PDF-Seitenumbrüche

Prompt-ID: SM-17. Commit `6b76e81`.
Blöcke werden gemessen und dann gezeichnet. Ein Mangel (Zeile, Text, Foto-Reihe, Unterschrift) bleibt auf einer Seite, außer er ist allein höher als die Seite: dann erst nach einer ganzen Foto-Reihe. Raumkopf nicht allein am Seitenende, kurzer Raum ohne Mangel bleibt zusammen. Fortsetzung „Raum (Fortsetzung)“ in text-medium. Zähler, Schlüssel und Unterschriften je ein Block; Unterschriften und Versiegelung auf einer Seite. Fotohöhe aus dem Seitenverhältnis, max. 160 pt, gemischte Reihe oben bündig. Fußzeile, Seitenzahl und DEMO-Wasserzeichen unverändert.
Test: drei Mängel mit je Hoch- und Querformat und langem Text. Layout-Protokoll nur im Test. Seitenbilder `frontend/test-results/sm17/` (gitignored), gerendert mit lokalem pdfjs-dist, ohne CDN.
Entscheidung: D35.
Prüfung: typecheck ✓ · test ✓ (33) · lint ✓. Klickpfad siehe Eintrag darüber.
Offene Punkte: keine.

## 23.10. · SM-10 · Bahn A + D · Morgen-Abschluss

Prompt-ID: SM-10 Morgen-Abschluss.
Bestand: `origin/main..main` leer. Teil 1 `fa3c0c4`, Teil 2 `9d1cd75`, beide schon auf `origin`. Höchste D-Nummer ist D32. D29 und D30 bleiben die SM-10-Einträge.
Uncommittete `schema.ts`, `HomeScreen.tsx`, `FinishScreen.tsx`: kein Inhaltsunterschied, nur Zeilenenden. Nicht angefasst. `SettingsScreen.tsx` und `photos.ts` sind sauber.
Prüfung: typecheck grün. Vitest 31 grün. Ein Lauf des EXIF-Tests ist am Chromium-Start nach 30 s ausgelaufen, der nächste Lauf und die ganze Suite waren grün. Lint grün. Klickpfad Pixel 7 und iPhone 15, jeweils „Fehler: keine“. Gespeichertes Bild 16×32. Port 4173 war belegt, die Vorschau wurde mit dem frischen Build neu gestartet.
Offene Punkte: kein echtes iPhone.

## 23.10. · SM-15 · Aufräumen, Detail-Gruppen

Prompt-ID: SM-15. Start nach `git pull`: SM-10 `9d1cd75` und SM-16 `da7b167` liegen auf `main`.
ACs: Attribut-Gruppen im Element-Sheet als Raster (Beschriftung 104 px, Optionen rechts, Trennlinie). Unter 360 px steht die Beschriftung über den Optionen, die Trennlinie bleibt. Keine Fachlogik.
Entscheidungen: D31 Schriften nicht einbetten (`assetsInlineLimit: 0`). D32 Python auf Windows über `py -3`. D19/D20 bewusst nicht vergeben.
Ergebnis: GRÜN. typecheck ✓ · test ✓ (31, Vitest 4.1.12) · lint ✓ (Exit 0, keine Infos) · Klickpfad Pixel 7 und iPhone 15, jeweils „Fehler: keine“.
Raster: Wände und Fenster auf Pixel 7, Optionen rechts, folgende Zeile `border-top` 1 px. Bei 359 px eine Spalte, Beschriftung darüber, Trennlinie bleibt. Screenshots `frontend/test-results/sm15/` (gitignored).
Audit: 2 moderate, nur Dev (`vitest` / `@vitest/mocker`). `npm audit fix` ohne `--force` hebt Vitest von 4.1.11 auf 4.1.12, kein Major. Danach 0 Funde.
Biome-Ignore bleibt: `kit.tsx` Label-Kind und Stepper-`role=group`, `BasisScreen.tsx` Mieter ohne eigene Id, `base.css` zweimal `!important` für reduced motion.
pytest: 12 grün. Kein Test erwartet das entfernte Backend.
`core.hooksPath` lokal auf `.githooks`. Lockfile-Scan Exit 0.
Offene Punkte: Splash bleibt SM-09. Firmenlogo im PDF bleibt O2.

## 23.10. · SM-16 · Bahn A + C · Mangel-Ablauf

Ergebnis: GRÜN. typecheck ✓ · test ✓ (31) · lint ✓ (Exit 0, 2 Schema-Infos) · Klickpfad Pixel 7 und iPhone 15, jeweils „Fehler: keine“. Screenshots `frontend/test-results/sm16/` (gitignored).
Prompt-ID: SM-16 (v2) plus drei Ergänzungen: keine feste Foto-Zahl, kein Fokus auf das Textfeld, im E2E nur der Küchen-Abschnitt (der Flur-Knopf musste mit, weil er nicht mehr „Noch N offen“ heißt).
ACs: AC13 ohne Sammelanhang. Chip auf Mangel öffnet das Sheet, Fokus auf den Titel. Fotos über Kamera und Galerie, Status „Noch 1 Foto nötig“ / „✓ 2 Fotos“ aus `RULES.minPhotosPerDefect`. Knopf nennt Element und Grund. Vorschläge je Element, Raum-Notiz nur Zustandsbegriffe.
Entscheidungen: D26, D27, D28. D25 war bereits der iPhone-Eintrag aus SM-10.
Offene Punkte: Frage an die Fachseite, ob ein Foto reicht oder zwei bleiben. Keine Kopie in die Handy-Galerie (Web-Grenze). `photos.ts` nicht geändert.

## 23.10. · SM-10 · Bahn A + D · Fotos robust, Speicherstatus

Prompt-ID: SM-10 Teil 2
ACs: `storePhoto` dekodiert mit `createImageBitmap` und `imageOrientation: 'from-image'`, bei Fehler ohne Option, dann über `img.decode()` und Canvas. Unlesbares Format: „Dieses Bildformat kann nicht gelesen werden. Bitte direkt mit der Kamera fotografieren.“ In `photos.ts` nur `storePhoto` geändert. Datenschutz zeigt „Speicher dauerhaft: ja/nein“ aus `navigator.storage.persisted()`. Bei „nein“ auf iOS: „Zum Home-Bildschirm hinzufügen, damit Protokolle sicher gespeichert bleiben.“
Entscheidungen: D29 „Senden zweistufig wegen Safari-Nutzeraktion“, D30 „Installationshinweis iOS / Android-Install-Angebot“. D26–D28 waren im Arbeitsbaum schon von SM-16 belegt.
Prüfung: typecheck grün. Vitest 31 grün. Die EXIF-Fixture (Rohbild 32×16, Orientierung 6) ist nach dem Dekodieren 16×32. Node hat kein `createImageBitmap`, der Test läuft in Chromium. Klickpfad Pixel 7 und iPhone 15, jeweils „Fehler: keine“. Gespeichertes Vorschaubild 16×32. Ein Pixel-Lauf direkt nach iPhone meldete zweimal MIME `text/html`, der Wiederholungslauf war sauber. Screenshots in `frontend/test-results/sm10/` (gitignored): Abschluss mit PDF-Vorschau, iPhone-Installationskarte.
Offene Punkte: kein echtes iPhone (Playwright bleibt Chromium mit Geräteprofil). `features/rooms/*`, `catalog.ts`, `protocol.ts`, `pdf/generate.ts`, `Photos.tsx` nicht in diesem Commit.

## 23.10. · SM-10 · Bahn A + D · iPhone-Senden und Installationshinweis

Prompt-ID: SM-10
ACs: Abschluss zweistufig – „PDF vorbereiten“ (Dateiname, Größe, Seitenzahl), „Per E-Mail senden“ ruft `navigator.share` ohne await davor im Klick auf. Empfänger im selben Klick in die Zwischenablage, nicht awaiten. AbortError still. Ohne Share-API Download. Geändertes oder neu versiegeltes Protokoll verwirft die Datei. iOS-Safari ohne Home-Bildschirm-App zeigt die Karte, wegklickbar über `dismissedIosInstallHint` (Default, keine Schemaversion). Android nur „App installieren“, wenn `beforeinstallprompt` kommt. `apple-mobile-web-app-capable` in `index.html`. `features/rooms/*`, `catalog.ts`, `protocol.ts`, `pdf/generate.ts`, `Photos.tsx` nicht angefasst. Im E2E nur der Abschluss: vorbereiten, dann senden.
Entscheidung: D25.
Offene Punkte: echtes iPhone nicht geprüft (Playwright bleibt Chromium). Der Prompt brach beim Meta-Tag ab; ergänzt sind `content="yes"`, Statusleiste `default` und Titel „Schlüsselmoment“.

## 23.10. · SM-14 · Bahn E · Secret-Check

Prompt-ID: SM-14
Stand: nach `git pull`, SM-11 `4841aaf` und SM-12 `436c2ef` auf `origin/main`. Nur geprüft, frischer `npm run build`.

| Prüfung | Fund | Stelle |
|---|---|---|
| Schlüssel-Muster, Git-Historie | ja, nur Test-Platzhalter | `tests/hooks/run_tests.sh:361`, in allen 7 Commits seit `9133eee`. Hook-Test für `redact-secrets.sh`. |
| Schlüssel-Muster, Arbeitsbaum ohne `node_modules` | ja, dieselbe Stelle | `tests/hooks/run_tests.sh:361`. Auf der Platte nur `.env.example` und `frontend/.env.example`. |
| `.env` / `.env.local` getrackt | nein | `git ls-files`: `.env.example`, `frontend/.env.example`, `frontend/src/vite-env.d.ts`, `.cursor/skills/deploying-streamlit-in-snowflake/templates/environment.yml` |
| `.gitignore` deckt `.env*` ab | ja, Lücke `.envrc` | `.env` Zeile 15, `.env.local` Zeile 16, `.env.*` Zeile 71, Ausnahme `!.env.example` Zeile 72. `.envrc` und `.envfoo` sind nicht ignoriert. |
| `frontend/dist`: generativelanguage | nein | 20 Dateien nach dem Build |
| `frontend/dist`: `VITE_`-Wert | nein | kein Treffer. Dasselbe Schlüssel-Muster über `dist`: kein Treffer. |
| `frontend/dist`: fremde Domain | ja, nur Bibliotheks-Strings | `workbox-2fbc6a65.js:1` bit.ly (Warntext). `assets/generate-DgWYgCMI.js:38` github.com (pdf-lib-Producer). `assets/index-DwQr__xV.js:1` react.dev (Fehler-URL), Zeile 8 www.w3.org (SVG-Namespace), Zeile 63 json-schema.org (Schema-Kennung). Kein Abruf. |
| `pii_scan` | ja | `python` ist der Store-Stub (Exit 9009). `py -3` ist Python 3.14.2. Ohne Pfad Exit 2. `py -3 scripts/pii_scan.py .` Exit 1: `frontend/package-lock.json:2464` (corp-id, Integrity-Hash), `frontend/package-lock.json:3970` (email im Deprecated-Text), `.cursor/skills/knowledge-audit/SKILL.md:58` (user-path, Platzhalter in der Prüftabelle), `.cursor/skills/lookup-user-by-gid-or-email/SKILL.md:15` (email, Beispiel in der Skill-Doku). Kein `redaction-config.local.json`. |

Offene Punkte: kein Live-Schlüssel. Die vier PII-Treffer liegen im Lockfile und in der Skill-Doku.

## 23.10. · SM-13a · Bahn B · Icon in der App

Prompt-ID: SM-13a (Schritte 1–3; Schritt 0 ist `c1a75cb`)
ACs: Wortmarke nur in der Start-Kopfzeile: `/favicon.svg` 28 px, daneben „Schlüsselmoment“ in `--fw-bold` und `--c-primary`, „Mehr“ bleibt rechts. Leerzustand: Icon 72 px, „Noch keine Protokolle.“, Claim „Übergaben, die einfach stimmen.“ in text-medium, danach der Hinweis auf „+“. Einstellungen, Abschnitt Datenschutz: Icon 40 px neben der Version. Arbeits-Screens ohne Icon. Kein Icon im PDF.
Ergebnis: test ✓ (23) · lint ✓ (Exit 0, 2 Infos zum Biome-Schema). Basisdaten ohne Marke. Version in den Einstellungen 40 px. Screenshots: `frontend/test-results/sm13/` (gitignored), Startseite leer und mit Protokoll „Musterstraße 1“.
Entscheidung: D24 (Start-Hintergrund weiß schon in `c1a75cb`).
Offene Punkte: Splash bleibt SM-09. Firmenlogo im PDF bleibt O2.

## 22.10. · SM-12 · Bahn H · Demo-Protokoll

Prompt-ID: SM-12
ACs: `createDemoProtocol` in `frontend/src/domain/demo.ts` (Abnahme, Musterstraße 1, 70173 Stuttgart, 2. OG links, erstellt von Demo, Einbauküche, Balkon, Keller, Parteien, Zähler, Schlüssel, Notiz). Alle Räume außer der Küche abgeschlossen; Küche genau ein Mangel am Backofen, Fotos leer. Knopf „Demo-Protokoll erstellen“ unter Mehr → Test & Vorführung speichert zwei Canvas-Fotos, schließt die Küche ab und öffnet den Abschluss. Startseite zeigt die Pill DEMO, wenn `inspector === 'Demo'`. „Erstellt von“ ist dann schreibgeschützt, Hinweis „Demo-Protokoll“. PDF: diagonales Wasserzeichen DEMO (primary-20, Deckkraft 0.15), Betreff „DEMO – kein echtes Protokoll“, Keyword `demo`. `features/rooms/*` und `setDetail`/`cycleCheck` nicht geändert.
Ergebnis: typecheck ✓ · test ✓ (23) · lint ✓ (Exit 0, 2 Infos zum Biome-Schema, unverändert). Manuell: Mehr → Demo → Abschluss („Alles erfasst“, 9/9 Räume) → festschreiben → zwei Unterschriften → versiegeln → PDF speichern (`Abnahmeprotokoll_Musterstrasse-1_2026-10-22.pdf`, kein PDF-Fehler). Screenshots: `frontend/test-results/sm12/` (gitignored).
Entscheidung: D23.
Offene Punkte: keine.

## 22.10. · SM-11 · Bahn A · Element-Sheet, Details zählen

Ergebnis: GRÜN
Befehle: typecheck ✓ · test ✓ (23, davon 3 neue setDetail-Fälle) · lint ✓ (Exit 0, 2 Infos: Biome-Schema 2.4.0 vs CLI 2.6.2) · e2e ✓ Pixel 7 und iPhone 15, letzte Zeile jeweils „Fehler: keine“.
Theme: `color-scheme: dark` im Browser, Token `--theme-current-color-background-main` bleibt `#fff`. Die System-Dunkel-Abfrage in `tokens.css` ist entfernt. `[data-theme=dark]` bleibt. `color-scheme=light` und D21 lagen schon in `540ddd2`.
Verhalten: Ein gesetztes Detail setzt nur dieses offene Element auf OK (D22). Mangel bleibt Mangel. Kein Sammel-OK. Die Liste „Bitte noch erledigen“ ist weg. Offene Chips haben einen gestrichelten Warn-Rand. Der untere Knopf sagt „Noch N offen“ bzw. „Noch N Punkte zu klären“ und springt zum ersten offenen Chip oder öffnet den ersten unvollständigen Mangel. Fertig: „Raum fertig – weiter zu …“.
Klickpfad: Flur Decke „Neu“ und Boden „Parkett“ über das Sheet, danach ✓. Küche: Mangel Backofen im Sheet mit Text und 2 Fotos. Screenshots `frontend/test-results/sm11/` (gitignored): `pixel7-` und `iphone15-` plus `sm11-offen`, `sm11-sheet`, `sm11-mangel`, `sm11-fertig`. Kein echtes Gerät.
Nicht eingecheckt (parallel, nicht SM-11): Demo-Protokoll, PDF-Betreff, Home/Einstellungen/Basis.
Offen: Biome-Schema nicht migriert. pytest und pii_scan weiter ohne lokales Python.

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

