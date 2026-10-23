import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/config';
import { PROTOCOL_TYPE_LABEL } from '@/domain/catalog';
import { createProtocol, deletionDate } from '@/domain/protocol';
import type { Protocol, ProtocolType } from '@/domain/schema';
import { href, navigate } from '@/router';
import { deleteProtocol, getSettings, listProtocols, saveProtocol } from '@/storage/db';
import { useSettings } from '@/storage/useSettings';
import { useDismissHistory } from '@/ui/dismiss';
import { Icon } from '@/ui/Icon';
import { TopBar, useToast } from '@/ui/kit';
import { showIosInstallHint } from './installHint';

const IOS_HINT =
  'Zum Home-Bildschirm hinzufügen: Teilen ⬆ → Zum Home-Bildschirm. Nur so funktioniert die App offline und Ihre Protokolle bleiben gespeichert.';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function HomeScreen() {
  const [items, setItems] = useState<Protocol[] | null>(null);
  const [choose, setChoose] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { settings, update } = useSettings();
  const [toast, showToast] = useToast();
  const [pendingDelete, setPendingDelete] = useState<Protocol | null>(null);
  const dismissDelete = useDismissHistory(pendingDelete !== null, () => setPendingDelete(null));

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const reload = () =>
    void listProtocols()
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(reload, []);

  const start = async (type: ProtocolType) => {
    const settings = await getSettings();
    const p = { ...createProtocol(type), inspector: settings.inspectorName };
    await saveProtocol(p);
    navigate({ name: 'basis', id: p.id });
  };

  const remove = async (p: Protocol) => {
    await deleteProtocol(p.id);
    dismissDelete();
    showToast('Gelöscht');
    reload();
  };

  return (
    <>
      <TopBar
        title={
          <span className="brand-lockup">
            <img className="brand-mark brand-mark--bar" src="/favicon.svg" alt="" />
            <span className="brand-word">Schlüsselmoment</span>
          </span>
        }
        action={
          <a className="btn btn--ghost" href={href({ name: 'settings' })}>
            Mehr
          </a>
        }
      />
      <main className="page stack">
        <div>
          <h1 className="page-title">Protokolle</h1>
          <p className="page-sub">Alle Daten bleiben auf diesem Gerät, bis Sie das PDF teilen.</p>
        </div>

        {settings &&
        showIosInstallHint({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
          navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
          displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
          dismissed: settings.dismissedIosInstallHint,
        }) ? (
          <div className="card row">
            <p className="grow">{IOS_HINT}</p>
            <button
              type="button"
              className="btn btn--ghost"
              aria-label="Hinweis schließen"
              onClick={() => update((s) => ({ ...s, dismissedIosInstallHint: true }))}
            >
              <Icon name="x" />
            </button>
          </div>
        ) : null}
        {installPrompt ? (
          <button type="button" className="btn btn--ghost" onClick={() => void installPrompt.prompt()}>
            App installieren
          </button>
        ) : null}

        {choose ? (
          <div className="card stack celebrate">
            <b>Welches Protokoll?</b>
            {(Object.keys(PROTOCOL_TYPE_LABEL) as ProtocolType[]).map((t) => (
              <button key={t} type="button" className="btn btn--block" onClick={() => void start(t)}>
                {PROTOCOL_TYPE_LABEL[t]}
              </button>
            ))}
            <button type="button" className="btn btn--ghost" onClick={() => setChoose(false)}>
              Abbrechen
            </button>
          </div>
        ) : null}

        {items === null ? (
          <div className="empty">Lädt …</div>
        ) : items.length === 0 ? (
          <div className="empty stack brand-empty">
            <img className="brand-mark brand-mark--empty" src="/favicon.svg" alt="" />
            <span>Noch keine Protokolle.</span>
            <span className="brand-claim">Übergaben, die einfach stimmen.</span>
            <span>
              Mit <b>+</b> ein neues starten.
            </span>
          </div>
        ) : (
          <ul className="list">
            {items.map((p) => {
              const done = p.rooms.filter((r) => r.completedAt).length;
              return (
                <li key={p.id} className="row">
                  <a
                    className="list-item grow"
                    href={href({ name: p.status === 'signed' ? 'finish' : 'rooms', id: p.id })}
                  >
                    <div className="grow">
                      <div className="list-item__title row">
                        <span>{p.property.street || 'Ohne Adresse'}</span>
                        {p.inspector === 'Demo' ? <span className="badge">DEMO</span> : null}
                      </div>
                      <div className="small muted">
                        {PROTOCOL_TYPE_LABEL[p.type]} · {new Date(p.createdAt).toLocaleDateString('de-DE')} ·{' '}
                        {p.status === 'signed' ? 'unterschrieben' : `${done}/${p.rooms.length} Räume`}
                        {deletionDate(p, APP_CONFIG.retentionDays)
                          ? ` · wird am ${deletionDate(p, APP_CONFIG.retentionDays)?.toLocaleDateString('de-DE')} gelöscht`
                          : ''}
                      </div>
                    </div>
                    {p.status === 'signed' ? <span className="badge badge--ok">✓</span> : null}
                  </a>
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger"
                    aria-label="Löschen"
                    onClick={() => setPendingDelete(p)}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <button type="button" className="fab" aria-label="Neues Protokoll" onClick={() => setChoose(true)}>
        <Icon name="plus" size={28} />
      </button>
      {pendingDelete ? (
        <div className="dialog-root">
          <button type="button" className="sheet-backdrop" aria-label="Abbrechen" onClick={dismissDelete} />
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title" className="section-title">
              Protokoll löschen?
            </h2>
            <p>
              „{pendingDelete.property.street || 'ohne Adresse'}“ wird mit allen Fotos von diesem Gerät
              gelöscht.
            </p>
            <button
              type="button"
              className="btn btn--danger-fill btn--block"
              onClick={() => void remove(pendingDelete)}
            >
              Protokoll löschen
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={dismissDelete}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}
      {toast}
    </>
  );
}
