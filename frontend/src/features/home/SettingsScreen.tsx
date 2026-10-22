import { useState } from 'react';
import { APP_CONFIG } from '@/config';
import { PHRASES } from '@/domain/catalog';
import { createDemoProtocol } from '@/domain/demo';
import { completeRoom, updateDefect } from '@/domain/protocol';
import { navigate } from '@/router';
import { saveProtocol } from '@/storage/db';
import { storePhoto } from '@/storage/photos';
import { useSettings } from '@/storage/useSettings';
import { Icon } from '@/ui/Icon';
import { Field, TopBar } from '@/ui/kit';
import { createDemoPhoto } from './demoPhoto';

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoError, setDemoError] = useState('');
  if (!settings) return <div className="empty">Lädt …</div>;

  const createDemo = async () => {
    setBusy(true);
    setDemoError('');
    try {
      let protocol = createDemoProtocol();
      const photoIds: string[] = [];
      for (const label of ['1/2', '2/2']) {
        photoIds.push(await storePhoto(await createDemoPhoto(label), protocol.id));
      }
      const kitchen = protocol.rooms.find((room) => room.id === 'kitchen');
      if (!kitchen) throw new Error('Küche fehlt im Demo-Protokoll.');
      const withPhotos = updateDefect(kitchen, 'oven', { photoIds });
      const done = completeRoom(withPhotos);
      if (!done.ok) throw new Error(done.reason);
      protocol = {
        ...protocol,
        rooms: protocol.rooms.map((room) => (room.id === 'kitchen' ? done.room : room)),
      };
      await saveProtocol(protocol);
      navigate({ name: 'finish', id: protocol.id });
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Demo-Protokoll konnte nicht erstellt werden.');
    } finally {
      setBusy(false);
    }
  };

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

        <details className="more">
          <summary>
            <Icon name="chevronDown" /> Test & Vorführung
          </summary>
          <p className="hint">
            Legt ein fertiges Beispiel an. Unterschrift und PDF können Sie danach direkt prüfen.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void createDemo()}
          >
            {busy ? 'Erstellt …' : 'Demo-Protokoll erstellen'}
          </button>
          {demoError ? <p className="hint">{demoError}</p> : null}
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
