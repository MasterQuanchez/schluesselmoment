# Unknowns

Every explainer, brainstorm, interview, prototype, and reference is a cheap way to
find out what you didn't know before it gets expensive to fix.

## The four quadrants

| Quadrant | What it is | Your job |
|---|---|---|
| **Known knowns** | Already in the prompt | Keep accurate; don't repeat elsewhere |
| **Known unknowns** | Questions you know you haven't answered | Answer or defer with an explicit default |
| **Unknown knowns** | Obvious to you, invisible in the prompt (taste, aesthetics, industry conventions) | Surface via brainstorm, prototype, or teach-me |
| **Unknown unknowns** | Things you haven't considered at all | **The critical category** — blindspot pass, interviews |

**Specificity cuts both ways.** Too specific → the agent rigidly follows even when a
change of course is better. Too vague → decisions on industry defaults that don't fit.
When you don't account for your unknowns you fail both ways.

Give the agent your **starting point** — where you are in your thinking and your
experience with the problem. It can search the codebase and web faster than you can
enumerate gaps.

## The align sequence

Alignment is not "decide everything up front." It routes each open decision to the
cheapest technique for its quadrant, so you *recognize* and *confirm* far more than you
*author*:

**blindspot pass** (surface unknown-unknowns) → **brainstorm/prototype** (elicit
unknown-knowns by reaction) → **grill** (resolve known-unknowns, architecture-first;
glossary-aware when `GLOSSARY.md` / legacy `CONTEXT.md` exists) → **write the spec**.

Grill only the known-unknowns; let the agent carry the rest. That is what keeps a long
run from bottlenecking on your decisions.

## Pre-implementation

### blindspot pass

Ask the agent to scan the codebase and prompt and surface what you're likely missing.
Converts unknown unknowns → known unknowns cheaply. Best in unfamiliar code.

*Example:* "I'm adding a new auth provider but know nothing about the auth modules
here. Do a blindspot pass to surface my relevant unknown unknowns and help me prompt
you better."

### brainstorms & prototypes

For areas thick with **unknown knowns** (visual, aesthetic, UX taste): have the agent
generate several radically different directions as HTML artifacts to react to. Start
almost every session with an exploration phase to consciously define scope.

### interviews

One question at a time, each with a recommended answer, prioritising questions whose
answers would change the **architecture**. Challenge new terminology against a root
`GLOSSARY.md`, when one exists, rather than defining it again in the spec.
[`grill-me`](../../grill-me/SKILL.md) is the standalone form.

### references

Code is the best reference, even in another language — read the underlying implementation
rather than a screenshot or an API summary. For anything visual, a working HTML mockup
beats a description of one.

### implementation plan

Plan the parts most likely to change first (data models, type interfaces,
user-facing surface); mechanical refactors last.

### teach-me

When you don't know what "good" looks like in a domain, have the agent teach you
the domain to surface your own unknowns instead of blindly grading its variations.

## During implementation

On an unexpected edge case: pick the conservative option, log the deviation to the spec's
Implementation Notes, keep working. Notes go there rather than into a scratch file, so the
next run reads them without being told they exist.

## After

| Technique | When | What |
|---|---|---|
| **pitches / explainers** | Stakeholders need to understand the work | Bundle prototype + specs + implementation notes |
| **quizzes** | You need to verify you understand the changes | Agent generates an HTML report of changes + a quiz; don't merge until you pass with no errors |
