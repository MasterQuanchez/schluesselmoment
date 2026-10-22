SM-03 · Ablauf: Belohnung, Hilfe je Prüfpunkt, Wohnungs-Vorlagen (Bahn A). NUR PLANEN
Ziel: Schneller und „Anna-sicher“. ACs: AC2, AC3, AC5 bleiben grün.
Ist-Stand: frontend/src/features/rooms/RoomScreen.tsx (Pflicht-Durchklicken, Schnellauswahl inkl. eigener Begriffe aus „Mehr“), domain/catalog.ts (CHECKS.hint, PHRASES).
Umfang: (1) Belohnung nach jedem Raum (Konfetti ohne Abhängigkeit, < 3 kB, reduced-motion beachten). (2) Hilfe ⓘ je Chip (CHECKS.hint) als Bottom-Sheet. (3) Wohnungs-Vorlagen je Gerät: Ausstattung einer Wohnung speichern und beim nächsten Protokoll wählen (Roadmap P0 „Property Templates“) – ohne echte Adressen in Code/Tests.
Nicht im Umfang: „Alle OK“-Knopf (D6 verbietet ihn), Sync, Import der Objektliste.
Leitplanken: Fachlogik rein + getestet; neue IndexedDB-Stores über Bahn E (DB_VERSION).
Liefere als Plan: Datenmodell Vorlagen, Screens, Tests, Risiken. Höchstens 15 Zeilen.
