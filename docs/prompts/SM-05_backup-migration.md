SM-05 · Backup/Export, Migration, Speicher-Härtung (Bahn E). NUR PLANEN
Ziel: Kein Datenverlust bei Handywechsel oder -verlust; Schemaänderungen sicher. ACs: AC10 bleibt grün.
Ist-Stand: frontend/src/storage/db.ts (eigene IndexedDB-Schicht v2: protocols, photos, settings; Zod beim Lesen; purgeExpired), schemaVersion = 1.
Umfang: storage/migrate.ts; Export eines Protokolls als verschlüsselte Datei (WebCrypto AES-GCM, Passwort-Ableitung entscheiden) + Import mit Validierung; verwaiste Fotos aufräumen; Entscheidung D4 (Dexie ja/nein) bestätigen.
Nicht im Umfang: Server-Sync (D3).
Leitplanken: Tests mit fake-indexeddb; keine Klartext-Exporte mit Mieterdaten; Kit-Skill secure-coding/cryptography lesen.
Liefere als Plan: Dateiformat, Krypto-Parameter, Migrationsstrategie, Tests, Risiken. Höchstens 15 Zeilen.
