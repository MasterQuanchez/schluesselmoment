# @wp/agentic-ux-toolkit — Install Guide

Step-by-step walkthrough for installing the toolkit. The design skill offers this
when the toolkit is not yet installed. The user can skip any step they've already done.

## Step 1 — Create a frontend (if none exists)

If there is no `frontend/` directory:

```bash
npx create-next-app@latest frontend
```

Recommended options: TypeScript, Tailwind CSS, App Router, `src/` directory.

## Step 2 — Install the toolkit

```bash
cd frontend
npm install @wp/agentic-ux-toolkit
```

## Step 3 — Import the stylesheet

In `frontend/src/app/layout.tsx`, add at the top of the imports:

```tsx
import "@wp/agentic-ux-toolkit/styles.css";
```

This provides all design tokens (CSS custom properties) and base styles.

## Step 4 — Fonts & icons (automatic)

Fonts (**Weissenhof Grotesk Variable**) and icons are copied automatically from
the toolkit into `public/fonts/` and `public/icons/` by the `postinstall` script
that runs after every `npm install`. No manual step needed.

- The copy script lives at `scripts/copy-toolkit-assets.js`.
- Both directories are gitignored — the toolkit remains the single source of truth.
- If the toolkit is not yet installed the script exits silently; the fallback font
  stack (`Segoe UI`, `system-ui`, etc.) and `lucide-react` icons still work.

## Step 5 — Configure dark mode (optional)

Add `data-theme="dark"` to the `<html>` element for dark mode. In `tailwind.config.ts`:

```ts
darkMode: ['selector', '[data-theme="dark"]'],
```

## Step 6 — Peer dependencies

Required:
- React 18 or 19
- Next.js 14 or 15

Optional:
- `echarts` 5 or 6 (only for chart components)

## Step 7 — Package exports reference

| Import | What it provides |
|---|---|
| `@wp/agentic-ux-toolkit` | All React components |
| `@wp/agentic-ux-toolkit/styles.css` | Design tokens + base styles |
| `@wp/agentic-ux-toolkit/tailwind-config` | Full Tailwind config with token mapping |

## Step 8 — Verify

```tsx
import { PrimaryButton } from "@wp/agentic-ux-toolkit";

export default function TestPage() {
  return <PrimaryButton>It works</PrimaryButton>;
}
```

Run `npm run dev` and confirm the button renders with the WP CI purple brand color.

## After install

Return to the design skill — it will detect the toolkit and route to the appropriate
skill for whatever the user originally wanted to do.
