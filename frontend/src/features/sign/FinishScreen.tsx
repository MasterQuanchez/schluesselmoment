import { useState } from 'react';
import { APP_CONFIG } from '@/config';
import {
  addSignature,
  backToDraft,
  mailRecipients,
  missingSignatureCount,
  missingSignatureLabel,
  protocolIssues,
  recommendedIssues,
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

function protocolStamp(p: Protocol): string {
  return `${p.status}|${p.updatedAt}|${p.seal?.hash ?? ''}`;
}

function formatBytes(bytes: number): string {
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb.toLocaleString('de-DE')} kB`;
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

interface PreparedPdf {
  file: File;
  name: string;
  bytes: number;
  pages: number;
  stamp: string;
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
  const [prepared, setPrepared] = useState<PreparedPdf | null>(null);

  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const stamp = protocolStamp(p);
  const readyPdf = prepared?.stamp === stamp ? prepared : null;
  const issues = protocolIssues(p);
  const hints = recommendedIssues(p);
  const signers = requiredSigners(p);
  const issueHref = (issue: (typeof issues)[number]) => {
    if (issue.roomId) return href({ name: 'room', id, roomId: issue.roomId, checkId: issue.checkId });
    if (issue.fieldId?.startsWith('field-meter-')) return href({ name: 'meters', id, focus: issue.fieldId });
    if (issue.fieldId) return href({ name: 'basis', id, focus: issue.fieldId });
    return href({ name: 'basis', id });
  };

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

  const buildPdf = async (): Promise<PreparedPdf> => {
    const here = protocolStamp(p);
    const { generatePdf, pdfFileName } = await import('@/pdf/generate');
    const { PDFDocument } = await import('pdf-lib');
    const bytes = await generatePdf(p, loadPhotoBytes);
    const doc = await PDFDocument.load(bytes);
    const name = pdfFileName(p);
    return {
      file: new File([bytes as BlobPart], name, { type: 'application/pdf' }),
      name,
      bytes: bytes.byteLength,
      pages: doc.getPageCount(),
      stamp: here,
    };
  };

  const prepare = async () => {
    setBusy(true);
    try {
      setPrepared(await buildPdf());
    } catch (e) {
      showToast(e instanceof Error ? `PDF-Fehler: ${e.message}` : 'PDF-Fehler');
    } finally {
      setBusy(false);
    }
  };

  /** Entwurf ohne Teilen-Menü. */
  const downloadFresh = async () => {
    setBusy(true);
    try {
      const pdf = readyPdf ?? (await buildPdf());
      downloadFile(pdf.file);
      if (p.status === 'signed') markShared();
    } catch (e) {
      showToast(e instanceof Error ? `PDF-Fehler: ${e.message}` : 'PDF-Fehler');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Teilen muss im Klick selbst starten. Kein await davor, sonst blockt iOS das Menü.
   * Empfänger landen im selben Klick in der Zwischenablage, ebenfalls ohne await.
   */
  const sendMail = () => {
    if (!readyPdf) return;
    const to = mailRecipients(p, APP_CONFIG.ccEmail);
    const hint = p.tenants
      .filter((tenant) => tenant.noEmail || !tenant.email.trim())
      .map(
        (tenant) =>
          `Für ${tenant.name.trim() || 'den Mieter'} ist keine E-Mail hinterlegt – Adresse im Mailprogramm ergänzen.`,
      )
      .join(' ');
    const copiedMsg = to.length
      ? `Empfänger kopiert: ${to.join(', ')} – im Mail-Programm ins „An“-Feld einfügen.`
      : '';
    if (hint) showToast(hint);
    const copied = to.length ? navigator.clipboard?.writeText(to.join(', ')) : undefined;
    if (copied) {
      void copied.then(
        () => showToast([copiedMsg, hint].filter(Boolean).join(' ')),
        () => {
          if (hint) showToast(hint);
        },
      );
    }
    const text = `${readyPdf.name}${to.length ? `\nAn: ${to.join(', ')}` : ''}`;
    if (navigator.canShare?.({ files: [readyPdf.file] })) {
      void navigator
        .share({ files: [readyPdf.file], title: readyPdf.name, text })
        .then(() => markShared())
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          showToast(e instanceof Error ? `Teilen fehlgeschlagen: ${e.message}` : 'Teilen fehlgeschlagen');
        });
      return;
    }
    downloadFile(readyPdf.file);
    markShared();
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
                    <li key={`${i.fieldId ?? i.roomId ?? ''}-${i.message}`}>
                      <a href={issueHref(i)}>{i.message}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="notice notice--ok celebrate">
                ✓ Alles erfasst. Schreiben Sie den Inhalt fest und lassen Sie unterschreiben.
              </div>
            )}
            {hints.length ? (
              <details className="more">
                <summary>Empfohlen, aber nicht nötig ({hints.length})</summary>
                <ul className="issues">
                  {hints.map((i) => (
                    <li key={`${i.fieldId ?? i.roomId ?? ''}-${i.message}`}>
                      <a href={issueHref(i)}>{i.message}</a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
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
              onClick={() => void downloadFresh()}
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
                  const role = s.role === 'landlord' ? 'Vermieter/Verwalter' : 'Mieter';
                  return (
                    <li key={`${s.role}-${s.partyIndex}`} className="list-item">
                      <div className="grow">
                        <div className="list-item__title">{s.name}</div>
                        <div className="small muted">{role}</div>
                      </div>
                      {sig ? (
                        <>
                          <button
                            type="button"
                            className="sig-preview"
                            aria-label={`Unterschrift von ${s.name} ändern`}
                            onClick={() => setSigning(s)}
                          >
                            <img src={sig.image} alt="" />
                          </button>
                          <span className="badge badge--ok">✓ unterschrieben</span>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--line"
                          aria-label={`Unterschreiben: ${s.name}`}
                          onClick={() => setSigning(s)}
                        >
                          Unterschreiben
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={missingSignatureCount(p) > 0 || busy}
              onClick={() => void seal()}
            >
              {missingSignatureCount(p) > 0 ? (
                missingSignatureLabel(missingSignatureCount(p))
              ) : (
                <>
                  <Icon name="check" /> Abschließen & versiegeln
                </>
              )}
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
                gelöscht. Bitte legen Sie das PDF selbst ab (Kopie an sich selbst).
              </span>
            </div>
            {readyPdf ? (
              <div className="card small stack">
                <b>{readyPdf.name}</b>
                <span>
                  {formatBytes(readyPdf.bytes)} · {readyPdf.pages} {readyPdf.pages === 1 ? 'Seite' : 'Seiten'}
                </span>
              </div>
            ) : (
              <button type="button" className="btn btn--block" disabled={busy} onClick={() => void prepare()}>
                <Icon name="file" /> {busy ? 'Erstellt …' : 'PDF vorbereiten'}
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={!readyPdf || busy}
              onClick={sendMail}
            >
              <Icon name="share" /> Per E-Mail senden
            </button>
            <button
              type="button"
              className="btn btn--block"
              disabled={busy}
              onClick={() => void downloadFresh()}
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
