# Design System Bridge

- **Type**: Feature
- **Status**: Done
- **Parent**: [E001-app-template](E001-app-template.md)
- **DevOps ID**: [#423640](https://siemensgamesa.visualstudio.com/SGRE%20Digital%20Transformation/_workitems/edit/423640)

## Context

The Dojo AI pattern library is under active development in `dis-ai-pattern-library/` but isn't published as an npm package yet. The template needs to ship with Dojo-styled components today while preserving a clean migration path to the real package. This feature bridges the gap by copying a token subset and simplified components, plus providing a script to pull design skills into any project.

## Requirements

### In Scope

- `frontend/tailwind.config.ts` with Dojo token mappings (colors, typography, spacing, radius, shadows, transitions)
- `frontend/src/app/globals.css` with `:root` CSS custom properties matching the pattern library's theme variables
- Weissenhof Grotesk font files in `frontend/public/fonts/`
- `scripts/install-design-skills.sh` that copies `.cursor/skills/dojo-*`, `.cursor/skills/design-*`, and `.cursor/rules/*.mdc` from the pattern library
- Design manifest file (`.cursor/design-manifest.json`) recording what was installed and when
- Header comment in each copied component: `// Reference implementation matching @wp/agentic-ux-toolkit — replace with package import when available`

### Out of Scope

- Full token set (only tokens used by the three hello-world components)
- Dark mode / theme switching
- Publishing the pattern library to Azure Artifacts
- Automated token sync (manual script is sufficient)
- The pattern library's custom `Icon` component (use lucide-react directly)

## Acceptance Criteria

- Given `tailwind.config.ts`, when Dojo token classes are used (e.g., `bg-primary-10`, `text-text-regular`), then they resolve to correct CSS values
- Given `globals.css`, when the page loads, then `--theme-current-*` CSS variables are set on `:root`
- Given the pattern library repo at a sibling path, when `scripts/install-design-skills.sh` runs, then dojo skills and rules are copied to `.cursor/`
- Given the script was run, when `--list` is passed, then installed skills are displayed
- Given the script ran previously, when `--update` is passed, then skills are refreshed from source
- Given the install script, when it runs, then it does NOT touch `.cursor/skills/agent-factory/`

## Decisions

- 2026-04-06: **Token subset, not full copy** — Only include tokens the hello-world components actually use. Keeps the template's Tailwind config readable and avoids implying completeness.
- 2026-04-06: **Bash script over npm postinstall** — The install script is a one-time or occasional operation, not a build step. A bash script is transparent and doesn't couple design skills to the Node dependency lifecycle.
- 2026-04-07: **Manifest file for traceability** — `.cursor/design-manifest.json` records source path, timestamp, and installed skill list so teams know what they have and when it was last updated.
- 2026-04-08: **Font files not bundled** — Weissenhof Grotesk loaded via CSS `@font-face` in `globals.css` rather than committed to `frontend/public/fonts/`. Avoids bloating the repo with binary font files; teams can add local fonts when needed.
