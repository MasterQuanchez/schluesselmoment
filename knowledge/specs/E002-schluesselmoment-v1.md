---
type: Product
title: Schlüsselmoment v1 – Übergabeprotokoll-PWA
description: Epic spec für die mobile Übergabe-, Abnahme- und Bestandsaufnahme-App ohne Backend.
timestamp: 2026-10-22T00:00:00Z
last_reviewed: 2026-10-22
owner: Philipp
sources:
  - ref: "sourcing/v1-referenz/Uebergabeprotokoll-Vorlage-2021.docx"
  - ref: "sourcing/v1-referenz/requirements.md"
  - ref: "docs/app/DECISIONS.md"
tags: [epic, pwa, uebergabeprotokoll, offline, pdf, signatur]
---
# Schlüsselmoment v1 – Übergabeprotokoll-PWA

- **Type**: Epic
- **Status**: In Progress (Kern fertig: 2.0.0-alpha.2)
- **Parent**: None (top-level epic)

## Context

Die Hausverwaltung eines Freundes macht pro Jahr viele Wohnungsübergaben und -abnahmen. Bisher: Word-Formular (11 Seiten, 2021).
Problem: Der Mieter redet, der Mitarbeiter wird abgelenkt und vergisst Punkte (Backofen, Lampen des Mieters, Vorhangstangen, Duschkopf).
Ziel: Eine App, die Raum für Raum durchführt, sodass auch Laien („Anna“) nichts vergessen. Ergebnis ist ein unterschriebenes PDF für Kunde und Mitarbeiter.
v1 (Nov./Dez. 2025, React/Vite) wird neu aufgebaut: der API-Key lag im Bundle, localStorage war zu klein, das PDF war ein Screenshot.

## Requirements

### In Scope

- Protokolltypen Übergabe, Abnahme, Bestandsaufnahme
- Basisdaten: Objekt, Lage, Ausstattung (Zimmer, Bäder, Küche normal/Einbau, Gäste-WC, Außenbereich, Keller), Beteiligte inkl. E-Mail
- Raumliste aus der Ausstattung; Prüfpunkte je Raumvorlage laut Word-Protokoll; Balkon/Terrasse ohne Fenster, Türrahmen und Heizkörper
- Schnellerfassung je Raum: Schalter „Keine Mängel“/„Mängel“, Tri-State-Chips (OK → Mangel → zurück), Fortschritt „7/9“
- Pflicht-Durchklicken: Jeder Punkt wird einzeln bestätigt. Es gibt keinen „Alle OK“-Knopf.
- Mangel: Beschreibung + mind. 2 Fotos (Kamera), Schnellauswahl-Begriffe (Standard zentral + eigene je Gerät)
- Optionale Details (Anstrich, Belag, Verglasung, Material, Rollladen …), Ausstattung (Einbauküche, Bad)
- Abschluss-Prüfungen (Restgegenstände, Therme, Wartungsrechnung, Rauchwarnmelder, Gemeinschaftsflächen)
- Zählerstände (mit Foto) und Schlüssel
- Unterschrift aller Beteiligten auf dem Gerät; Inhalt vorher festschreiben; Versiegelung SHA-256
- PDF auf dem Gerät; Versand über das Teilen-Menü (E-Mail-App, PDF als Anhang), Empfänger vorbereitet
- Offline-fähige, installierbare PWA (Android); Daten nur lokal; Löschung 30 Tage nach Versand
- Datenmodell vorbereitet für Preise (Menge, Einheit, Einheitspreis) – ohne Oberfläche

### Out of Scope

- Backend, Login, Datenbank, Sync zwischen Geräten (Entscheidung Fachseite)
- Preise/Schadenskalkulation, KI-Zusammenfassung, Vergleich Übergabe↔Abnahme (später, SM-07)
- Grundriss mit Mangel-Markierung, Baustellenabnahme (Zukunft)
- § 19 BMG-Wohnungsgeberbestätigung (Zukunft)
- Qualifizierte/fortgeschrittene elektronische Signatur

## Acceptance Criteria

- AC1: Given a new protocol with features (2 rooms, Einbauküche, Balkon), when rooms are generated, then the list is Flur, Küche, Bad, Zimmer 1, Zimmer 2, Balkon, Eingangstür & Briefkasten, Abschluss-Prüfungen, and the Balkon has no Fenster/Tür/Heizkörper.
- AC2: Given a room, when the user taps „Keine Mängel“, then no check changes state and the room cannot be completed until every check is ✓ or ⚠.
- AC3: Given a chip, when tapped repeatedly, then it cycles open → OK → Mangel → open, and the defect data survives a reset (no data loss from mis-taps).
- AC4: Given a check marked Mangel, when the user tries to complete the room, then it is blocked until a description and ≥ 2 photos exist.
- AC5: Given a Schnellauswahl term, when tapped, then it is appended to the note (no duplicates) and the text remains editable; own terms from „Mehr“ appear in every room on this device.
- AC6: Given any room incomplete or missing names/address, when on Abschluss, then „Inhalt festschreiben“ is disabled and the open points are listed as links.
- AC7: Given status „signing“, when content screens are opened, then all inputs are read-only; „Zurück zur Bearbeitung“ discards signatures.
- AC8: Given all required signers signed, when sealing, then a SHA-256 over content, signatures and photo hashes is stored and printed in the PDF; any change yields a different hash.
- AC9: Given a sealed protocol, when „PDF per E-Mail senden“ is tapped on Android, then the share sheet opens with the PDF attached and recipients (tenants, landlord, fixed CC) are copied to the clipboard.
- AC10: Given a shared protocol, when 30 days have passed, then it and its photos are deleted on next app start; the home list shows the deletion date before that.
- AC11: Given airplane mode after first load, when the app is opened, then it works fully (create, photos, sign, PDF).
- AC12: Given the production build, when served with the CSP from `frontend/vercel.json`, then there are no console errors and no request leaves the origin.
- AC13: Given the PDF, then it contains text (not images of text), German umlauts, the defect with figure numbers, a photo appendix, signatures and „Seite x von y“.

## Features

- F201 Schnellerfassung & Ablauf (Bahn A) – Kern fertig
- F202 Harbour-Design (Bahn B) – Tokens übernommen, Feinschliff offen (SM-02)
- F203 PDF (Bahn C) – Kern fertig, Kompaktlayout offen (SM-04)
- F204 PWA/Release (Bahn D) – konfiguriert, mit echtem Vite 8 zu verifizieren (SM-01)
- F205 Daten & Sicherheit (Bahn E) – Kern fertig, Backup/Migration offen (SM-05)
- F206 Qualität/CI (Bahn H) – Unit-Tests fertig, E2E-Referenz vorhanden (SM-06)
- F207 Kaution (Bahn A/E) – offen (SM-08)

## Decisions

Siehe `docs/app/DECISIONS.md` (D1–D16).

## Implementation Notes

- 2026-10-22 (Orchestrator/Claude): Kern 2.0.0-alpha.2 gebaut und geprüft. 17 Unit-Tests grün; vollständiger Klickpfad (Pixel 7, strikte CSP) grün: AC1–AC8, AC10 (Logik + Anzeige), AC12, AC13 verifiziert. AC9 nur Fallback (Download) geprüft – Teilen-Menü braucht echtes Android-Gerät. AC11 offen bis SM-01 (Service Worker wurde lokal nicht gebaut). Prüfumgebung: TS 6, React 19.2, Zod 3.25 (Produktion: Zod 4 – in SM-01 prüfen), pdf-lib 1.17, esbuild statt Vite 8 (Registry gesperrt).
