# Architektur

```
UI (frontend/src/features/*)  ──liest/ändert──▶  useProtocol() Provider  ──speichert──▶  IndexedDB (storage/db.ts)
     │                                   │                                      ├─ protocols (Zod-geprüft)
     │ ruft nur reine Funktionen         ▼                                      └─ photos (Blob)
     └────────────────────────────▶ domain/protocol.ts ◀── domain/catalog.ts (Fachkatalog)
                                         │
                                         ▼
                                   pdf/generate.ts (pdf-lib, lazy geladen)
```

- **Fachlogik ist rein** (Eingabe → neues Objekt). Dadurch testbar ohne Browser.
- **Ein Provider pro offenem Protokoll** (App.tsx): alle Screens teilen denselben Stand; Autosave entprellt 250 ms, sofort beim Verlassen/Hintergrund.
- **Statusmaschine**: `draft` (bearbeitbar) → `signing` (Inhalt gesperrt, nur Unterschriften) → `signed` (versiegelt, nur lesen/teilen).
- **Router**: Hash-Router (`#/p/:id/raeume/:roomId`), funktioniert offline und auf jedem statischen Hosting.
- **Raum-IDs deterministisch** (`room-2`, `bath`), damit Ausstattungsänderungen erfasste Daten behalten.
- **Schema-Version** in jedem Protokoll; Migrationen später in `storage/migrate.ts`.
