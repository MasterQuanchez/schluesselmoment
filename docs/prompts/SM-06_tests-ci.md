SM-06 · E2E-Test + CI (Bahn H). NUR PLANEN
Ziel: Jeder Push prüft Typen, Lint, Unit-Tests und den kompletten Klickpfad im Pixel-7-Viewport. ACs: AC1–AC8, AC10, AC12, AC13 automatisiert.
Ist-Stand: frontend/tests/*.test.ts (17 Unit-Tests); frontend/tests/e2e/flow.reference.mjs = lauffähiges Playwright-Skript des Orchestrators (Mehr → Basis → 8 Räume mit Pflicht-Durchklicken, Mangel + 2 Fotos → Zähler → 2 Unterschriften → Versiegeln → PDF → Sperre → Löschdatum).
Umfang: @playwright/test + playwright.config.ts (Pixel 7, gegen vite preview, CSP-Header wie vercel.json), Workflow in deployment/pipelines/ (GitHub Actions oder Azure DevOps), Biome-Funde beheben, Kit-Pythontests im selben Workflow.
Nicht im Umfang: visuelle Regressionstests (nach SM-02).
Leitplanken: Tests deutsch benannt; nur fiktive Daten (example.org, Musterstraße).
Liefere als Plan: Dateien, Workflow-Schritte, Laufzeit. Höchstens 15 Zeilen.
