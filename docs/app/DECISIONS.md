# Entscheidungen – Schlüsselmoment

| # | Datum | Entscheidung | Begründung | Status |
|---|---|---|---|---|
| D1 | 22.10.2026 | Neuaufbau statt Umbau von v1 | v1: API-Key im Bundle, localStorage-Limit, Screenshot-PDF; Fachlogik in der UI verstreut | Entschieden |
| D2 | 22.10.2026 | Stack: TypeScript strict, React 19, Vite 8, vite-plugin-pwa, Zod 4, pdf-lib, Vitest, Biome | aktuell, schlank, gut für Cursor | Entschieden |
| D3 | 22.10.2026 | **Kein Backend, kein Login, keine Datenbank.** Jedes Gerät arbeitet für sich | Fachseite will die Daten nicht haben; kleinste Angriffsfläche; offline | Entschieden (Gespräch 22.10.) |
| D4 | 22.10.2026 | Eigene IndexedDB-Schicht, eigenes Unterschriftsfeld, eigene Icons statt Dexie/signature_pad/lucide | weniger Abhängigkeiten; API so geschnitten, dass ein Austausch jederzeit möglich ist | Vorläufig |
| D5 | 22.10.2026 | Plain CSS mit Harbour-Tokens (Kit-Namen wortgleich) statt Tailwind/Next.js aus dem Kit | reine SPA/PWA ohne Server; Theme-Wechsel = eine Datei; Kit-Token-Namen bleiben kompatibel | Entschieden |
| D6 | 22.10.2026 | **Pflicht-Durchklicken:** „Keine Mängel“ setzt nur die Raum-Entscheidung; jeder Punkt wird einzeln auf ✓/⚠ gesetzt; kein „Alle OK“-Knopf | Fachseite: besonders Einbauküche; Kernversprechen „nichts vergessen“ | Entschieden (Gespräch 22.10.) |
| D7 | 22.10.2026 | Mangel braucht Beschreibung + mind. 2 Fotos (`RULES` in catalog.ts) | Sprachnachricht 30.11.2025 | Entschieden (Zahl änderbar) |
| D8 | 22.10.2026 | Unterschrift: festschreiben → alle unterschreiben → versiegeln (SHA-256); „Zurück“ verwirft Unterschriften | Unterschrift muss sich auf einen festen Inhalt beziehen | Entschieden |
| D9 | 22.10.2026 | Unterschrift = einfache elektronische Signatur (gezeichnet auf dem Gerät, vor Ort) | üblich für Wohnungsübergaben; kein Rechtsrat | Entschieden – rechtlich durch Fachseite prüfen lassen |
| D10 | 22.10.2026 | Schnellauswahl: Standardliste zentral in `catalog.ts` (kommt per App-Update auf alle Geräte) + eigene Begriffe je Gerät („Mehr“). Keine Auswertung, was Nutzer häufig schreiben | Fachseite: „vorgegeben, aber anpassbar“ | Entschieden |
| D11 | 22.10.2026 | KI nur über Server-Funktion, nie mit Key im Client | v1-Befund | Entschieden (KI selbst: später) |
| D12 | 22.10.2026 | Word-Dokument entfällt; die App erzeugt das PDF direkt | Gespräch 22.10. | Entschieden |
| D13 | 22.10.2026 | Versand über Teilen-Menü (Web Share API) → E-Mail-App mit PDF als Anhang. Empfänger werden in die Zwischenablage kopiert (das Teilen-Menü kann keine Empfänger vorbelegen) | kein Backend; Kunde und Mitarbeiter bekommen das PDF | Entschieden – auf echtem Android-Gerät testen |
| D14 | 22.10.2026 | Versendete Protokolle werden 30 Tage nach Versand automatisch vom Gerät gelöscht (inkl. Fotos); Entwürfe nie automatisch | Datensparsamkeit (Fotos, später IBAN) | Vorgeschlagen – Frist mit Fachseite bestätigen |
| D15 | 22.10.2026 | Preise später; Datenmodell hat schon `quantity`, `unit`, `unitPriceCents` je Mangel | Preisliste existiert noch nicht | Entschieden |
| D17 | 22.10.2026 | Hosting: Cloudflare Pages + Cloudflare Access (E-Mail-PIN, nur freigegebene Adressen) statt Passwort in der App | gewerblich kostenlos; echter Schutz statt Kosmetik; kein eigener Server | Vorgeschlagen – Moritz bestätigt |
| D18 | 22.10.2026 | E-Mail-Versand v1: Teilen-Menü → E-Mail-App mit PDF-Anhang; Empfänger per Einfügen. Vollautomatisch vorbelegt (An + Anhang) nur mit nativer Android-Hülle (Capacitor) – Option für später | Web-Apps können Empfänger und Anhang nicht gemeinsam vorbelegen (mailto: kann keine Anhänge) | Entschieden für v1 |
| D16 | 22.10.2026 | Repo = Phil Starter Kit; Next.js-Frontend und FastAPI-Backend des Kits entfernt, App in `frontend/` (Vite). Kit-Governance (Hooks, Skills, Specs, Data Safety) bleibt | D3 + D5 | Entschieden |
| D23 | 22.10.2026 | Demo-Protokoll in Einstellungen, PDF mit DEMO-Wasserzeichen | Vorführung und Test von Unterschrift und PDF ohne Raum-für-Raum-Durchklick. Erkennbar an „Erstellt von“ = Demo (Feld gesperrt), Wasserzeichen, Betreff und Keyword `demo` | Entschieden |
| D21 | 22.10.2026 | Immer helles Harbour-Theme; Dunkelmodus nur per bewusster Einstellung (später) | System-Dunkelmodus hat die App ungewollt dunkel gefärbt | Entschieden |
| D22 | 22.10.2026 | Detail wählen bestätigt dieses eine Element als OK (Auswahl = angeschaut); kein Sammel-OK | Ein gesetzter Anstrich oder Belag heißt: dieser eine Punkt wurde angesehen. Andere Punkte bleiben offen. Ein Mangel bleibt ein Mangel. | Entschieden |
| D24 | 22.10.2026 | App-Icon F7 „Breakout tick“; Quellen in `frontend/assets/brand/`; Start-Hintergrund weiß | Weißer Haus-Umriss, Haken in #A9BCD6 durchs Dach, Navy-Verlauf #173560 → #07142B. Ausgeliefert werden die PNG/ICO/SVG in `frontend/public/`; die SVGs in `frontend/assets/brand/` sind nur die Quellen. Start-Hintergrund weiß (`background_color` `#FFFFFF`), damit die helle App beim Öffnen nicht dunkel aufblitzt | Entschieden |
| D25 | 23.10.2026 | iPhone: PDF erst vorbereiten, Senden ohne await im Klick; Installationshinweis wegklickbar in den Geräte-Einstellungen | iOS öffnet das Teilen-Menü nur, wenn `navigator.share` direkt im Klick startet. Der Hinweis gilt nur für nicht installiertes iOS-Safari. Neues Settings-Feld hat einen Default, deshalb keine Schemaversion | Entschieden |

