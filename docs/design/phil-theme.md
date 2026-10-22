# Harbour theme — Phil Starter Kit

White, calm, elegant. Deep navy for ink and primary actions, ocean blue for brand moments.
Designed mobile-first for Schlüsselmoment (Übergabeprotokolle on Android/PWA).

> **Schlüsselmoment:** Die App nutzt kein Tailwind/Next.js. Die Tokens unten liegen wortgleich in `frontend/src/styles/tokens.css` (Teil 1), die Rezepte sind in `components.css` umgesetzt.

## How it plugs into the kit

The original `ai-first-dis` kit already separates **token names** from **values**:

```
globals.css (:root CSS vars)  →  tailwind.config.ts (maps classes to vars)  →  components (classes only)
```

Harbour only changes the values in `globals.css` and adds a few extra mappings in
`tailwind.config.ts`. Every existing class (`bg-primary`, `text-text-medium`, `shadow-elevation-10`…)
still works. To switch back to the SE look, restore the original `globals.css`.

## Palette

| Role | Token | Light | Dark |
|---|---|---|---|
| Ink / primary button | `--theme-current-color-primary` | `#0B1F3A` | `#E8EEF8` |
| Primary tints | `primary-10 … 90` | `#F1F5FB` → `#13294A` | `#16263F` → `#D3DDEF` |
| Accent (ocean) | `--theme-current-color-accent` | `#0A6CB8` | `#4AA3EC` |
| Focus / vivid | `primary-fluor` | `#2E6BE6` | `#6F9CFF` |
| Page | `background-main` | `#FFFFFF` | `#0D1829` |
| Framed / sections | `background-framed` | `#F5F7FB` | `#08111F` |
| Splash gradient | `background-brand-gradient` | `#0A6CB8 → #0B3D7C → #071A45` | same |
| Glass over photos | `background-glass` | navy 42 % + `backdrop-blur` | navy 55 % |
| Body text | `text-regular` | `#0F1B2D` (17.3:1) | `#EEF2F8` |
| Secondary text | `text-medium` | `#5F6B7E` (5.4:1) | `#9AA8BD` (7.4:1) |

Status colours (OK / Mangel / Hinweis) are kept separate from the brand:
success `#1F9D74`, warning `#D97A00`, alert `#E5484D`, each with a pale background and a
dark text tone that passes AA on it.

## Type

**Plus Jakarta Sans** (loaded with `next/font/google`, exposed as `--font-sans`).

| Class | Size / line | Weight | Use |
|---|---|---|---|
| `text-display` | 40 / 44 | 700 | Splash, empty-state hero |
| `text-h1` | 30 / 36 | 700 | Screen greeting ("Hallo, Lena") |
| `text-h2` | 22 / 28 | 600 | Section titles, card titles |
| `text-large` | 18 / 26 | 400 | Lead text |
| `text-standard` | 15 / 22 | 400 | Body |
| `text-small` | 12 / 16 | 500 | Labels, meta, captions |

Headings get `letter-spacing: -0.015em` and `text-wrap: balance`.

## Shape, depth, motion

- Radii: `rounded` 10, `md` 14, `lg` 20, `xl` 24 (cards), `2xl` 32 (hero images), `round` (pills).
- Shadows are navy-tinted and layered; never pure black. Cards: `shadow-elevation-20`.
  Primary buttons: `shadow-button`.
- Touch targets: buttons 52 px, chips 40 px.
- Easing `cubic-bezier(0.22, 1, 0.36, 1)`, 120 / 220 / 320 ms. Reduced motion respected globally.

## Component recipes

| Pattern | Classes |
|---|---|
| Primary CTA ("Protokoll abschließen") | `h-button-standard rounded-round bg-primary text-text-contrast shadow-button px-6` |
| Secondary CTA | `h-button-standard rounded-round border border-component-border bg-background-main` |
| Segmented chips ("Alle / Offen / Fertig") | active `bg-primary text-text-contrast`; idle `bg-background-framed text-text-medium` |
| Search field | `h-14 rounded-xl border border-component-border px-5` + filter icon after a divider |
| Object card with photo | `rounded-xl overflow-hidden shadow-elevation-20`; caption on `bg-background-glass backdrop-blur-md rounded-lg` |
| Tri-state check chip | OK → `bg-status-success-background text-text-success`; Mangel → `bg-status-warning-background text-text-warning` |
| Bottom nav | white, 4 icons, active = navy icon + 4 px accent dot |
| Splash | `bg-brand-gradient`, white wordmark, `text-text-brand-muted` claim |
