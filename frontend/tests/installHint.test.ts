import { describe, expect, it } from 'vitest';
import { Settings } from '@/domain/schema';
import { showIosInstallHint } from '@/features/home/installHint';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('iOS-Installationshinweis', () => {
  const base = {
    userAgent: iphone,
    platform: 'iPhone',
    maxTouchPoints: 5,
    navigatorStandalone: false,
    displayModeStandalone: false,
    dismissed: false,
  };

  it('zeigt die Karte nur in iOS-Safari, solange die App nicht installiert ist', () => {
    expect(showIosInstallHint(base)).toBe(true);
    expect(showIosInstallHint({ ...base, navigatorStandalone: true })).toBe(false);
    expect(showIosInstallHint({ ...base, displayModeStandalone: true })).toBe(false);
    expect(showIosInstallHint({ ...base, dismissed: true })).toBe(false);
    expect(
      showIosInstallHint({
        ...base,
        userAgent: iphone.replace('Safari', 'CriOS'),
      }),
    ).toBe(false);
    expect(
      showIosInstallHint({
        ...base,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });

  it('liest ein fehlendes Hinweis-Feld als nicht weggeklickt, ohne Schemaversion', () => {
    const parsed = Settings.parse({ id: 'device' });
    expect(parsed.dismissedIosInstallHint).toBe(false);
    expect(Settings.parse({ id: 'device', dismissedIosInstallHint: true }).dismissedIosInstallHint).toBe(
      true,
    );
  });
});
