# Hosting & Zugangsschutz – Einrichtung (parallel zum Bau möglich)

**Infrastruktur = nur statisches Hosting + Zugangsschutz davor.** Kein Server, keine Datenbank, keine App-Logins.

```
Handy (PWA, Daten nur lokal) ──HTTPS──▶ Cloudflare Access (E-Mail-PIN, nur erlaubte Adressen)
                                              │
                                              ▼
                                   Cloudflare Pages (statische Dateien aus frontend/dist)
                                              ▲
                                   GitHub-Repo (Push → automatischer Build)
```

## Warum Cloudflare (Empfehlung, Stand Oktober 2026)
- Pages: kostenlos, auch gewerblich. Vercel Hobby ist laut Vercel nur für nicht-kommerzielle Nutzung erlaubt.
- Access: kostenlos bis 50 Nutzer. Login per Einmal-PIN an die E-Mail-Adresse, nur für freigegebene Adressen oder die Firmen-Domain.
- Vercel ginge auch: Pro 20 $/Monat je Entwickler-Platz + Passwortschutz 20 $/Monat je Projekt.

## Checkliste (Moritz = Eigentümer der Konten, Philipp = Mitglied)
1. [ ] GitHub: privates Repo `schluesselmoment` anlegen, Inhalt des ZIPs pushen.
2. [ ] Cloudflare-Konto (Firma von Moritz). Optional eigene Domain, z. B. `protokoll.<firma>.de`.
3. [ ] Workers & Pages → Pages → mit GitHub verbinden → Repo wählen.
       Root directory `frontend`, Build command `npm run build`, Output `dist`, Variable `NODE_VERSION=22`.
4. [ ] Zero Trust → Access → Applications → *Self-hosted*: Domain der App **und** `*.<projekt>.pages.dev` (Vorschau-URLs).
       Policy „Allow“: Liste der Mitarbeiter-E-Mails oder `Emails ending in @<firma>.de`. Login-Methode: One-time PIN.
       Session-Dauer: 30 Tage (dann nur selten neu anmelden).
5. [ ] Cloudflare Web Analytics / Rocket Loader für diese Seite **aus** (würde Skripte einschleusen, CSP blockt sie).
6. [ ] Test auf Android: Seite öffnen → PIN aus E-Mail → Chrome-Menü „App installieren“ → Flugmodus → App öffnen und Protokoll anlegen.
7. [ ] Kosten: 0 €. Daten der Mieter liegen nie bei Cloudflare (nur die App-Dateien).

## Hinweise
- Offline: Nach dem ersten Login liegt die App im Service Worker; im Keller ohne Netz funktioniert sie weiter. Neue Versionen kommen beim nächsten Öffnen mit Netz (Hinweis „Neue Version verfügbar“).
- Wer ausscheidet: E-Mail aus der Access-Policy entfernen. Bereits installierte App läuft offline weiter, bekommt aber keine Updates mehr. Daten auf dem Gerät löscht das nicht (Gerät zurückgeben/zurücksetzen).
- Ein Passwort *in* der App wäre nur Kosmetik (der Code ist öffentlich lesbar) – darum Schutz auf Hosting-Ebene.
