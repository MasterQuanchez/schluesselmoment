import { useState } from 'react';
import { APP_CONFIG } from '@/config';
import { PHRASES } from '@/domain/catalog';
import { useSettings } from '@/storage/useSettings';
import { Icon } from '@/ui/Icon';
import { Field, TopBar } from '@/ui/kit';

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const [phrase, setPhrase] = useState('');
  if (!settings) return <div className="empty">Lädt …</div>;

  const add = () => {
    const v = phrase.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!v) return;
    update((s) => ({ ...s, customPhrases: [...new Set([...s.customPhrases, v])] }));
    setPhrase('');
  };

  return (
    <>
      <TopBar title="Mehr" back={{ name: 'home' }} />
      <main className="page stack">
        <h1 className="page-title">Einstellungen</h1>
        <p className="page-sub">Gelten nur auf diesem Gerät.</p>

        <Field label="Mein Name (wird bei neuen Protokollen als „Erstellt von“ eingetragen)">
          <input
            className="input"
            autoComplete="name"
            value={settings.inspectorName}
            onChange={(e) => {
              const v = e.currentTarget.value;
              update((s) => ({ ...s, inspectorName: v }));
            }}
          />
        </Field>

        <h2 className="section-title">Eigene Schnellauswahl-Begriffe</h2>
        <p className="hint">Erscheinen in jedem Raum zusätzlich zu den Standardbegriffen.</p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            className="input grow"
            placeholder="z. B. Silikon im Bad erneuern"
            value={phrase}
            maxLength={80}
            onChange={(e) => setPhrase(e.currentTarget.value)}
          />
          <button type="submit" className="btn btn--primary" aria-label="Begriff hinzufügen">
            <Icon name="plus" />
          </button>
        </form>
        <div className="chips">
          {settings.customPhrases.length === 0 ? (
            <span className="muted small">Noch keine eigenen Begriffe.</span>
          ) : null}
          {settings.customPhrases.map((p) => (
            <button
              key={p}
              type="button"
              className="chip chip--phrase"
              aria-label={`${p} entfernen`}
              onClick={() => update((s) => ({ ...s, customPhrases: s.customPhrases.filter((x) => x !== p) }))}
            >
              {p} <Icon name="x" size={14} />
            </button>
          ))}
        </div>

        <details className="more">
          <summary>
            <Icon name="chevronDown" /> Standardbegriffe ansehen ({Object.values(PHRASES).flat().length})
          </summary>
          <p className="hint">
            Änderungen an der Standardliste kommen mit dem nächsten App-Update auf alle Geräte.
          </p>
          <div className="chips">
            {Object.values(PHRASES)
              .flat()
              .map((p) => (
                <span key={p} className="chip">
                  {p}
                </span>
              ))}
          </div>
        </details>

        <h2 className="section-title">Datenschutz</h2>
        <div className="card small stack">
          <span>Alle Protokolle und Fotos liegen nur auf diesem Gerät. Es gibt keinen Server.</span>
          <span>
            Versendete Protokolle werden {APP_CONFIG.retentionDays} Tage nach dem Versand automatisch
            gelöscht.
          </span>
          <span className="muted">Version {__APP_VERSION__}</span>
        </div>
      </main>
    </>
  );
}
