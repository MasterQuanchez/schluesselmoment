---
name: design
description: |
  Gateway for all design, UX, UI, and frontend work: route to the repo's design system/skill,
  enforce its stack, prototype the taste decisions, and hand off to the tester without self-grading.
  TRIGGERS: design, UI, UX, user interface, user experience, frontend, build a page, create a screen, dashboard, prototype, design review, design audit, accessibility, usability, layout, colors, typography, spacing, branding, 'add a frontend', 'set up the UI', 'build a prototype', 'create a page', 'design a page', 'build the UI'.
---

# Design — gateway to the repo's design system

All design, UX, UI, frontend, and accessibility work routes through **whatever design skill or
system the repo declares** — a design-system skill, a component library, or a documented token set.
This stage finds that system, enforces the repo's stack, and holds design to the same loop as code.

## Constraint

Use the **repo's declared stack and design system** — never introduce a parallel one. Do not pull in
a framework or component library the repo has not adopted, and do not hardcode colors, spacing, or
typography that the design system already names as tokens. If the repo has no design context yet,
offer to establish it, but do not block scoped work on existing code.

## Procedure

1. **Load design context.** Read the repo's design system, tokens, and any product-design notes
   before touching a surface, so you build with its vocabulary rather than inventing one.

2. **Route to the right operation.** Match the request to the design system's workflow — build from
   scratch, audit or critique existing UI, polish, harden accessibility and edge cases, or live
   browser iteration — and read that operation's reference before executing.

3. **Prototype where the decisions are visual.** Taste is the quadrant a human cannot enumerate but
   reacts to instantly, so generate real, high-fidelity directions and interview against them. A
   mockup is the best reference form downstream — better than a description. On cloud runs, share it
   as screenshots or video; the user cannot open raw HTML there.

4. **Implement in the repo's stack**, using its tokens and patterns. Add or update unit tests when
   logic changes.

## Do not self-grade

**Never browser-test your own UI to declare it working when a `tester` stage is expected** — that is
self-grading. Build and hand off; the tester drives the browser and captures the evidence, and a
fresh-context `review` judges it. Open a browser only for *live design iteration* or when the user
explicitly asks you to test. See [`orchestrate`](../../orchestrate/SKILL.md) → "Verification".

## Human checkpoints

- **Design direction** — the user approves the visual approach before large UI changes.
- **Prototype taste** — for new surfaces, prefer high-fidelity mockups the user can react to.

## Next

- Run `review` for a final quality check, and the repo's test suite to verify unit tests.
