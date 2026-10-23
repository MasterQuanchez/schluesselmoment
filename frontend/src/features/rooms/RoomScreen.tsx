import { useEffect, useRef, useState } from 'react';
import { CHECKS, INVENTORY, RULES } from '@/domain/catalog';
import {
  appendPhrase,
  completeRoom,
  conditionPhrases,
  cycleCheck,
  emptyDefect,
  getTemplate,
  inventoryGroups,
  issueLabel,
  missingAttributes,
  parseCount,
  photoCountLabel,
  roomHeadline,
  roomIssues,
  roomProgress,
  setCheck,
  stepCount,
} from '@/domain/protocol';
import type { CheckState, Protocol, Room } from '@/domain/schema';
import { navigate } from '@/router';
import { photoUrl } from '@/storage/photos';
import { useProtocol } from '@/storage/useProtocol';
import { useSettings } from '@/storage/useSettings';
import { useDismissHistory } from '@/ui/dismiss';
import { tick } from '@/ui/haptic';
import { Icon } from '@/ui/Icon';
import { Loading, StepNav, TopBar, useToast } from '@/ui/kit';
import { ElementSheet } from './ElementSheet';

const STATE_LABEL: Record<CheckState, string> = {
  open: 'nicht geprüft',
  ok: 'in Ordnung',
  defect: 'Mangel',
  na: 'nicht vorhanden',
};

