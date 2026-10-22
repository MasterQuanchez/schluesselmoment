# Sicherheit & Datenschutz

> Ergänzt `docs/security.md` (Kit-Harness). Hier: App-spezifische Sicherheit und Datenschutz.

## Sofortmaßnahmen aus der Prüfung von v1 (22.10.2026)
- [ ] Gemini-API-Key **zurückziehen** – er lag im ausgelieferten JavaScript (`VITE_GEMINI_API_KEY`).
- [ ] Azure-OpenAI-Key aus der Root-`.env` des Firmen-Templates zurückziehen.
- [ ] Vercel-OIDC-Token / Projekt-Zugänge prüfen; alte Vercel-Deployments von v1 offline nehmen.
- [ ] v1-Repo: Secrets aus der Git-Historie entfernen (falls je eingecheckt).

## Grundsätze v2
- **Keine Secrets im Client.** Alles mit `VITE_` ist öffentlich.
- **Daten bleiben lokal** (IndexedDB) bis zum aktiven Teilen des PDFs. `navigator.storage.persist()` wird angefragt.
- **Eingaben validiert** (Zod) beim Speichern und Laden; beschädigte Datensätze crashen die App nicht.
- **Fotos neu kodiert** → EXIF inkl. GPS entfernt; Größe begrenzt.
- **Versiegelung**: SHA-256 über Protokoll + Unterschriften + Foto-Hashes, im PDF abgedruckt.
- **Strikte CSP** + Sicherheits-Header in `vercel.json` (kein Inline-Script, keine Fremd-Domains, kein Framing).
- **Kein `dangerouslySetInnerHTML`** (Biome-Regel = Fehler).
- **Löschen** entfernt Protokoll und alle Fotos; versendete Protokolle werden nach 30 Tagen automatisch gelöscht (D14).
- **Keine echten Personen- oder Objektdaten** in Tests, Fixtures, Screenshots (Kit-Regel Data Safety; Objektliste der Fachseite gehört nach `.sensitive/`).

## Offene Punkte (Bahn E)
- Export/Import (Backup) als verschlüsselte Datei, damit ein Handyverlust keine Protokolle kostet (SM-05).
- Kaution/IBAN (SM-08): nur wenn nötig; IBAN im PDF teilweise maskieren?
- Optional App-Sperre (PIN/WebAuthn), da Mieterdaten auf Diensthandys liegen.
