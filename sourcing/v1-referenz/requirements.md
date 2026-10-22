# Hausübergabe App Requirements

This document contains the requirements extracted from the key user transcript and stakeholder discussions.

## Core Problem Statement

Property managers often forget important inspection points during apartment handovers because:
1. The tenant is present and talking, causing distractions
2. Experience varies - even professionals doing 30+ handovers/year miss things
3. No systematic guidance through the inspection process

### Common Issues That Get Missed
- Lamps still hanging on ceiling that don't belong to the unit
- Curtain rods that aren't part of the apartment
- Toilet paper holders drilled into walls/surfaces
- Oven not checked for cleanliness
- Shower not checked for hair/residue
- Shower head not checked for limescale (Kalkfilm)
- Fridge not checked if it's turned off (leads to mold)
- Walls not checked if freshly painted
- Floor condition not properly assessed

## User Requirements

### Primary Goal
> "Am Ende des Tages wäre es cool, wenn man in der App im Browser quasi die Wohnung auswählt, dann es die Voreinstellungen gibt, Küche, Badezimmer, Gäste-WC, dann eben die einzelnen Zimmer und dann pro Zimmer-Küche-Bad die Punkte aus dem Übergabeprotokoll abgefragt werden."

**Translation:** At the end of the day, it would be cool if you could select the apartment in the browser app, then have the presets for kitchen, bathroom, guest WC, and individual rooms, and then have the protocol points queried per room/kitchen/bathroom.

### Interactive Guidance
> "Dass man sich quasi immer interaktiv durchklicken muss."

The app should require interactive clicking through each inspection point - no skipping allowed.

### Foolproof Design
> "Dass Anna anhand dieses Übergabeprotokolls und der Durchführung durch die Übergabe nichts vergessen würde, was ein Profi nicht vergisst."

The app should be designed so that even someone with **zero experience** (like "Anna") can conduct a thorough handover without missing anything a professional would catch.

### Room-by-Room Flow
> "Du hast dann die Küche offen, bist in der Küche und dann fängt es an mit: ist der Boden in Ordnung, sind die Wände in Ordnung, sind die Fenster in Ordnung..."

Example kitchen flow:
1. Is the floor in order?
2. Are the walls in order?
3. Are the windows in order?
4. (If kitchen appliances present) Is the fridge clean?
5. Is the fridge turned off?
6. Is the oven clean?

### Conditional Questions
> "Wenn Küche vorhanden hinterlegt ist, also Küchenzeile, weil in manchen Wohnungen haben wir ja eine Küche eingebaut..."

Questions should be **conditional** based on the property configuration:
- Only show kitchen appliance questions if kitchen is marked as installed
- Only show bathtub questions if bathtub exists
- etc.

### Gamification
> "Dass du einfach wie gamifiziert quasi durch eine Übergabe geführt wirst. Im besten Fall, wenn du es lustig machst, kommen nach jedem Zimmer irgendwie Konfetti und Zeug, sodass du eine kleine Belohnung erhältst."

**Gamification requirements:**
- User should feel "led through" the process
- Confetti or similar celebration after completing each room
- Small rewards/feedback for progress

### Photo Documentation

#### Mandatory for Damages
> "Bilder wären cool, also Pflicht wäre quasi, dass wenn man Schaden auswählt, dass dann Minimum zwei Bilder hinterlegt werden müssen."

- **Minimum 2 photos required** when damage is selected
- Photos should be attached to the protocol for the corresponding room

#### Photo Processing
> "Die dann am Ende, wenn man das Übergabeprotokoll verschickt, quasi verkleinert werden und mit an das Übergabeprotokoll in dem entsprechenden Raum mit angehängt werden würden."

- Photos should be **compressed/resized** before sending
- Photos attached to PDF in the **corresponding room section**

### Future Vision: Floor Plan Integration
> "Zukunftsvision ist sogar so, dass man quasi in der Wohnung einen Grundriss hinterlegen kann, sodass man die Schäden in dem Grundriss antippen kann."

**Future feature:**
- Upload apartment floor plan
- Tap on floor plan to mark damage locations
- Would also work for construction site inspections (Baustellenabnahme)

### Use Case Extension
> "Wenn das irgendwann klappen würde, wäre es noch geiler, weil dann könnte man es auch als Baustellenabnahmeprotokoll verwenden."

The system could be extended to:
- Construction site handover protocols
- Architect communication (show exactly where issues are on floor plan)

---

## Functional Requirements

### FR-1: Property Selection
- Select apartment from pre-loaded list OR manual entry
- Configure property specifics before starting inspection

### FR-2: Property Configuration
- Number of rooms
- Kitchen presence (built-in or none)
- Bathroom count
- Guest WC presence
- Balcony/Terrace/Wintergarten/Loggia
- Basement presence
- Heating type

### FR-3: Interactive Room Inspection
- Room-by-room guided flow
- Each inspection point must be actively confirmed
- No ability to skip questions
- Conditional questions based on property config

### FR-4: Damage Documentation
- Toggle damage status for each element
- Mandatory: Minimum 2 photos when damage selected
- Text description field for damage details
- Photos compressed automatically

### FR-5: Progress Tracking
- Visual progress indicator
- Room completion status
- Overall protocol completion percentage

### FR-6: Gamification
- Celebration animation after each room
- Confetti on protocol completion
- Visual feedback for progress

### FR-7: Protocol Generation
- Generate PDF matching original Word format
- Include all inspection data
- Attach photos to corresponding rooms
- Include meter readings
- Include key inventory
- Include signatures

### FR-8: Output & Sharing
- In-app review before finalizing
- PDF export
- Email sending to owner/tenant

---

## Non-Functional Requirements

### NFR-1: Mobile-First
- Optimized for smartphone use during inspections
- Touch-friendly interface
- Works in one hand while walking through apartment

### NFR-2: Offline Capability (Phase 2)
- Should work in basements without internet
- Sync when connection restored

### NFR-3: Language
- German as primary language
- English localization in future

### NFR-4: Performance
- Photo compression should be fast
- PDF generation under 5 seconds
- Smooth animations

---

## User Personas

### Primary User: Property Manager
- Conducts 30+ handovers per year
- Often distracted by tenants during inspection
- Needs systematic guidance to not miss anything

### Secondary User: Inexperienced Staff ("Anna")
- Has never done a handover before
- Needs complete hand-holding through process
- Should achieve same quality as experienced staff

---

## Success Criteria

1. **Zero missed items** - Every inspection point from the Word document is covered
2. **Photo documentation** - All damages have at least 2 photos attached
3. **Time efficiency** - Handover takes similar or less time than paper process
4. **User satisfaction** - Staff prefer app over paper protocol
5. **Quality improvement** - Fewer issues discovered after handover

---

## AI Enhancement Ideas (Phase 2+)

### Voice-to-Text
- Speak damage descriptions instead of typing
- Web Speech API / Whisper integration

### Photo Analysis
- AI analyzes damage photos
- Suggests damage descriptions
- OCR for meter readings

### Voice-Guided Walkthrough
- AI chatbot guides user verbally
- "Bitte prüfen Sie jetzt den Backofen. Ist er sauber?"
- User responds naturally, AI fills form

### Smart Assistance
- Autocomplete based on room type
- Damage severity assessment
- Comparison with previous inspections

