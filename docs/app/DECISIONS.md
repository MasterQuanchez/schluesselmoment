# Entscheidungen – Schlüsselmoment

| # | Datum | Entscheidung | Begründung | Status |
|---|---|---|---|---|
| D1 | 22.10.2026 | Neuaufbau statt Umbau von v1 | v1: API-Key im Bundle, localStorage-Limit, Screenshot-PDF; Fachlogik in der UI verstreut | Entschieden |
| D2 | 22.10.2026 | Stack: TypeScript strict, React 19, Vite 8, vite-plugin-pwa, Zod 4, pdf-lib, Vitest, Biome | aktuell, schlank, gut für Cursor | Entschieden |
| D3 | 22.10.2026 | **Kein Backend, kein Login, keine Datenbank.** Jedes Gerät arbeitet für sich | Fachseite will die Daten nicht haben; kleinste Angriffsfläche; offline | Entschieden (Gespräch 22.10.) |
| D4 | 22.10.2026 | Eigene IndexedDB-Schicht, eigenes Unterschriftsfeld, eigene Icons statt Dexie/signature_pad/lucide | weniger Abhängigkeiten; API so geschnitten, dass ein Austausch jederzeit möglich ist | Vorläufig |
| D5 | 22.10.2026 | Plain CSS mit Harbour-Tokens (Kit-Namen wortgleich) statt Tailwind/Next.js aus dem Kit | reine SPA/PWA ohne Server; Theme-Wechsel = eine Datei; Kit-Token-Namen bleiben kompatibel | Entschieden |
| D6 | 22.10.2026 | **Pflicht-Durchklicken:** „Keine Mängel“ setzt nur die Raum-Entscheidung; jeder Punkt wird einzeln auf ✓/⚠ gesetzt; kein „Alle OK“-Knopf | Fachseite: besonders Einbauküche; Kernversprechen „nichts vergessen“ | Entschieden (Gespräch 22.10.) |
| D7 | 22.10.2026 | Mangel braucht Beschreibung + 1 Pflicht-Foto (Fachseite 23.10.; vorher 2) (`RULES` in catalog.ts) | Sprachnachricht 30.11.2025, Zahl geändert 23.10. | Entschieden |
| D8 | 22.10.2026 | Unterschrift: festschreiben → alle unterschreiben → versiegeln (SHA-256); „Zurück“ verwirft Unterschriften | Unterschrift muss sich auf einen festen Inhalt beziehen | Entschieden |
| D9 | 22.10.2026 | Unterschrift = einfache elektronische Signatur (gezeichnet auf dem Gerät, vor Ort) | üblich für Wohnungsübergaben; kein Rechtsrat | Entschieden – rechtlich durch Fachseite prüfen lassen |
| D10 | 22.10.2026 | Schnellauswahl: Standardliste zentral in `catalog.ts` (kommt per App-Update auf alle Geräte) + eigene Begriffe je Gerät („Mehr“). Keine Auswertung, was Nutzer häufig schreiben | Fachseite: „vorgegeben, aber anpassbar“ | Entschieden |
| D11 | 22.10.2026 | KI nur über Server-Funktion, nie mit Key im Client | v1-Befund | Entschieden (KI selbst: später) |
| D12 | 22.10.2026 | Word-Dokument entfällt; die App erzeugt das PDF direkt | Gespräch 22.10. | Entschieden |
| D13 | 22.10.2026 | Versand über Teilen-Menü (Web Share API) → E-Mail-App mit PDF als Anhang. Empfänger werden in die Zwischenablage kopiert (das Teilen-Menü kann keine Empfänger vorbelegen) | kein Backend; Kunde und Mitarbeiter bekommen das PDF | Entschieden – auf echtem Android-Gerät testen |
| D14 | 22.10.2026 | Versendete Protokolle werden 30 Tage nach Versand automatisch vom Gerät gelöscht (inkl. Fotos); Entwürfe nie automatisch | Datensparsamkeit (Fotos, später IBAN) | Vorgeschlagen – Frist mit Fachseite bestätigen |
| D15 | 22.10.2026 | Preise später; Datenmodell hat schon `quantity`, `unit`, `unitPriceCents` je Mangel | Preisliste existiert noch nicht | Entschieden |
| D17 | 22.10.2026 | Hosting: Cloudflare Pages + Cloudflare Access (E-Mail-PIN, nur freigegebene Adressen) statt Passwort in der App | gewerblich kostenlos; echter Schutz statt Kosmetik; kein eigener Server | Zurückgestellt bis nach Feinschliff; bis dahin noindex |
| D18 | 22.10.2026 | E-Mail-Versand v1: Teilen-Menü → E-Mail-App mit PDF-Anhang; Empfänger per Einfügen. Vollautomatisch vorbelegt (An + Anhang) nur mit nativer Android-Hülle (Capacitor) – Option für später | Web-Apps können Empfänger und Anhang nicht gemeinsam vorbelegen (mailto: kann keine Anhänge) | Entschieden für v1 |
| D16 | 22.10.2026 | Repo = Phil Starter Kit; Next.js-Frontend und FastAPI-Backend des Kits entfernt, App in `frontend/` (Vite). Kit-Governance (Hooks, Skills, Specs, Data Safety) bleibt | D3 + D5 | Entschieden |
| D23 | 22.10.2026 | Demo-Protokoll in Einstellungen, PDF mit DEMO-Wasserzeichen | Vorführung und Test von Unterschrift und PDF ohne Raum-für-Raum-Durchklick. Erkennbar an „Erstellt von“ = Demo (Feld gesperrt), Wasserzeichen, Betreff und Keyword `demo` | Entschieden |
| D21 | 22.10.2026 | Immer helles Harbour-Theme; Dunkelmodus nur per bewusster Einstellung (später) | System-Dunkelmodus hat die App ungewollt dunkel gefärbt | Entschieden |
| D22 | 22.10.2026 | Detail wählen bestätigt dieses eine Element als OK (Auswahl = angeschaut); kein Sammel-OK | Ein gesetzter Anstrich oder Belag heißt: dieser eine Punkt wurde angesehen. Andere Punkte bleiben offen. Ein Mangel bleibt ein Mangel. | Entschieden |
| D24 | 22.10.2026 | App-Icon F7 „Breakout tick“; Quellen in `frontend/assets/brand/`; Start-Hintergrund weiß | Weißer Haus-Umriss, Haken in #A9BCD6 durchs Dach, Navy-Verlauf #173560 → #07142B. Ausgeliefert werden die PNG/ICO/SVG in `frontend/public/`; die SVGs in `frontend/assets/brand/` sind nur die Quellen. Start-Hintergrund weiß (`background_color` `#FFFFFF`), damit die helle App beim Öffnen nicht dunkel aufblitzt | Entschieden |
| D25 | 23.10.2026 | iPhone: PDF erst vorbereiten, Senden ohne await im Klick; Installationshinweis wegklickbar in den Geräte-Einstellungen | iOS öffnet das Teilen-Menü nur, wenn `navigator.share` direkt im Klick startet. Der Hinweis gilt nur für nicht installiertes iOS-Safari. Neues Settings-Feld hat einen Default, deshalb keine Schemaversion | Entschieden |
| D26 | 23.10.2026 | Gesperrte Zustände nennen Element und Grund | „Noch N Punkte“ sagt nicht, was fehlt. Der Knopf nennt den ersten offenen Punkt, zum Beispiel „Wände: 1 Foto fehlt“. | Entschieden |
| D27 | 23.10.2026 | Mangel-Vorschläge je Element, getrennt von den Zustandsbegriffen der Raum-Notiz | „Fachgerecht renoviert“ ist kein Mangel an der Wand. Eigene Begriffe bleiben in den Einstellungen. | Entschieden |
| D28 | 23.10.2026 | Mangel-Fotos im PDF direkt beim Raum, Zählerfotos beim Zähler; kein Sammelanhang | Im Protokoll soll das Foto neben dem Mangel stehen. | Entschieden |
| D29 | 23.10.2026 | Senden zweistufig wegen Safari-Nutzeraktion | iOS Safari startet das Teilen-Menü nur direkt in der Nutzeraktion. Deshalb erst „PDF vorbereiten“, dann „Per E-Mail senden“ ohne await davor im Klick. | Entschieden |
| D30 | 23.10.2026 | Installationshinweis iOS / Android-Install-Angebot | Nicht installiertes iOS-Safari bekommt einen wegklickbaren Hinweis zum Home-Bildschirm. Android zeigt „App installieren“ nur, wenn der Browser `beforeinstallprompt` schickt. | Entschieden |
| D31 | 23.10.2026 | Schriften nicht als data-URL einbetten (`assetsInlineLimit: 0`) | Die CSP erlaubt Schriften nur von der eigenen Adresse (`font-src 'self'`). Eingebettete data-URLs würden blockiert. | Entschieden |
| D32 | 23.10.2026 | Python-Werkzeuge auf Windows über `py -3` | `python` ist hier der Store-Stub. In der CI ab SM-06. | Entschieden |
| D33 | 23.10.2026 | Zielgeräte: Android (Mitarbeiter) und iPhone (Fachseite) gleichrangig; jeder Klickpfad auf Pixel 7 und iPhone 15 | Beide Geräte kommen im Termin vor. Ein Klickpfad gilt erst, wenn er auf beiden Viewports durchläuft. | Entschieden |
| D34 | 23.10.2026 | Bis D17 gilt noindex | Zugangsschutz (D17) ist zurückgestellt. Bis dahin `X-Robots-Tag`, `robots.txt` und Meta-Tag `noindex, nofollow`. | Entschieden |
| D35 | 23.10.2026 | pdfjs-dist nur als devDependency, nur in `frontend/tests/` zum Rendern der PDF-Seiten | Kein CDN. Die App erzeugt das PDF mit pdf-lib und lädt pdfjs nicht. | Entschieden |
| D36 | 23.10.2026 | Unterschrift nennt den fehlenden Grund; Übergabe am plus optionales Einzug- oder Auszugsdatum | Der gesperrte Knopf sagt „Noch 1 Unterschrift fehlt“. `handoverOn` ist Pflicht (bestehende Protokolle: Kalendertag von `createdAt`). `moveInOn` nur bei Übergabe, `moveOutOn` nur bei Abnahme. Schemaversion 2. | Entschieden |
| D37 | 23.10.2026 | PDF: Jakarta (Überschriften) + Inter (Text), statisch eingebettet, tnum eingefroren | Plus Jakarta Sans SemiBold für Titel, Raumüberschriften und Kennzahlen. Inter Regular/Medium/SemiBold für Text und Tabellen. Statische TTFs, tabellarische Ziffern eingefroren, auf Latein zugeschnitten. Fehlt die Schrift, Helvetica, nie Times. | Entschieden |
| D38 | 23.10.2026 | PDF-Layout „Auf einen Blick“ + Prüfsumme statt Versiegelt | Seite 1 mit Kennzahlen und Mängelübersicht (Seitenzahlen im zweiten Durchlauf). Unten die Prüfsumme als SHA-256, kein QR-Code. | Entschieden |
| D39 | 23.10.2026 | Pflicht inkl. Details, Kontakt und Ausstattung (Fachseite 23.10.) | Blockierend: offene Elemente, Mangel ohne Foto oder Beschreibung, Straße, PLZ (5 Ziffern), Ort, Namen, Zählerstand, gültige E-Mail, dazu bei `requireDetails` alle Angaben und bei `requireContactFields` Lage, Objekt-Nr., Telefon und E-Mail. Küche und Bad: jeder Ausstattungspunkt. Zählernummer, Zählerort und Zählerfoto bleiben Empfehlung. | Entschieden (Moritz, 23.10.) |
| D40 | 23.10.2026 | Status „Nicht vorhanden“ | `CheckState` kennt `na`. Dafür braucht es keine Angaben. Schemaversion 3. | Entschieden (Moritz, 23.10.) |
| D41 | 23.10.2026 | Chip = offen↔OK, Mangel nur im ⓘ-Sheet | Der Chip wechselt nur offen und OK. Fehlen Angaben, öffnet sich das Sheet mit „In Ordnung“. Mangel und Nicht vorhanden setzt nur das Sheet. | Entschieden |
| D42 | 23.10.2026 | Mängel-Schalter entfällt | „Gibt es Mängel?“ kommt weg. Die Raum-Entscheidung folgt aus den Elementen. Unter dem Titel steht die Statuszeile. | Entschieden |
| D43 | 23.10.2026 | Mieter „Keine E-Mail“ | Haken `noEmail`: die E-Mail dieses Mieters ist keine Pflicht. Beim Senden steht der Hinweis, die Adresse im Mailprogramm zu ergänzen. „Neue Adresse (nach Auszug)“ nur bei Abnahme, freiwillig. | Entschieden (Moritz, 23.10.) |
| D44 | 23.10.2026 | Native Feel: Systemschrift für Text, Jakarta nur für Überschriften ab 22 px, drei Gewichte, Fließtext 17 px, Trefferflächen mindestens 48 px | Die App soll sich auf iPhone und Android wie eine native App anfühlen. Kein Flüssigglas, kein Sammel-OK, keine Sync-Anzeige. | Entschieden |
| D45 | 23.10.2026 | Abschluss nennt den ersten konkreten Punkt und die Anzahl weiterer; der Link öffnet das Element | „Flur: nicht abgeschlossen“ sagt nicht, was fehlt. | Entschieden |
| D46 | 23.10.2026 | Foto löschen und Mangel zurücksetzen ohne Nachfrage, fünf Sekunden Rückgängig. Protokoll löschen über einen eigenen Dialog | `window.confirm` wirkt auf dem Handy fremd. Das Protokoll bleibt ein bewusster Schritt. | Entschieden |
| D47 | 23.10.2026 | Anzahl bleibt offen („–“), bis plus, minus oder eine Eingabe eine Zahl setzt. 0 nur bewusst | Eine unbeantwortete Anzahl ist kein „0 Stück“. | Entschieden |
| D55 | 23.10.2026 | Im Element-Sheet führt „Fertig – weiter zu …“ zum nächsten offenen Element, ohne es auf OK zu setzen. Ohne Status heißt der Knopf „Schließen“. „Nur schließen“ bleibt stehen. | Der Rundgang soll am Stück laufen. Ein offenes Element darf nicht versehentlich als in Ordnung gelten. | Entschieden |
| D56 | 23.10.2026 | Offene Chips sind neutral (gestrichelter grauer Rand). Orange nur, wenn OK oder Mangel und Angaben fehlen. | Offen ist der Normalzustand. Orange soll nur auf eine Lücke hinweisen. | Entschieden |
| D57 | 23.10.2026 | Der Abschluss heißt „Abschließen“. Die Erfolgsbox zeigt „Protokoll abgeschlossen“ und die kurze Prüfsumme. „Übernehmen“ erst ab 150 px Strich. | Dieselbe Sprache wie im PDF. Ein Punkt ist keine Unterschrift. | Entschieden |
| D58 | 23.10.2026 | PDF-Layout „Klar“ (ersetzt D38-Layout) | Eine Kennzahlenzeile, Abschnitte mit Icon ohne Nummern, Merkmale vollständig, Fotos nur im Anhang. Anmerkungen mit Schreiblinien stehen vor den Unterschriften und zählen nicht zur Prüfsumme. Löst die Foto-Stelle aus D28 ab. | Entschieden |

D19/D20 bewusst nicht vergeben (SM-01).

## Offen

| # | Frage | Wer |
|---|---|---|
| O1 | Hosting → D17 vorgeschlagen (Checkliste `docs/app/HOSTING.md`); `vercel.json` bleibt als Alternative | Moritz |
| O2 | Firmenlogo/Briefkopf im PDF? (`APP_CONFIG.companyName` vorbereitet) | Fachseite |
| O3 | Feste Kopie-Adresse fürs Objektmanagement? (`APP_CONFIG.ccEmail` vorbereitet) | Fachseite |
| O4 | Löschfrist 30 Tage ok? | Fachseite |
| O5 | Kaution/IBAN in v1? (Word-Protokoll hat den Abschnitt) – dann Datenschutz-Konzept | Fachseite |
