import { useEffect, useState } from 'react';

/**
 * Minimaler Hash-Router (funktioniert offline und auf jedem statischen Hosting ohne Rewrites).
 * Routen:
 *   #/                         Start (Protokolle)
 *   #/mehr                     Einstellungen (eigene Begriffe, Name)
 *   #/p/:id/basis              Objekt, Ausstattung, Parteien
 *   #/p/:id/raeume             Raumliste
 *   #/p/:id/raeume/:roomId     Schnellerfassung Raum
 *   #/p/:id/zaehler            Zähler & Schlüssel
 *   #/p/:id/abschluss          Prüfen, Unterschrift, PDF
 */
export type Route =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'basis'; id: string }
  | { name: 'rooms'; id: string }
  | { name: 'room'; id: string; roomId: string }
  | { name: 'meters'; id: string }
  | { name: 'finish'; id: string };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, id, section, roomId] = parts;
  if (a === 'mehr') return { name: 'settings' };
  if (a !== 'p' || !id) return { name: 'home' };
  switch (section) {
    case 'raeume':
      return roomId ? { name: 'room', id, roomId } : { name: 'rooms', id };
    case 'zaehler':
      return { name: 'meters', id };
    case 'abschluss':
      return { name: 'finish', id };
    default:
      return { name: 'basis', id };
  }
}

export function href(r: Route): string {
  const e = encodeURIComponent;
  switch (r.name) {
    case 'home':
      return '#/';
    case 'settings':
      return '#/mehr';
    case 'basis':
      return `#/p/${e(r.id)}/basis`;
    case 'rooms':
      return `#/p/${e(r.id)}/raeume`;
    case 'room':
      return `#/p/${e(r.id)}/raeume/${e(r.roomId)}`;
    case 'meters':
      return `#/p/${e(r.id)}/zaehler`;
    case 'finish':
      return `#/p/${e(r.id)}/abschluss`;
  }
}

export function navigate(r: Route): void {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