| D29 | 23.10.2026 | Senden zweistufig wegen Safari-Nutzeraktion | iOS Safari startet das Teilen-Menü nur direkt in der Nutzeraktion. Deshalb erst „PDF vorbereiten“, dann „Per E-Mail senden“ ohne await davor im Klick. | Entschieden |
| D30 | 23.10.2026 | Installationshinweis iOS / Android-Install-Angebot | Nicht installiertes iOS-Safari bekommt einen wegklickbaren Hinweis zum Home-Bildschirm. Android zeigt „App installieren“ nur, wenn der Browser `beforeinstallprompt` schickt. | Entschieden |

## Offen

| # | Frage | Wer |
|---|---|---|
| O1 | Hosting → D17 vorgeschlagen (Checkliste `docs/app/HOSTING.md`); `vercel.json` bleibt als Alternative | Moritz |
| O2 | Firmenlogo/Briefkopf im PDF? (`APP_CONFIG.companyName` vorbereitet) | Fachseite |
| O3 | Feste Kopie-Adresse fürs Objektmanagement? (`APP_CONFIG.ccEmail` vorbereitet) | Fachseite |
| O4 | Löschfrist 30 Tage ok? | Fachseite |
| O5 | Kaution/IBAN in v1? (Word-Protokoll hat den Abschnitt) – dann Datenschutz-Konzept | Fachseite |
