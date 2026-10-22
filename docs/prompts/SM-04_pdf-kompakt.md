SM-04 · PDF kompakter, Kopf und Zusammenfassung (Bahn C). NUR PLANEN
Ziel: Weniger Seiten. Räume ohne Mängel in einer Zeile („Alle 8 Punkte in Ordnung“ + Details), Mängel hervorgehoben; Seite 1 mit Zusammenfassung (Mängel je Raum, Zählerstände, Schlüssel). ACs: AC13.
Ist-Stand: frontend/src/pdf/generate.ts (pdf-lib, Helvetica/WinAnsi, Harbour-Druckfarben, Fotoanhang, Fußzeile mit SHA-256, optional APP_CONFIG.companyName). Testlauf: 8 Räume, 1 Mangel → 4 Seiten.
Umfang: Layout, Umbrüche; Logo im Kopf falls O2 entschieden (Bild lokal im Bundle, kein Netz); Schrift optional Plus Jakarta Sans einbetten (Lizenz OFL ok, Größe prüfen).
Nicht im Umfang: Kaution (SM-08), § 19 BMG.
Leitplanken: tests/pdf.test.ts erweitern (Seitenzahl, Texte per pdf-lib prüfen).
Liefere als Plan: Seitenstruktur (Skizze), Funktionen, Tests. Höchstens 15 Zeilen.
