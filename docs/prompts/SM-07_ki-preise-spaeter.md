SM-07 · Preise, Vergleich Übergabe ↔ Abnahme, KI (Bahn F). NUR PLANEN – erst wenn die Fachseite eine Preisliste hat
Ziel (Sprachnachricht 01.12.2025): Preise je Schadensart (z. B. Streichen 27 €/m²), Menge erfassen → Schadenshöhe; Abnahme mit Übergabe derselben Wohnung vergleichen.
Ist-Stand: Datenmodell hat je Mangel quantity, unit, unitPriceCents (null). Keine Oberfläche. Kein Backend (D3) – Übergabe-Protokolle liegen nur auf dem Gerät, auf dem sie erstellt wurden (30 Tage).
Umfang: domain/pricing.ts (rein: Preisliste × Menge, Preisliste zentral im Katalog wie D10); Vergleich als reine Funktion nur, wenn beide Protokolle auf dem Gerät sind oder per Export (SM-05) importiert wurden; KI nur optional über Server-Funktion (D11).
Leitplanken: Kein Secret im Client; Ergebnis als Vorschlag kennzeichnen.
Liefere als Plan: Datenmodell Preise, UI-Skizze, Tests, offene Fachfragen. Höchstens 15 Zeilen.
