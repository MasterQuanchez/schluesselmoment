import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
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
import { tick } from '@/ui/haptic';
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
  onNext,
  nextLabel,
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
  /** Nächstes offenes Element im Raum. Setzt keinen Status. */
  onNext?: () => void;
  nextLabel?: string | null;
  onError: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useRef<{ y: number; t: number } | null>(null);
  const def = CHECKS[checkId];
  const state = room.checks[checkId] ?? 'open';
  const defect = room.defects[checkId] ?? emptyDefect();
  const [morePhrases, setMorePhrases] = useState(false);
  const phrases = defectPhrases(checkId, custom);
  const visiblePhrases = morePhrases ? phrases : phrases.slice(0, DEFECT_PHRASE_PREVIEW);
  const pending = roomIssues(room).find((issue) => issue.checkId === checkId && issue.kind !== 'open');
  const photoCount = defect.photoIds.length;
  const photosEnough = photoCount >= RULES.minPhotosPerDefect;

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
    const focusable = () =>
      [...(root?.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select') ?? [])].filter(
        (el) => !el.hasAttribute('disabled'),
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !root) return;
      const list = focusable();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const vv = window.visualViewport;
    const lift = () => {
      if (!vv || !root) return;
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--keyboard', `${overlap}px`);
    };
    vv?.addEventListener('resize', lift);
    vv?.addEventListener('scroll', lift);
    lift();
    return () => {
      window.removeEventListener('keydown', onKey);
      vv?.removeEventListener('resize', lift);
      vv?.removeEventListener('scroll', lift);
    };
  }, [focus]);

  const choose = (next: 'ok' | 'defect' | 'na') => {
    if (locked) return;
    tick();
    onChange((r) => setCheck(r, checkId, next));
  };

  const onDragDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const sheet = dialogRef.current;
    if (!start || !sheet) return;
    const dy = Math.max(0, e.clientY - start.y);
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onDragUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const sheet = dialogRef.current;
    drag.current = null;
    if (!start || !sheet) return;
    const dy = Math.max(0, e.clientY - start.y);
    const fast = dy > 24 && performance.now() - start.t < 250;
    const height = sheet.getBoundingClientRect().height;
    if (fast || dy > height * 0.3) {
      closeRef.current();
      return;
    }
    sheet.style.transition = 'transform 200ms var(--ease-drawer)';
    sheet.style.transform = '';
  };

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
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
          onPointerCancel={onDragUp}
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
          <div className="decision decision--three">
            <button
              type="button"
              data-kind="ok"
              aria-pressed={state === 'ok'}
              disabled={locked}
              onClick={() => choose('ok')}
            >
              <Icon name="check" size={18} />
              <span className="decision__label">OK</span>
            </button>
            <button
              type="button"
              data-kind="defect"
              aria-pressed={state === 'defect'}
              disabled={locked}
              onClick={() => choose('defect')}
            >
              <Icon name="alert" size={18} />
              <span className="decision__label">Mangel</span>
            </button>
            <button
              type="button"
              data-kind="na"
              aria-pressed={state === 'na'}
              disabled={locked}
              onClick={() => choose('na')}
            >
              <span aria-hidden="true">–</span>
              <span className="decision__label">Nicht vorh.</span>
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
          {def?.attributes?.length && (state === 'ok' || state === 'defect') ? (
            <section className="stack" aria-label="Angaben">
              <h3 className="subhead">Angaben</h3>
              {def.attributes.map((attr) => {
                const missing = !room.details[checkId]?.[attr.id];
                return (
                  <div key={attr.id} className={missing ? 'attr-row attr-row--missing' : 'attr-row'}>
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
                );
              })}
            </section>
          ) : null}
        </div>
        <div className="sheet__foot">
          <button
            type="button"
            className={pending || state === 'open' ? 'btn btn--block' : 'btn btn--primary btn--block'}
            onClick={() => {
              if (state !== 'open' && !pending && nextLabel && onNext) onNext();
              else closeRef.current();
            }}
          >
            {pending
              ? sheetCloseLabel(pending)
              : state === 'open'
                ? 'Schließen'
                : nextLabel
                  ? `Fertig – weiter zu ${nextLabel}`
                  : 'Fertig'}
          </button>
          {state !== 'open' && !pending && nextLabel ? (
            <button type="button" className="btn btn--text btn--block" onClick={() => closeRef.current()}>
              Nur schließen
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
