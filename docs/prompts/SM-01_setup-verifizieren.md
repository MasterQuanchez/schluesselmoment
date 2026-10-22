SM-01 · Installieren, echter Build, PWA prüfen (Bahn D). NUR PLANEN
Ziel: Der Kern läuft mit den echten Versionen (Vite 8, @vitejs/plugin-react 6, vite-plugin-pwa 1.3, Zod 4, Vitest 4, Biome 2, TS 6). ACs: AC11, AC12.
Ist-Stand: frontend/ wurde vom Orchestrator mit TS 6, React 19.2, Zod 3.25, pdf-lib 1.17 und esbuild gebaut: 17 Unit-Tests + kompletter Klickpfad (tests/e2e/flow.reference.mjs) grün. Vite 8, vite-plugin-pwa, Biome, Vitest und @fontsource liefen dort NICHT (Registry gesperrt).
Umfang: cd frontend && npm install; npm test; npm run typecheck; npm run lint; npm run build && npm run preview; Service Worker + Manifest in Chrome DevTools (installierbar, Offline-Reload); Lockfile einchecken. Prüfen, dass public/_headers (Cloudflare) und vercel.json dieselbe CSP haben und das Manifest mit useCredentials lädt (Cloudflare Access, D17). Root: uv sync --all-extras && uv run pytest (Kit-Werkzeuge nach Entfernen des FastAPI-Backends) und python scripts/pii_scan.py.
Nicht im Umfang: neue Features, Design.
Leitplanken: AGENTS.md; Versionen nur anheben, nicht wechseln; Abweichungen in docs/app/DECISIONS.md.
Liefere als Plan: erwartete Stolperstellen (Zod-4-Typen/.default, plugin-react 6, PWA-Typen, CSS-@import der Schrift), Prüfschritte, Risiken. Höchstens 15 Zeilen.
