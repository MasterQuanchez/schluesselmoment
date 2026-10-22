/**
 * Zentrale App-Konfiguration. Änderungen hier gelten nach dem nächsten App-Update auf ALLEN Geräten
 * (kein Backend nötig – statisches Hosting liefert die neue Version aus).
 */
export const APP_CONFIG = {
  /** Erscheint im PDF-Kopf. Leer = kein Briefkopf. (Offen: Logo/Briefkopf mit Fachseite klären) */
  companyName: '',
  /** Feste Kopie fürs Objektmanagement, z. B. 'objekte@example.org'. Leer = keine. (Offen) */
  ccEmail: '',
  /** Versendete Protokolle werden so viele Tage nach dem Versand vom Gerät gelöscht. */
  retentionDays: 30,
} as const;
