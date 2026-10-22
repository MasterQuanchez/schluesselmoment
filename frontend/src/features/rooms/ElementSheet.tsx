import { useEffect, useRef } from 'react';
import { CHECKS, RULES } from '@/domain/catalog';
import { appendPhrase, emptyDefect, phrasesFor, setCheck, setDetail, updateDefect } from '@/domain/protocol';
import type { Room } from '@/domain/schema';
import { Icon } from '@/ui/Icon';
import { PhotoStrip } from '@/ui/Photos';

export function ElementSheet({
  room,
  checkId,
  locked,
  custom,
  protocolId,
  onChange,
  onClose,
  onError,
}: {
  room: Room;
  checkId: string;
  locked: boolean;
  custom: readonly string[];
  protocolId: string;
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

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button, textarea, input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="sheet-root">
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="Schließen"
        onClick={() => closeRef.current()}
      />
      <div
        ref={dialogRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onPointerDown={(e) => {
          startY.current = e.clientY;
        }}
        onPointerUp={(e) => {
          if (startY.current !== null && e.clientY - startY.current > 48) closeRef.current();
          startY.current = null;
        }}
      >
        <h2 id="sheet-title" className="page-title">
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
        {def?.attributes?.map((attr) => (
          <div key={attr.id} className="stack">
            <b className="muted">{attr.label}</b>
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
        {state === 'defect' ? (
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
              {phrasesFor(room, custom).map((phrase) => (
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
            </div>
            <PhotoStrip
              protocolId={protocolId}
              ids={defect.photoIds}
              disabled={locked}
              onError={onError}
              onChange={(photoIds) => onChange((r) => updateDefect(r, checkId, { photoIds }))}
            />
            <p className="hint">
              {defect.photoIds.length}/{RULES.minPhotosPerDefect} Fotos
            </p>
          </div>
        ) : null}
        <button type="button" className="btn btn--primary btn--block" onClick={() => closeRef.current()}>
          Fertig
        </button>
      </div>
    </div>
  );
}
