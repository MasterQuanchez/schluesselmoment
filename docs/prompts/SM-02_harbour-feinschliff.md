SM-02 · Harbour-Feinschliff: Navigation, Splash, Dunkelmodus (Bahn B). NUR PLANEN
Ziel: Die App folgt den Rezepten aus docs/design/phil-theme.md vollständig.
Ist-Stand: Harbour-Tokens wortgleich in frontend/src/styles/tokens.css (+ App-Aliase), Pills, Karten, Tri-State-Chips umgesetzt. Fehlt: Bottom-Nav (weiß, 4 Icons + FAB, aktiv = Navy + 4-px-Akzentpunkt), Splash mit Brand-Gradient, Segment-Chips „Alle / Offen / Fertig“ auf der Startseite, App-Icon/Logo, Dunkelmodus-Prüfung.
Umfang: Navigation Home | Protokolle | + | Objekte (Platzhalter) | Mehr; Splash; Filter-Chips; Icon-Set prüfen; Kontraste messen (AA).
Nicht im Umfang: Tailwind/Next.js (D5), neue Fachlogik.
Leitplanken: keine Hex-Werte außerhalb tokens.css; Trefferflächen 52/40 px; prefers-reduced-motion.
Liefere als Plan: Komponenten, betroffene Dateien, offene Designfragen an Philipp. Höchstens 15 Zeilen.
