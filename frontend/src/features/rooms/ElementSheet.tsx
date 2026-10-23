import { useEffect, useRef, useState } from 'react';
import { CHECKS, DEFECT_PHRASE_PREVIEW, RULES } from '@/domain/catalog';
import {
  appendPhrase,
  defectPhrases,
  emptyDefect,
  photoStatusLabel,
  roomIssues,
  setCheck,
  setDetail,
  sheetCloseLabel,
  updateDefect,
} from '@/domain/protocol';
import type { Room } from '@/domain/schema';
import { Icon } from '@/ui/Icon';
import { PhotoStrip } from '@/ui/Photos';

export function ElementSheet({
  room,
  checkId,
  locked,
  custom,
  protocolId,
  focus,
  onChange,
  onClose,
  onError,
}: {
  room: Room;
  checkId: string;
  locked: boolean;
  custom: readonly string[];
  protocolId: string;
  /** Wohin gescrollt wird. Das Textfeld bekommt keinen Fokus, sonst deckt die Tastatur die Fotos ab. */
  focus?: 'photos' | 'description';
  onChange: (fn: (r: Room) => Room) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const startY = useRef<number | null>(null);
  const def = CHECKS[checkId];
  const state = room.checks[checkId] ?? 'open';
  const defect = room.defects[checkId] ?? emptyDefect();
  const [detailsOpen, setDetailsOpen] = useState(state !== 'defect');
  const [morePhrases, setMorePhrases] = useState(false);
  const phrases = defectPhrases(checkId, custom);
  const visiblePhrases = morePhrases ? phrases : phrases.slice(0, DEFECT_PHRASE_PREVIEW);
  const pending =
    state === 'defect' ? roomIssues(room).find((issue) => issue.checkId === checkId) : undefined;
  const photoCount = defect.photoIds.length;
  const photosEnough = photoCount >= RULES.minPhotosPerDefect;

  useEffect(() => {
    setDetailsOpen(state !== 'defect');
  }, [state]);

  useEffect(() => {
    const root = dialogRef.current;
    root?.querySelector<HTMLElement>('#sheet-title')?.focus();
    const target =
      focus === 'photos'
        ? root?.querySelector('#sheet-photos')
        : focus === 'description'
          ? root?.querySelector('textarea')
          : null;
    target?.scrollIntoView({ block: 'nearest' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  return (
    <div className="sheet-root">
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="Schließen"
        onClick={() => closeRef.current()}
      />
      <div ref={dialogRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div
          className="sheet__bar"
          onPointerDown={(e) => {
            startY.current = e.clientY;
          }}
          onPointerUp={(e) => {
            if (startY.current !== null && e.clientY - startY.current > 48) closeRef.current();
            startY.current = null;
          }}
        >
          <span className="sheet__grip" aria-hidden="true" />
          <button
            type="button"
            className="sheet__close"
            aria-label="Schließen"
            onClick={() => closeRef.current()}
          >
            <Icon name="x" size={22} />
          </button>
        </div>
        <div className="sheet__body">
          <h2 id="sheet-title" className="page-title" tabIndex={-1}>
            {def?.label ?? checkId}
          </h2>
          {def?.hint ? <p className="hint">{def.hint}</p> : null}
          <div className="decision">
            <button
              type="button"
              data-kind="ok"
              aria-pressed={state === 'ok'}
              disabled={locked}
              onClick={() => onChange((r) => setCheck(r, checkId, 'ok'))}
            >
              <Icon name="check" size={18} /> In Ordnung
            </button>
            <button
              type="button"
              data-kind="defect"
              aria-pressed={state === 'defect'}
              disabled={locked}
              onClick={() => onChange((r) => setCheck(r, checkId, 'defect'))}
            >
              <Icon name="alert" size={18} /> Mangel
            </button>
          </div>
          {state === 'defect' ? (
            <>
              <div id="sheet-photos" className="stack">
                <PhotoStrip
                  variant="pills"
                  protocolId={protocolId}
                  ids={defect.photoIds}
                  disabled={locked}
                  onError={onError}
                  onChange={(photoIds) => onChange((r) => updateDefect(r, checkId, { photoIds }))}
                />
                <p
                  className={
                    photosEnough ? 'photo-status photo-status--ok' : 'photo-status photo-status--warn'
                  }
                >
                  {photoStatusLabel(photoCount)}
                </p>
              </div>
              <div className="stack">
                <textarea
                  className="textarea"
                  aria-label="Mangel beschreiben"
                  placeholder="Was genau? Wo? Wie groß?"
                  value={defect.description}
                  disabled={locked}
                  onChange={(e) => {
                    const description = e.currentTarget.value;
                    onChange((r) => updateDefect(r, checkId, { description }));
                  }}
                />
                <div className="chips">
                  {visiblePhrases.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      className="chip chip--phrase"
                      disabled={locked}
                      onClick={() =>
                        onChange((r) =>
                          updateDefect(r, checkId, {
                            description: appendPhrase(r.defects[checkId]?.description ?? '', phrase),
                          }),
                        )
                      }
                    >
                      {phrase}
                    </button>
                  ))}
                  {!morePhrases && phrases.length > DEFECT_PHRASE_PREVIEW ? (
                    <button type="button" className="chip chip--phrase" onClick={() => setMorePhrases(true)}>
                      Mehr Vorschläge
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
          {def?.attributes?.length ? (
            <details
              className="more"
              open={detailsOpen}
              onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
            >
              <summary>Details (optional): {def.attributes.map((attr) => attr.label).join(', ')}</summary>
              {def.attributes.map((attr) => (
                <div key={attr.id} className="attr-row">
                  <b>{attr.label}</b>
                  <div className="chips">
                    {attr.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="chip chip--option"
                        disabled={locked}
                        aria-pressed={room.details[checkId]?.[attr.id] === option.id}
                        onClick={() => onChange((r) => setDetail(r, checkId, attr.id, option.id))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </details>
          ) : null}
        </div>
        <div className="sheet__foot">
          <button
            type="button"
            className={pending ? 'btn btn--block' : 'btn btn--primary btn--block'}
            onClick={() => closeRef.current()}
          >
            {pending ? sheetCloseLabel(pending) : 'Fertig'}
          </button>
        </div>
      </div>
    </div>
  );
}
