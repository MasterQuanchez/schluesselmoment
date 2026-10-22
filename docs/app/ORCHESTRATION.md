# Orchestrierung – wie wir bauen

Muster wie bei ORIS: **Claude plant und prüft, Cursor baut, Philipp entscheidet.**
In Cursor gilt zusätzlich der Kit-Skill `orchestrate` (plan → implement → test in frischem Kontext → verify).

## Zwei Ebenen

| Ebene | Wer | Was | Wo festgehalten |
|---|---|---|---|
| Produkt-Orchestrator | Claude im claude.ai-Projekt „Schlüsselmoment“ | Zielbild, Spec + ACs, Entscheidungen, Prompts `SM-xx` schneiden, Ergebnisse prüfen (Code, Screenshots, PDF) | `knowledge/specs/E002-…`, `docs/app/DECISIONS.md`, `docs/prompts/` |
| Feature-Orchestrator | Cursor-Session (Modell beim Start gewählt) mit Skill `orchestrate` | Prompt planen, Subagents implementieren/testen lassen, verifizieren | Implementation Notes in der Spec, `docs/briefkasten/an-claude.md` |
| Entscheider | Philipp | Pläne freigeben („ja“), Fachfragen mit der Fachseite klären | `DECISIONS.md` (Offen-Liste) |
| Fachseite | Philipps Freund (Hausverwaltung) | Prüfpunkte, Begriffe, Fristen, Abnahme von Testläufen | – |

## Bahnen (je ein Cursor-Chat)

| Bahn | Thema | Dateien (Schwerpunkt) |
|---|---|---|
| **A** | Schnellerfassung & Ablauf (UX) | `frontend/src/features/*`, `frontend/src/ui/` |
| **B** | Harbour-Design | `frontend/src/styles/*`, `ui/Icon.tsx`, `public/` |
| **C** | PDF | `frontend/src/pdf/generate.ts` |
| **D** | PWA, Offline, Release, Hosting | `frontend/vite.config.ts`, `src/pwa.ts`, `vercel.json` |
| **E** | Daten & Sicherheit | `frontend/src/storage/`, `src/domain/schema.ts` |
| **F** | KI & Preise (später) | neu: `frontend/src/domain/pricing.ts`, Server-Funktion |
| **H** | Qualität: Tests, E2E, CI | `frontend/tests/`, `deployment/pipelines/` |

Eine Bahn ändert nur ihre Dateien. Übergreifendes (Schema, Katalog-Struktur) läuft über Bahn E bzw. mit Claude abgestimmt.

## Ablauf je Prompt

1. Claude legt `docs/prompts/SM-xx_*.md` an (verweist auf ACs der Spec).
2. Cursor-Chat der Bahn: Prompt einfügen → **Plan** (keine Code-Änderung).
3. Philipp: „ja“ oder Korrektur. Schema-, Sicherheits- oder Ablaufänderungen: Plan in den Briefkasten an Claude.
4. Cursor baut nach `orchestrate` (Builder testet nie selbst; Tester in frischem Kontext gegen die ACs).
5. `npm test && npm run typecheck && npm run lint` grün → Übergabe in `docs/briefkasten/an-claude.md` (was, welche ACs, Screenshots/PDF).
6. Claude prüft, schreibt Implementation Notes + DECISIONS fort, nächster Prompt.

## Prompt-Format

```
SM-xx · Titel (Bahn X). NUR PLANEN
Ziel: …  (ACs: AC…)
Ist-Stand: … (Dateien)
Umfang: …
Nicht im Umfang: …
Leitplanken: AGENTS.md; Fachkatalog nur domain/catalog.ts; Farben nur über Tokens; kein „Alle OK“.
Liefere als Plan: betroffene Dateien, Datenmodell/Migration (Philipps „ja“), Tests, Risiken. Höchstens 15 Zeilen.
```

## Briefkasten

- `docs/briefkasten/an-claude.md` – Cursor/Philipp → Claude: Ergebnisse, Fragen, Pläne zur Prüfung.
- `docs/briefkasten/an-cursor.md` – Claude → Cursor: Review-Ergebnisse, Korrekturen.
Neue Einträge oben, mit Datum und Prompt-ID. Erledigtes abhaken, nicht löschen.

## Definition of Done

- Läuft auf Android-Chrome (echtes Gerät oder Pixel-7-Viewport), auch offline.
- `npm test`, `typecheck`, `lint` grün; neue Logik hat Tests; betroffene ACs nachgewiesen.
- Keine Secrets im Client, keine neue Abhängigkeit ohne DECISIONS-Eintrag, keine echten Personen-/Objektdaten in Tests (Data Safety).
- Texte deutsch, einfache Sätze.