function MiniPhoto({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void photoUrl(id).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  if (!url) return <span className="card-thumbs__ph" />;
  return <img src={url} alt="" />;
}

function InventoryGroups({
  ids,
  room,
  locked,
  onChange,
}: {
  ids: readonly string[];
  room: Room;
  locked: boolean;
  onChange: (itemId: string, value: boolean | number | null) => void;
}) {
  const groups = inventoryGroups(ids);
  return (
    <div className="stack">
      {groups.present.length ? (
        <div className="stack">
          <h3 className="subhead">Vorhanden</h3>
          {groups.present.map((itemId) => {
            const def = INVENTORY[itemId];
            if (!def) return null;
            const value = room.inventory[itemId];
            return (
              <div key={itemId} className="equip">
                <span className="equip__label">{def.label}</span>
                <div className="segment">
                  <button
                    type="button"
                    aria-label={`${def.label}: vorhanden`}
                    aria-pressed={value === true}
                    disabled={locked}
                    onClick={() => onChange(itemId, true)}
                  >
                    vorhanden
                  </button>
                  <button
                    type="button"
                    aria-label={`${def.label}: nicht vorhanden`}
                    aria-pressed={value === false}
                    disabled={locked}
                    onClick={() => onChange(itemId, false)}
                  >
                    nicht vorhanden
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {groups.counts.length ? (
        <div className="stack">
          <h3 className="subhead">Anzahl</h3>
          {groups.counts.map((itemId) => {
            const def = INVENTORY[itemId];
            if (!def) return null;
            const value = room.inventory[itemId];
            return (
              <div key={itemId} className="equip">
                <span className="equip__label">{def.label}</span>
                <CountStepper
                  label={def.label}
                  value={typeof value === 'number' ? value : null}
                  disabled={locked}
                  onChange={(n) => onChange(itemId, n)}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CountStepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (n: number | null) => void;
}) {
  return (
    // A fieldset would add the browser border and padding and change the Harbour stepper.
    // biome-ignore lint/a11y/useSemanticElements: role=group names the counter without fieldset chrome
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        disabled={disabled}
        aria-label={`${label} weniger`}
        onClick={() => onChange(stepCount(value, -1))}
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={`${label} Anzahl`}
        disabled={disabled}
        value={value === null ? '' : String(value)}
        placeholder="–"
        onChange={(e) => onChange(parseCount(e.currentTarget.value))}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`${label} mehr`}
        onClick={() => onChange(stepCount(value, 1))}
      >
        +
      </button>
    </div>
  );
}

export function RoomScreen({ id, roomId, checkId }: { id: string; roomId: string; checkId?: string }) {
  const { state, update } = useProtocol();
  const { settings } = useSettings();
  const custom = settings?.customPhrases ?? [];
  const [toast, showToast] = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetFocus, setSheetFocus] = useState<'photos' | 'description' | undefined>(undefined);
  const [nudgeId, setNudgeId] = useState<string | null>(null);
  const infoRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dismissSheet = useDismissHistory(openId !== null, () => setOpenId(null));

  useEffect(() => {
    if (!checkId || !CHECKS[checkId]) return;
    setOpenId(checkId);
  }, [checkId]);

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

  const issues = roomIssues(room);
  const firstIssue = issues[0];
  const idx = p.rooms.findIndex((r) => r.id === roomId);
  const nextRoom = p.rooms[idx + 1];
  const ready = issues.length === 0;

  const openSheet = (nextId: string, focus?: 'photos' | 'description') => {
    setSheetFocus(focus);
    setOpenId(nextId);
  };

  const nextOpenLabel = (currentId: string): string | null => {
    const start = template.checks.indexOf(currentId);
    if (start < 0) return null;
    for (const id of template.checks.slice(start + 1)) {
      if ((room.checks[id] ?? 'open') === 'open') return CHECKS[id]?.label ?? id;
    }
    return null;
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
    if (firstIssue.kind === 'missingInventory') {
      document.getElementById('ausstattung')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    openSheet(
      firstIssue.checkId,
      firstIssue.kind === 'missingPhotos'
        ? 'photos'
        : firstIssue.kind === 'missingDescription'
          ? 'description'
          : undefined,
    );
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
    ? `${issueLabel(firstIssue, room)}${issues.length > 1 ? ` · +${issues.length - 1} weitere` : ''}`
    : finishLabel;
  const headline = roomHeadline(room);
  const headlineTone =
    headline === 'Keine Mängel'
      ? 'badge badge--ok'
      : headline.includes('Mangel')
        ? 'badge badge--defect'
        : 'badge';

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
          <p>
            <span className={headlineTone}>{headline}</span>
          </p>
          <div className="meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress.done / Math.max(1, progress.total)})` }} />
          </div>
        </div>

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
                  className={[
                    'chip-row',
                    s === 'open' ? 'chip-row--open' : '',
                    missingAttributes(room, checkId).length ? 'chip-row--missing' : '',
                    nudgeId === checkId ? 'chip-row--nudge' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className="chip"
                    data-state={s}
                    disabled={locked}
                    onClick={() => {
                      const current = room.checks[checkId] ?? 'open';
                      if (current !== 'open') {
                        setRoom((r) => cycleCheck(r, checkId));
                        return;
                      }
                      tick();
                      const next = cycleCheck(room, checkId);
                      setRoom(() => next);
                      if (missingAttributes(next, checkId).length) openSheet(checkId);
                    }}
                    aria-label={
                      s === 'na'
                        ? `${label}: nicht vorhanden`
                        : `${label}: ${STATE_LABEL[s]}. Tippen zum Ändern.`
                    }
                  >
                    <span className="chip__mark">
                      {s === 'ok' ? (
                        <Icon name="check" size={14} />
                      ) : s === 'defect' ? (
                        <Icon name="alert" size={13} />
                      ) : s === 'na' ? (
                        '–'
                      ) : (
                        <Icon name={def?.icon ?? 'box'} size={16} />
                      )}
                    </span>
                    {label}
                    {s === 'na' ? <span>nicht vorh.</span> : null}
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
          <p className="hint">
            Tippen Sie einen Punkt an für In Ordnung. Mangel oder Nicht vorhanden über ⓘ.
          </p>
        </section>

        {defectIds.map((checkId) => {
          const def = CHECKS[checkId];
          const d = room.defects[checkId] ?? emptyDefect();
          const label = def?.label ?? checkId;
          const photosShort = d.photoIds.length < RULES.minPhotosPerDefect;
          return (
            <div key={checkId} className="card card--defect card--summary">
              <button type="button" className="card__open" onClick={() => openSheet(checkId, 'description')}>
                <span className="card__copy">
                  <b>Mangel: {label}</b>
                  <span className="one-line">{d.description.trim() || 'Noch ohne Beschreibung'}</span>
                  <span className={photosShort ? 'badge badge--defect' : 'badge badge--ok'}>
                    {d.photoIds.length}/{RULES.minPhotosPerDefect} Fotos
                  </span>
                </span>
                {d.photoIds.length ? (
                  <span className="card-thumbs">
                    {d.photoIds.slice(0, 2).map((photoId) => (
                      <MiniPhoto key={photoId} id={photoId} />
                    ))}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="btn"
                disabled={locked}
                onClick={() => openSheet(checkId, 'photos')}
              >
                <Icon name="camera" size={18} /> {photoCountLabel(d.photoIds.length)}
              </button>
              {locked ? null : (
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => {
                    setRoom((r) => setCheck(r, checkId, 'open'));
                    showToast('Gelöscht', {
                      ms: 5000,
                      actionLabel: 'Rückgängig',
                      onAction: () => setRoom((r) => setCheck(r, checkId, 'defect')),
                    });
                  }}
                >
                  Mangel zurücksetzen
                </button>
              )}
            </div>
          );
        })}

        <section aria-labelledby="h-notes">
          <h2 id="h-notes" className="section-title">
            Schnellauswahl
          </h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            Tippen Sie einen Begriff an. Er kommt in die Notizen. Den Text können Sie ändern.
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
          <section id="ausstattung" aria-labelledby="h-inv">
            <h2 id="h-inv" className="section-title">
              Ausstattung
            </h2>
            <InventoryGroups
              ids={template.inventory}
              room={room}
              locked={locked}
              onChange={(itemId, value) =>
                setRoom((r) => ({ ...r, inventory: { ...r.inventory, [itemId]: value } }))
              }
            />
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
          nextLabel={nextOpenLabel(openId)}
          onNext={() => {
            const start = template.checks.indexOf(openId);
            const next = template.checks
              .slice(start + 1)
              .find((cid) => (room.checks[cid] ?? 'open') === 'open');
            if (!next) return;
            setSheetFocus(undefined);
            setOpenId(next);
          }}
          onClose={() => {
            const current = openId;
            dismissSheet();
            if (current) infoRefs.current[current]?.focus();
          }}
        />
      ) : null}
      {toast}
    </>
  );
}
