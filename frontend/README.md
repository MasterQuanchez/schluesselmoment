# Schlüsselmoment 2.0 – Übergabeprotokoll als PWA

Wohnungsübergabe, -abnahme und Bestandsaufnahme auf dem Android-Handy erfassen: Raum für Raum mit Schnellcheck,
Fotos bei Mängeln, Unterschrift aller Beteiligten auf dem Gerät, versiegeltes PDF zum Teilen.

## Start

```bash
npm install
npm run dev          # http://localhost:5173 und im WLAN über die angezeigte IP (Handy)
npm test             # Fachlogik + PDF (Vitest)
npm run typecheck
npm run lint         # Biome
npm run build && npm run preview   # Produktions-Build inkl. Service Worker testen
```

Node ≥ 22. Auf dem Handy installieren: Seite in Chrome öffnen → Menü → „App installieren“.
Kamera und Service Worker brauchen HTTPS (lokal: `localhost` oder Vercel-Preview).

## Was der Kern kann (Stand 2.0.0-alpha.2)

| Bereich | Umsetzung |
|---|---|
| Ablauf | Basis → Räume → Zähler/Schlüssel → Abschluss, Fortschritt oben |
| Schnellerfassung | „Keine Mängel“ / „Mängel“, Schnellcheck-Chips (OK → Mangel → zurück), Schnellauswahl-Begriffe hängen an Notiz an |
| „Nichts vergessen“ | Pflicht-Durchklicken: jeder Punkt einzeln ✓/⚠, kein „Alle OK“; Mangel braucht Beschreibung + 2 Fotos |
| Raumliste | aus Ausstattung (Zimmer, Bäder, Küche normal/Einbau, Gäste-WC, Balkon/Terrasse/Loggia/Wintergarten, Keller) |
| Fotos | Kamera direkt, verkleinert auf 1600 px, EXIF/GPS entfernt, als Blob in IndexedDB |
| Unterschrift | Inhalt festschreiben → alle unterschreiben → versiegeln (SHA-256 über Daten, Unterschriften, Fotos) |
| PDF | auf dem Gerät (pdf-lib), Text-PDF, Fotoanhang mit Abb.-Nummern, Prüfwert in Fußzeile |
| Versand | Teilen-Menü → E-Mail-App mit PDF-Anhang; Empfänger (Mieter, Vermieter, feste Kopie) in Zwischenablage |
| Datenschutz | Daten nur auf dem Gerät; versendete Protokolle 30 Tage nach Versand automatisch gelöscht |
| Anpassbar | Standardbegriffe zentral (`domain/catalog.ts`, per App-Update), eigene Begriffe je Gerät unter „Mehr“; `src/config.ts` |
| Design | Harbour-Theme (Kit), Plus Jakarta Sans selbst gehostet |
| Offline | PWA (vite-plugin-pwa), Daten nur lokal |

## Struktur

```
src/
  domain/     schema.ts (Zod-Datenmodell) · catalog.ts (Fachkatalog aus Word-Protokoll) · protocol.ts (reine Logik)
  storage/    db.ts (IndexedDB) · useProtocol.ts (Provider + Autosave) · photos.ts
  features/   home · setup (Basis) · rooms (Raumliste, Schnellerfassung) · extras (Zähler/Schlüssel) · sign (Abschluss)
  pdf/        generate.ts
  ui/         Icon.tsx · kit.tsx · Photos.tsx
  styles/     tokens.css (Harbour-Tokens + App-Aliase) · base.css · components.css
  config.ts   Firmenname, feste Kopie-Adresse, Löschfrist
tests/        Vitest + e2e/flow.reference.mjs
```

Fachliche Änderungen (neuer Prüfpunkt, neuer Begriff, andere Regel) → nur `src/domain/catalog.ts`.
Design-Änderungen → nur `src/styles/tokens.css`. Doku: `../docs/app/`, Spec: `../knowledge/specs/E002-schluesselmoment-v1.md`.
