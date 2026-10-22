# Schlüsselmoment — Übergabeprotokoll-PWA (auf Basis Phil Starter Kit)

Mobile-first PWA (Android) für Wohnungsübergabe, -abnahme und Bestandsaufnahme: Raum für Raum
durchklicken, Mängel mit Fotos, Unterschrift auf dem Gerät, versiegeltes PDF per E-Mail-App teilen.
**Kein Backend, kein Login, keine Datenbank** – alle Daten bleiben auf dem Gerät.
Visual language: **Harbour theme** (`docs/design/phil-theme.md`), umgesetzt in `frontend/src/styles/tokens.css`.

Pflichtlektüre vor jeder Aufgabe: `knowledge/specs/E002-schluesselmoment-v1.md` (Spec + ACs),
`docs/app/DECISIONS.md`, `docs/app/ORCHESTRATION.md`.

## Development Commands

### Frontend / App (TypeScript, Vite 8, React 19)

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173 (+ WLAN-IP fürs Handy)
npm test                # Vitest (Fachlogik, PDF)
npm run typecheck       # tsc --noEmit (strict)
npm run lint            # Biome
npm run build && npm run preview   # Produktions-Build inkl. Service Worker
```

### Kit-Werkzeuge (Python, nur Standardbibliothek + pytest)

Windows: python = py -3

```bash
uv sync --all-extras && uv run pytest   # Tests der Skills/Werkzeuge (kein App-Backend)
```

## Development Rules

- Read and understand relevant files before proposing edits. Don't speculate about code you haven't inspected.
- Avoid over-engineering. Only make changes that are directly requested or clearly necessary.
- Don't create abstractions for one-time operations. Don't design for hypothetical future requirements.
- Always create unit tests to confirm your changes. Run only tests relevant to your changes.
- Minimalistic logging. Avoid silent errors.
- **Fachlogik** nur in `frontend/src/domain/` als reine Funktionen (Eingabe → neues Objekt), mit Vitest-Tests.
  Fachkatalog (Prüfpunkte, Räume, Begriffe, Regeln) ausschließlich in `domain/catalog.ts`.
- **Datenmodell** = Zod-Schemas in `domain/schema.ts`. Änderung → `SCHEMA_VERSION` + Migration (Bahn E).
- **Design**: Harbour-Tokens exklusiv. Kit-Tokens (`--theme-current-color-*` …) + App-Aliase in
  `styles/tokens.css`; `components.css` enthält keine Hex-Werte. Kein Tailwind in diesem Projekt (D5).
  Primäraktionen = Navy-Pills 52 px, Karten `--radius-xl` + `--shadow-elevation-20`, Chips 40 px,
  Tri-State OK = success, Mangel = warning.
- **Sicherheit**: keine Secrets im Client (`VITE_*` ist öffentlich), kein `dangerouslySetInnerHTML`,
  keine Fremd-Domains (CSP in `frontend/vercel.json`), neue Abhängigkeiten nur mit Eintrag in DECISIONS.
- **Pflicht-Durchklicken**: Nichts einbauen, das Prüfpunkte gesammelt auf OK setzt (Entscheidung Fachseite).
- Texte deutsch, kurze Sätze, für Laien verständlich („Anna-sicher“).

## Model selection

Role→model routing lives in the [`orchestrate`](.cursor/skills/orchestrate/SKILL.md) skill — read it
before spawning subagents. Two things matter without opening it:

- **Name the model on every spawn.** Cursor routes a subagent from the spawn call, so an unnamed
  model silently falls back to the session/plan default. Resolve it as: **user-named models for the
  run first** (each mapped to a session-available slug), else
  [`models.toml`](.cursor/skills/orchestrate/models.toml) **by role** — and pass the slug explicitly
  either way. The **orchestrator is the model you start the session with**, a launch decision, not
  configuration; it cannot rename itself mid-run.
- **Route by verifiability, not price or taste.** Cheap, deterministic-to-check work goes to the
  `implementer`; expensive-to-check work (live UI, agent round-trips, taste) is orchestrator-planned
  and orchestrator-verified. The reasoning and the numbers are in
  [`routing.md`](.cursor/skills/orchestrate/routing.md) and `models.toml`.

**The builder never grades its own work** — verification runs in a fresh-context subagent against the
original spec (see `orchestrate` → "Verification"). The **spec** (`knowledge/specs/`) is the durable
state that survives a session ending; every stage reads it and appends to its Implementation Notes.

## Data Safety

Sensitive data follows the **vault pattern**: `.sensitive/` is gitignored (raw transcripts,
PII, security notes); tracked files use **first names only** — never last names, corporate user
IDs, org unit codes, or emails; **credentials** live in `.env`, never in code or markdown. Full
conventions, setup, and anonymization are in the **data-safety** skill
(`.cursor/skills/agent-factory/data-safety/SKILL.md`) — say `check data safety`.

**Proactive PII rule (always on).** If user-provided content contains last names, corporate IDs
(`[A-Z]\d{6,}`, `C:\Users\<id>\...`), email addresses, org unit codes, or pay grades, pause and
suggest the `data-safety` skill before proceeding — detection fires the rule, not only an
explicit request.
