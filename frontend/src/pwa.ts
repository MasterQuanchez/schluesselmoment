import { registerSW } from 'virtual:pwa-register';

/**
 * Service Worker: App funktioniert offline (Keller!).
 * Bei neuer Version wird gefragt statt still neu zu laden – sonst gingen ungespeicherte Eingaben verloren.
 */
export function registerPwa(): void {
  const update = registerSW({
    onNeedRefresh() {
      if (window.confirm('Neue Version verfügbar. Jetzt aktualisieren? (Eingaben sind gespeichert.)'))
        void update(true);
    },
    onOfflineReady() {
      console.info('Schlüsselmoment ist offline bereit.');
    },
  });
}
