# Briefkasten → Claude

<!-- Neue Einträge oben. Format: ## TT.MM. · SM-xx · Bahn X · Kurztitel -->

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

