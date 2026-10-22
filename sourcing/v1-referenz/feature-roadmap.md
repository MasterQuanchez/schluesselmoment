# Hausübergabe App - Feature Roadmap

This document outlines the phased development roadmap for the Hausübergabe App, based on competitive analysis and stakeholder discussions (November 2025).

---

## Phase 1: MVP

Core features for initial release. Focus on the guided inspection flow that differentiates us from competitors.

| Feature | Description | Priority |
|---------|-------------|----------|
| **Enforced Guided Flow** | Room-by-room inspection with no skipping allowed. User must actively confirm each inspection point. | P0 |
| **Mandatory Damage Photos** | Minimum 2 photos required when damage is selected. Photos compressed before PDF generation. | P0 |
| **PDF Generation** | Generate PDF matching the original 11-page Word protocol format. Photos attached to corresponding rooms. | P0 |
| **Property Templates** | Save and reuse property configurations (rooms, appliances, fixtures) for recurring properties. | P0 |
| **Progress Gamification** | Confetti animation after completing rooms. Visual progress indicator. Completion celebrations. | P0 |
| **Smart Defaults** | Pre-select "OK" for elements that are historically fine (90%+ OK rate), but require explicit confirmation. Saves time on common cases. | P0 |
| **Offline Capability** | Full functionality without internet. Sync when connection restored. Essential for basements. | P0 |
| **Digital Signatures** | Capture tenant and landlord signatures on device. Include in generated PDF. | P0 |
| **Conditional Questions** | Only show relevant questions based on property config (e.g., oven check only if kitchen installed). | P0 |
| **Key Inventory** | Track all keys with counts and explicit confirmation of return. | P0 |
| **Meter Readings** | Record Zählerstände for gas, electricity, water, heating. | P0 |

---

## Phase 2: Quality & Workflow

Enhanced documentation quality and workflow integration.

| Feature | Description | Priority |
|---------|-------------|----------|
| **Task List Generation** | When damage is found, create actionable tasks: assign to tenant/contractor, set deadline, track completion. Closes the loop from inspection to action. | P1 |
| **Photo Quality Checker** | AI-powered check for blurry, dark, or unusable photos. Immediate feedback: "This image may not be clear enough. Retake?" | P1 |
| **Photo OCR for Meters** | Automatically read meter numbers from photos. Reduce manual entry errors. Competitors are weak here. | P1 |

---

## Phase 3: Advanced Interaction

Hands-free and advanced input modes.

| Feature | Description | Priority |
|---------|-------------|----------|
| **Voice-First Mode** | Hands-free inspection using speech. "Is the floor OK?" → speak response. Works when hands are dirty or carrying items. | P2 |

---

## Future: Beyond Current Phases

Features for long-term development, not scoped into current phases.

| Feature | Description | Notes |
|---------|-------------|-------|
| **Floor Plan Damage Marking** | Upload apartment floor plan, tap to mark damage locations. Also useful for construction site handovers (Baustellenabnahme). | Original stakeholder vision |
| **Photo Comparison (Move-in vs Move-out)** | Side-by-side comparison of same element from Übergabe and Abnahme. Powerful for dispute resolution. | Requires long-term photo storage |
| **Visual Glossary** | Show photos of what elements look like (Fliesenspiegel, Silikonverfugungen) for inexperienced users. | Educational feature for "Anna" users |
| **§19 BMG Auto-Form** | Automatically generate Meldebehörde notification from tenant data. Saves 10+ minutes per handover. | Requires full tenant data collection |
| **Construction Site Mode** | Separate workflow for Baustellenabnahme with architect communication. | Keep separate from residential flow |

---

## Competitive Analysis Summary

### Main Competitors

| Competitor | Strengths | Weaknesses |
|------------|-----------|------------|
| **Immodio** | Digital Übergabeprotokoll, property management integration, offline mode | Static checklists, no gamification, unreliable meter OCR |
| **Fairwalter** | Comprehensive suite, auto-archived PDFs, invoice from defects | Enterprise pricing, Swiss focus, no guided flow |
| **Property Handover Report** | No account required, privacy-focused, meter OCR | Free-form (no guidance), no gamification |
| **Novade Handover** | Drawing annotations, real-time defect management | Construction-focused, not residential |

### Our Key Differentiators

1. **Enforced Guided Flow** - No competitor forces step-by-step completion. Users can't skip.
2. **Gamification** - No competitor uses confetti, progress rewards, or engagement mechanics.
3. **"Anna-Proof" Design** - Explicitly designed for inexperienced users, not just professionals.
4. **Smart Defaults** - Learn from history to speed up common cases.
5. **Integrated Task Generation** (Phase 2) - Close the loop from damage to action.

---

## Technical Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State:** Zustand
- **PDF:** jsPDF + html2canvas
- **Animations:** canvas-confetti
- **i18n:** i18next (German primary, English future)

---

## Success Metrics

1. **Zero missed items** - Every inspection point from Word document covered
2. **Photo documentation** - All damages have 2+ photos attached
3. **Time efficiency** - Handover ≤ paper process time
4. **User satisfaction** - Staff prefer app over paper
5. **Quality improvement** - Fewer post-handover disputes

---

*Last updated: November 30, 2025*

