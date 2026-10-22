/** Wann die Karte „Zum Home-Bildschirm“ erscheint. Reine Entscheidung, ohne DOM. */
export interface InstallHintEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** navigator.standalone, nur iOS-Safari gesetzt */
  navigatorStandalone: boolean;
  /** matchMedia('(display-mode: standalone)') */
  displayModeStandalone: boolean;
  dismissed: boolean;
}

export function isIosDevice(env: Pick<InstallHintEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  if (/iPad|iPhone|iPod/.test(env.userAgent)) return true;
  // iPadOS meldet sich als Mac, aber mit Touch
  return env.platform === 'MacIntel' && env.maxTouchPoints > 1;
}

function isSafari(userAgent: string): boolean {
  return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android/.test(userAgent);
}

export function showIosInstallHint(env: InstallHintEnv): boolean {
  if (env.dismissed || env.navigatorStandalone || env.displayModeStandalone) return false;
  return isIosDevice(env) && isSafari(env.userAgent);
}
