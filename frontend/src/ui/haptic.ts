/** Kurzer Android-Impuls. iOS ignoriert vibrate; fehlt die API, passiert nichts. */
export function tick(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
}
