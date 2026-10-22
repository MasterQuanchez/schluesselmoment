import { useRef, useState } from 'react';
import { CHECKS, INVENTORY, RULES } from '@/domain/catalog';
import {
  appendPhrase,
  completeRoom,
  conditionPhrases,
  cycleCheck,
  emptyDefect,
  getTemplate,
  issueLabel,
  markHasDefects,
  markNoDefects,
  photoCountLabel,
  roomIssues,
  roomProgress,
} from '@/domain/protocol';
import type { CheckState, Protocol, Room } from '@/domain/schema';
import { navigate } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { useSettings } from '@/storage/useSettings';
import { Icon } from '@/ui/Icon';
import { Loading, StepNav, Stepper, TopBar, useToast } from '@/ui/kit';
import { ElementSheet } from './ElementSheet';

const STATE_LABEL: Record<CheckState, string> = { open: 'nicht geprüft', ok: 'in Ordnung', defect: 'Mangel' };

export function RoomScreen({ id, roomId }: { id: string; roomId: string }) {
  const { state, update } = useProtocol();
  const { settings } = useSettings();
  const custom = settings?.customPhrases ?? [];
  const [toast, showToast] = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetFocus, setSheetFocus] = useState<'photos' | 'description' | undefined>(undefined);
  const [nudgeId, setNudgeId] = useState<string | null>(null);
  const infoRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const room = p.rooms.find((r) => r.id === roomId);
  if (!room) return <div className="empty">Raum nicht gefunden.</div>;
  const locked = p.status !== 'draft';
  const template = getTemplate(room);
  const progress = roomProgress(room);
  const defectIds = Object.entries(room.checks)
    .filter(([, s]) => s === 'defect')
    .map(([k]) => k);

  const setRoom = (fn: (r: Room) => Room) =>
    update((proto: Protocol) => ({ ...proto, rooms: proto.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }));

  const openIds = template.checks.filter((checkId) => (room.checks[checkId] ?? 'open') === 'open');
  const issues = roomIssues(room);
  const firstIssue = issues[0];
  const idx = p.rooms.findIndex((r) => r.id === roomId);
  const nextRoom = p.rooms[idx + 1];
  const ready = issues.length === 0;

  const onNoDefects = () => {
    const res = markNoDefects(room);
    if (!res.ok) return showToast(res.reason);
    setRoom(() => res.room);
  };

  const openSheet = (checkId: string, focus?: 'photos' | 'description') => {
    setSheetFocus(focus);
    setOpenId(checkId);
  };

  const nudgeChip = (checkId: string) => {
    document
      .querySelector(`[data-check="${checkId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setNudgeId(checkId);
    window.setTimeout(() => setNudgeId((cur) => (cur === checkId ? null : cur)), 700);
  };

  const onFirstIssue = () => {
    if (!firstIssue) return;
    if (firstIssue.kind === 'open') {
      nudgeChip(firstIssue.checkId);
      return;
    }
    openSheet(firstIssue.checkId, firstIssue.kind === 'missingPhotos' ? 'photos' : 'description');
  };

  const onComplete = () => {
    const res = completeRoom(room);
    if (!res.ok) {
      onFirstIssue();
      return;
    }
    setRoom(() => res.room);
    const following =
      p.rooms.slice(idx + 1).find((r) => !r.completedAt) ??
      p.rooms.find((r) => !r.completedAt && r.id !== roomId);
    showToast(`✓ ${room.label} erledigt`);
    navigate(following ? { name: 'room', id, roomId: following.id } : { name: 'rooms', id });
  };

  const finishLabel = nextRoom
    ? `${room.label} fertig – weiter zu ${nextRoom.label}`
    : `${room.label} fertig – zur Übersicht`;
  const blockedLabel = firstIssue
    ? `${issueLabel(firstIssue)}${issues.length > 1 ? ` · +${issues.length - 1} weitere` : ''}`
    : finishLabel;

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
          {openIds.length > 0 ? <p className="hint">Bitte jeden Punkt einmal antippen.</p> : null}
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
              const label = def?.label ?? checkId;
              return (
                <div
                  key={checkId}
                  data-check={checkId}
                  className={`chip-row${s === 'open' ? ' chip-row--open' : ''}${nudgeId === checkId ? ' chip-row--nudge' : ''}`}
                >
                  <button
                    type="button"
                    className="chip"
                    data-state={s}
                    disabled={locked}
                    onClick={() => {
                      const current = room.checks[checkId] ?? 'open';
                      setRoom((r) => cycleCheck(r, checkId));
                      if (current === 'ok') openSheet(checkId, 'photos');
                    }}
                    aria-label={`${label}: ${STATE_LABEL[s]}. Tippen zum Ändern.`}
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
                    {label}
                  </button>
                  <button
                    type="button"
                    className="chip__info"
                    aria-label={`Details zu ${label}`}
                    disabled={locked}
                    ref={(node) => {
                      infoRefs.current[checkId] = node;
                    }}
                    onClick={() => openSheet(checkId)}
                  >
                    <Icon name="info" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="hint">Jeden Punkt einzeln antippen: OK ✓ → Mangel ⚠ → zurücksetzen</p>
        </section>

        {defectIds.map((checkId) => {
          const def = CHECKS[checkId];
          const d = room.defects[checkId] ?? emptyDefect();
          const label = def?.label ?? checkId;
          const photosShort = d.photoIds.length < RULES.minPhotosPerDefect;
          return (
            <div key={checkId} className="card card--defect card--summary">
              <button type="button" className="card__open" onClick={() => openSheet(checkId, 'description')}>
                <b>Mangel: {label}</b>
                <span className="one-line">{d.description.trim() || 'Noch ohne Beschreibung'}</span>
                <span className={photosShort ? 'badge badge--defect' : 'badge badge--ok'}>
                  {d.photoIds.length}/{RULES.minPhotosPerDefect} Fotos
                </span>
              </button>
              <button
                type="button"
                className="btn"
                disabled={locked}
                onClick={() => openSheet(checkId, 'photos')}
              >
                <Icon name="camera" size={18} /> {photoCountLabel(d.photoIds.length)}
              </button>
            </div>
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
            {conditionPhrases().map((ph) => (
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
      </main>
      {locked ? null : (
        <div className="bottombar">
          <div className="bottombar__inner">
            <button
              type="button"
              className={`btn btn--block${ready ? ' btn--primary' : ''}`}
              onClick={ready ? onComplete : onFirstIssue}
            >
              {ready ? <Icon name="check" /> : null}
              {blockedLabel}
            </button>
          </div>
        </div>
      )}
      {openId ? (
        <ElementSheet
          key={openId}
          room={room}
          checkId={openId}
          locked={locked}
          custom={custom}
          protocolId={id}
          focus={sheetFocus}
          onChange={setRoom}
          onError={showToast}
          onClose={() => {
            const checkId = openId;
            setOpenId(null);
            infoRefs.current[checkId]?.focus();
          }}
        />
      ) : null}
      {toast}
    </>
  );
}
