import { useState } from 'react';
import { APP_CONFIG } from '@/config';
import {
  addSignature,
  allSigned,
  backToDraft,
  mailRecipients,
  protocolIssues,
  referencedPhotoIds,
  requiredSigners,
  type Signer,
  sealProtocol,
  sha256Hex,
  signatureFor,
  startSigning,
} from '@/domain/protocol';
import type { Protocol } from '@/domain/schema';
import { href } from '@/router';
import { getPhoto, prunePhotos, saveProtocol } from '@/storage/db';
import { useProtocol } from '@/storage/useProtocol';
import { Icon } from '@/ui/Icon';
import { Loading, StepNav, TopBar, useToast } from '@/ui/kit';
import { SignaturePad } from './SignaturePad';

async function loadPhotoBytes(id: string): Promise<Uint8Array | null> {
  const rec = await getPhoto(id);
  return rec ? new Uint8Array(await rec.blob.arrayBuffer()) : null;
}

async function photoHashes(p: Protocol): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of referencedPhotoIds(p)) {
    const bytes = await loadPhotoBytes(id);
    out[id] = bytes ? await sha256Hex(bytes) : 'missing';
  }
  return out;
}

export function FinishScreen({ id }: { id: string }) {
  const { state, update, flush } = useProtocol();
  const [toast, showToast] = useToast();
  const [signing, setSigning] = useState<Signer | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const issues = protocolIssues(p);
  const signers = requiredSigners(p);

  const lock = () => {
    const res = startSigning(p);
    if (!res.ok) return showToast(res.reason);
    update(() => res.protocol);
  };

  const seal = async () => {
    setBusy(true);
    try {
      const res = await sealProtocol(p, await photoHashes(p));
      if (!res.ok) return showToast(res.reason);
      await saveProtocol(res.protocol);
      update(() => res.protocol, { allowLocked: true });
      await flush();
      await prunePhotos(p.id, new Set(referencedPhotoIds(p)));
      showToast('🎉 Protokoll versiegelt');
    } finally {
      setBusy(false);
    }
  };

  /** Versandzeitpunkt sofort speichern (startet die Löschfrist). */
  const markShared = () => {
    if (p.status !== 'signed' || p.sharedAt) return;
    update((x) => ({ ...x, sharedAt: new Date().toISOString() }), { allowLocked: true });
    void flush();
  };

  const makePdf = async (mode: 'share' | 'download') => {
    setBusy(true);
    try {
      // pdf-lib (~500 kB) erst bei Bedarf laden – Start der App bleibt schnell
      const { generatePdf, pdfFileName } = await import('@/pdf/generate');
      const bytes = await generatePdf(p, loadPhotoBytes);
      const name = pdfFileName(p);
      const file = new File([bytes as BlobPart], name, { type: 'application/pdf' });
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        // Das Teilen-Menü kann keine Empfänger vorbelegen → Adressen in die Zwischenablage,
        // im Mail-Programm einfach ins „An“-Feld einfügen.
        const to = mailRecipients(p, APP_CONFIG.ccEmail);
        if (to.length) {
          try {
            await navigator.clipboard.writeText(to.join(', '));
            showToast(`Empfänger kopiert: ${to.join(', ')} – im Mail-Programm ins „An“-Feld einfügen.`);
          } catch {
            /* Zwischenablage nicht erlaubt – Adressen stehen im Text */
          }
        }
        try {
          await navigator.share({
            files: [file],
            title: name,
            text: `${name}${to.length ? `\nAn: ${to.join(', ')}` : ''}`,
          });
          markShared();
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      markShared();
    } catch (e) {
      showToast(e instanceof Error ? `PDF-Fehler: ${e.message}` : 'PDF-Fehler');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="Abschluss" back={{ name: 'meters', id }}>
        <StepNav protocol={p} current="finish" />
      </TopBar>
      <main className="page stack">
        <h1 className="page-title">Abschluss</h1>

        {p.status === 'draft' ? (
          <>
            {issues.length ? (
              <div className="notice" role="alert">
                <b>Vor der Unterschrift noch offen:</b>
                <ul className="issues">
                  {issues.map((i) => (
                    <li key={i.message}>
                      {i.roomId ? (
                        <a href={href({ name: 'room', id, roomId: i.roomId })}>{i.message}</a>
                      ) : (
                        <a href={href({ name: 'basis', id })}>{i.message}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="notice notice--ok celebrate">
                ✓ Alles erfasst. Jetzt Inhalt festschreiben und unterschreiben lassen.
              </div>
            )}
            <label className="field">
              <span>Allgemeine Anmerkungen (optional)</span>
              <textarea
                className="textarea"
                value={p.generalNote}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  update((x) => ({ ...x, generalNote: v }));
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={issues.length > 0}
              onClick={lock}
            >
              <Icon name="pen" /> Inhalt festschreiben & unterschreiben
            </button>
            <button
              type="button"
              className="btn btn--block"
              disabled={busy}
              onClick={() => void makePdf('download')}
            >
              <Icon name="file" /> Entwurf als PDF ansehen
            </button>
          </>
        ) : null}

        {p.status === 'signing' ? (
          <>
            <p className="page-sub">
              Der Inhalt ist gesperrt. Alle Beteiligten unterschreiben nacheinander auf diesem Gerät.
            </p>
            {signing ? (
              <SignaturePad
                name={signing.name}
                onCancel={() => setSigning(null)}
                onSave={(png) => {
                  update((x) => addSignature(x, signing, png), { allowLocked: true });
                  setSigning(null);
                }}
              />
            ) : (
              <ul className="list">
                {signers.map((s) => {
                  const sig = signatureFor(p, s);
                  return (
                    <li key={`${s.role}-${s.partyIndex}`}>
                      <button
                        type="button"
                        className="list-item"
                        style={{ width: '100%', textAlign: 'left' }}
                        onClick={() => setSigning(s)}
                      >
                        <div className="grow">
                          <div className="list-item__title">{s.name}</div>
                          <div className="small muted">
                            {s.role === 'landlord' ? 'Vermieter/Verwalter' : 'Mieter'}
                          </div>
                        </div>
                        {sig ? (
                          <img src={sig.image} alt={`Unterschrift ${s.name}`} style={{ height: 36 }} />
                        ) : null}
                        <span className={sig ? 'badge badge--ok' : 'badge'}>
                          {sig ? '✓ unterschrieben' : 'Unterschreiben'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={!allSigned(p) || busy}
              onClick={() => void seal()}
            >
              <Icon name="check" /> Abschließen & versiegeln
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                if (window.confirm('Zurück zur Bearbeitung? Vorhandene Unterschriften werden verworfen.')) {
                  update(backToDraft, { allowLocked: true });
                }
              }}
            >
              Zurück zur Bearbeitung
            </button>
          </>
        ) : null}

        {p.status === 'signed' ? (
          <>
            <div className="notice notice--ok celebrate">
              <b>🎉 Protokoll abgeschlossen und versiegelt.</b>
              <div className="small" style={{ wordBreak: 'break-all', marginTop: 6 }}>
                SHA-256: {p.seal?.hash}
              </div>
            </div>
            <div className="card small stack">
              <b>Versand an</b>
              {mailRecipients(p, APP_CONFIG.ccEmail).length ? (
                <span>{mailRecipients(p, APP_CONFIG.ccEmail).join(', ')}</span>
              ) : (
                <span className="muted">Keine E-Mail-Adressen erfasst (Basis → Beteiligte).</span>
              )}
              <span className="muted">
                Nach dem Versand wird das Protokoll in {APP_CONFIG.retentionDays} Tagen von diesem Gerät
                gelöscht. Bitte das PDF selbst ablegen (Kopie an sich selbst).
              </span>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={busy}
              onClick={() => void makePdf('share')}
            >
              <Icon name="share" /> PDF per E-Mail senden
            </button>
            <button
              type="button"
              className="btn btn--block"
              disabled={busy}
              onClick={() => void makePdf('download')}
            >
              <Icon name="download" /> PDF speichern
            </button>
            <a className="btn btn--ghost btn--block" href={href({ name: 'home' })}>
              Zur Übersicht
            </a>
          </>
        ) : null}
      </main>
      {toast}
    </>
  );
}
