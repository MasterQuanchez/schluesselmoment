import { useEffect, useState } from 'react';
import { KEY_LABEL, METER_LABEL } from '@/domain/catalog';
import { newId, protocolIssues } from '@/domain/protocol';
import type { KeyItem, Meter } from '@/domain/schema';
import { href } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { Icon } from '@/ui/Icon';
import { Field, Loading, StepNav, Stepper, TopBar, useToast } from '@/ui/kit';
import { PhotoStrip } from '@/ui/Photos';

export function MetersScreen({ id, focus }: { id: string; focus?: string }) {
  const { state, update } = useProtocol();
  const [toast, showToast] = useToast();
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!focus) return;
    setReveal(true);
    setTouched((prev) => ({ ...prev, [focus]: true }));
    const el = document.getElementById(focus);
    el?.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLElement>('input, textarea, button')?.focus();
  }, [focus]);
  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const locked = p.status !== 'draft';
  const setMeter = (mid: string, patch: Partial<Meter>) =>
    update((x) => ({ ...x, meters: x.meters.map((m) => (m.id === mid ? { ...m, ...patch } : m)) }));
  const setKey = (kid: string, patch: Partial<KeyItem>) =>
    update((x) => ({ ...x, keys: x.keys.map((k) => (k.id === kid ? { ...k, ...patch } : k)) }));
  const messages = new Map(
    protocolIssues(p)
      .filter((issue) => issue.fieldId?.startsWith('field-meter-'))
      .map((issue) => [issue.fieldId as string, issue.message]),
  );
  const errorFor = (fieldId: string) => (reveal || touched[fieldId] ? messages.get(fieldId) : undefined);
  const mark = (fieldId: string) => () => setTouched((prev) => ({ ...prev, [fieldId]: true }));

  return (
    <>
      <TopBar title="Zähler & Schlüssel" back={{ name: 'rooms', id }}>
        <StepNav protocol={p} current="meters" />
      </TopBar>
      <main className="page stack">
        <h1 className="page-title">Zählerstände</h1>
        <p className="page-sub">Lesen Sie den Stand gemeinsam mit dem Mieter ab. Ein Foto dient als Beleg.</p>
        {p.meters.map((m) => (
          <fieldset key={m.id} className="card stack" disabled={locked}>
            <div className="row">
              <Icon name="gauge" />
              <b className="grow">{METER_LABEL[m.kind].label}</b>
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                aria-label="Zähler entfernen"
                onClick={() => update((x) => ({ ...x, meters: x.meters.filter((y) => y.id !== m.id) }))}
              >
                <Icon name="trash" />
              </button>
            </div>
            <div className="grid-2">
              <Field label="Zähler-Nr." hint="empfohlen" id={`field-meter-${m.id}-number`}>
                <input
                  className="input"
                  autoComplete="off"
                  enterKeyHint="next"
                  value={m.number}
                  onChange={(e) => setMeter(m.id, { number: e.currentTarget.value })}
                />
              </Field>
              <Field
                label="Stand"
                required
                id={`field-meter-${m.id}-reading`}
                error={errorFor(`field-meter-${m.id}-reading`)}
              >
                <span className="input-affix">
                  <input
                    className="input"
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="next"
                    value={m.reading}
                    onBlur={mark(`field-meter-${m.id}-reading`)}
                    onChange={(e) =>
                      setMeter(m.id, { reading: e.currentTarget.value.replace(/[^\d.,]/g, '') })
                    }
                  />
                  <span className="input-affix__suffix" aria-hidden="true">
                    {METER_LABEL[m.kind].unit}
                  </span>
                </span>
              </Field>
            </div>
            <Field label="Ort" hint="empfohlen" id={`field-meter-${m.id}-location`}>
              <input
                className="input"
                autoComplete="off"
                enterKeyHint="next"
                value={m.location}
                onChange={(e) => setMeter(m.id, { location: e.currentTarget.value })}
              />
            </Field>
            <div id={`field-meter-${m.id}-photos`}>
              <p className="hint">Foto empfohlen</p>
              <PhotoStrip
                protocolId={id}
                ids={m.photoIds}
                disabled={locked}
                onError={showToast}
                onChange={(photoIds) => setMeter(m.id, { photoIds })}
              />
            </div>
          </fieldset>
        ))}
        {locked ? null : (
          <div className="chips">
            {(Object.keys(METER_LABEL) as Meter['kind'][]).map((kind) => (
              <button
                key={kind}
                type="button"
                className="chip chip--phrase"
                onClick={() =>
                  update((x) => ({
                    ...x,
                    meters: [
                      ...x.meters,
                      { id: newId(), kind, number: '', reading: '', location: '', photoIds: [] },
                    ],
                  }))
                }
              >
                + {METER_LABEL[kind].label}
              </button>
            ))}
          </div>
        )}

        <h2 className="section-title">Schlüssel</h2>
        <div className="card stack">
          {p.keys.map((k) => (
            <div key={k.id} className="switch-row">
              <div className="grow">
                <div>{k.kind === 'other' ? k.label || 'Sonstiger' : KEY_LABEL[k.kind]}</div>
                {k.kind === 'other' ? (
                  <input
                    className="input"
                    placeholder="Bezeichnung"
                    disabled={locked}
                    value={k.label}
                    onChange={(e) => setKey(k.id, { label: e.currentTarget.value })}
                  />
                ) : null}
              </div>
              <Stepper
                label={KEY_LABEL[k.kind]}
                value={k.count}
                onChange={(count) => !locked && setKey(k.id, { count })}
              />
            </div>
          ))}
          {locked ? null : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                update((x) => ({
                  ...x,
                  keys: [...x.keys, { id: newId(), kind: 'other', label: '', count: 1 }],
                }))
              }
            >
              + Weiterer Schlüssel
            </button>
          )}
        </div>
      </main>
      <div className="bottombar">
        <div className="bottombar__inner">
          <a
            className="btn btn--primary btn--block"
            href={href({ name: 'finish', id })}
            onClick={(e) => {
              if (messages.size === 0 || reveal) return;
              e.preventDefault();
              setReveal(true);
              const first = messages.keys().next().value;
              if (!first) return;
              document.getElementById(first)?.scrollIntoView({ block: 'center' });
            }}
          >
            Weiter zum Abschluss
          </a>
        </div>
      </div>
      {toast}
    </>
  );
}
