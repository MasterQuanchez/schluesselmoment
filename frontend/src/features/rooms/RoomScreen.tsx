import { useEffect, useState } from 'react';
import { CHECKS, INVENTORY, RULES } from '@/domain/catalog';
import {
  appendPhrase,
  completeRoom,
  cycleCheck,
  emptyDefect,
  getTemplate,
  markHasDefects,
  markNoDefects,
  phrasesFor,
  roomIssues,
  roomProgress,
  setDetail,
  updateDefect,
} from '@/domain/protocol';
import type { CheckState, Protocol, Room } from '@/domain/schema';
import { navigate } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { useSettings } from '@/storage/useSettings';
import { Icon } from '@/ui/Icon';
import { Loading, StepNav, Stepper, TopBar, useToast } from '@/ui/kit';
import { PhotoStrip } from '@/ui/Photos';

const STATE_LABEL: Record<CheckState, string> = { open: 'nicht geprüft', ok: 'in Ordnung', defect: 'Mangel' };

export function RoomScreen({ id, roomId }: { id: string; roomId: string }) {
  const { state, update } = useProtocol();
  const { settings } = useSettings();
  const custom = settings?.customPhrases ?? [];
  const [toast, showToast] = useToast();
  const [showIssues, setShowIssues] = useState(false);
  // roomId is a prop. Biome 2.6 treats it as a stable outer value and would drop it,
  // which would keep the "Bitte noch erledigen" list when the user opens another room.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the hint list on room change
  useEffect(() => setShowIssues(false), [roomId]);

  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const room = p.rooms.find((r) => r.id === roomId);
  if (!room) return <div className="empty">Raum nicht gefunden.</div>;
  const locked = p.status !== 'draft';
  const template = getTemplate(room);
  const progress = roomProgress(room);
  const issues = roomIssues(room);
  const defectIds = Object.entries(room.checks)
    .filter(([, s]) => s === 'defect')
    .map(([k]) => k);

  const setRoom = (fn: (r: Room) => Room) =>
    update((proto: Protocol) => ({ ...proto, rooms: proto.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }));

  const onNoDefects = () => {
    const res = markNoDefects(room);
    if (!res.ok) return showToast(res.reason);
    setRoom(() => res.room);
    if (issues.length) showToast('Gut. Jetzt jeden Punkt einzeln mit ✓ bestätigen.');
  };

  const onComplete = () => {
    const res = completeRoom(room);
    if (!res.ok) {
      setShowIssues(true);
      showToast('Noch nicht vollständig – siehe Hinweise oben.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setRoom(() => res.room);
    const idx = p.rooms.findIndex((r) => r.id === roomId);
    const next =
      p.rooms.slice(idx + 1).find((r) => !r.completedAt) ??
      p.rooms.find((r) => !r.completedAt && r.id !== roomId);
    showToast(`✓ ${room.label} erledigt`);
    navigate(next ? { name: 'room', id, roomId: next.id } : { name: 'rooms', id });
  };

  return (
    <>
      <TopBar title={room.label} back={{ name: 'rooms', id }}>
        <StepNav protocol={p} current="rooms" />
      </TopBar>
      <main className="page stack">
        <div>
          <h1 className="page-title">{room.label}</h1>
          <p className="page-sub">
            Zustand des Raums erfassen · {progress.done}/{progress.total} geprüft
          </p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>

        {showIssues && issues.length > 0 ? (
          <div className="notice" role="alert">
            <b>Bitte noch erledigen:</b>
            <ul className="issues">
              {issues.map((i) => (
                <li key={`${i.checkId}-${i.message}`}>{i.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section aria-labelledby="h-decision">
          <h2 id="h-decision" className="section-title">
            Gibt es Mängel?
          </h2>
          <div className="decision">
            <button
              type="button"
              data-kind="ok"
              aria-pressed={room.decision === 'noDefects'}
              onClick={onNoDefects}
              disabled={locked}
            >
              <Icon name="check" size={22} /> Keine Mängel
            </button>
            <button
              type="button"
              data-kind="defect"
              aria-pressed={room.decision === 'defects'}
              onClick={() => setRoom(markHasDefects)}
              disabled={locked}
            >
              <Icon name="x" size={22} /> Mängel
            </button>
          </div>
        </section>

        <section aria-labelledby="h-quick">
          <h2 id="h-quick" className="section-title row">
            <span className="grow">Schnellcheck</span>
            <span className={progress.done === progress.total ? 'badge badge--ok' : 'badge'}>
              {progress.done}/{progress.total}
            </span>
          </h2>
          <div className="chips">
            {template.checks.map((checkId) => {
              const def = CHECKS[checkId];
              const s = room.checks[checkId] ?? 'open';
              return (
                <button
                  key={checkId}
                  type="button"
                  className="chip"
                  data-state={s}
                  disabled={locked}
                  onClick={() => setRoom((r) => cycleCheck(r, checkId))}
                  aria-label={`${def?.label ?? checkId}: ${STATE_LABEL[s]}. Tippen zum Ändern.`}
                >
                  <span className="chip__mark">
                    {s === 'ok' ? (
                      <Icon name="check" size={14} />
                    ) : s === 'defect' ? (
                      <Icon name="alert" size={13} />
                    ) : (
                      <Icon name={def?.icon ?? 'box'} size={16} />
                    )}
                  </span>
                  {def?.label ?? checkId}
                </button>
              );
            })}
          </div>
          <p className="hint">Jeden Punkt einzeln antippen: OK ✓ → Mangel ⚠ → zurücksetzen</p>
        </section>

        {defectIds.map((checkId) => {
          const def = CHECKS[checkId];
          const d = room.defects[checkId] ?? emptyDefect();
          return (
            <section key={checkId} className="card card--defect stack" aria-label={`Mangel ${def?.label}`}>
              <div className="row">
                <Icon name="alert" />
                <b className="grow">Mangel: {def?.label}</b>
                <span
                  className={
                    d.photoIds.length >= RULES.minPhotosPerDefect ? 'badge badge--ok' : 'badge badge--defect'
                  }
                >
                  {d.photoIds.length}/{RULES.minPhotosPerDefect} Fotos
                </span>
              </div>
              {def?.hint ? <p className="hint">{def.hint}</p> : null}
              <textarea
                className="textarea"
                placeholder="Was genau? Wo? Wie groß?"
                value={d.description}
                disabled={locked}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setRoom((r) => updateDefect(r, checkId, { description: v }));
                }}
              />
              <div className="chips">
                {phrasesFor(room, custom).map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    className="chip chip--phrase"
                    disabled={locked}
                    onClick={() =>
                      setRoom((r) =>
                        updateDefect(r, checkId, { description: appendPhrase(d.description, ph) }),
                      )
                    }
                  >
                    {ph}
                  </button>
                ))}
              </div>
              <PhotoStrip
                protocolId={id}
                ids={d.photoIds}
                disabled={locked}
                onError={showToast}
                onChange={(photoIds) => setRoom((r) => updateDefect(r, checkId, { photoIds }))}
              />
            </section>
          );
        })}

        <section aria-labelledby="h-notes">
          <h2 id="h-notes" className="section-title">
            Schnellauswahl
          </h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            Begriff antippen, um ihn in die Notizen zu übernehmen. Der Text bleibt frei änderbar.
          </p>
          <div className="chips" style={{ marginBottom: 12 }}>
            {phrasesFor(room, custom).map((ph) => (
              <button
                key={ph}
                type="button"
                className="chip chip--phrase"
                disabled={locked}
                onClick={() => setRoom((r) => ({ ...r, note: appendPhrase(r.note, ph) }))}
              >
                {ph}
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            aria-label="Notizen zum Raum"
            placeholder="Notizen zum Raum"
            value={room.note}
            disabled={locked}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setRoom((r) => ({ ...r, note: v }));
            }}
          />
        </section>

        {template.inventory?.length ? (
          <section aria-labelledby="h-inv">
            <h2 id="h-inv" className="section-title">
              Ausstattung vorhanden
            </h2>
            <div className="chips">
              {template.inventory.map((itemId) => {
                const def = INVENTORY[itemId];
                if (!def) return null;
                const v = room.inventory[itemId];
                if (def.type === 'count') {
                  return (
                    <div
                      key={itemId}
                      className="row"
                      style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                      <span>{def.label}</span>
                      <Stepper
                        label={def.label}
                        value={typeof v === 'number' ? v : 0}
                        onChange={(n) =>
                          setRoom((r) => ({ ...r, inventory: { ...r.inventory, [itemId]: n } }))
                        }
                      />
                    </div>
                  );
                }
                return (
                  <button
                    key={itemId}
                    type="button"
                    className="chip chip--option"
                    aria-pressed={v === true}
                    disabled={locked}
                    onClick={() =>
                      setRoom((r) => ({ ...r, inventory: { ...r.inventory, [itemId]: !(v === true) } }))
                    }
                  >
                    {def.label}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <details className="more">
          <summary>
            <Icon name="chevronDown" /> Details (optional): Anstrich, Belag, Verglasung …
          </summary>
          <div className="stack">
            {template.checks
              .map((c) => CHECKS[c])
              .filter((def) => def?.attributes?.length)
              .map((def) =>
                def ? (
                  <div key={def.id} className="card">
                    <b>{def.label}</b>
                    {def.attributes?.map((attr) => (
                      <div key={attr.id} className="attr-row">
                        <b className="muted">{attr.label}</b>
                        {attr.options.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="chip chip--option"
                            disabled={locked}
                            aria-pressed={room.details[def.id]?.[attr.id] === o.id}
                            onClick={() => setRoom((r) => setDetail(r, def.id, attr.id, o.id))}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null,
              )}
          </div>
        </details>
      </main>
      {locked ? null : (
        <div className="bottombar">
          <div className="bottombar__inner">
            <button type="button" className="btn btn--primary btn--block" onClick={onComplete}>
              <Icon name="check" /> {room.label} abschließen
            </button>
          </div>
        </div>
      )}
      {toast}
    </>
  );
}
