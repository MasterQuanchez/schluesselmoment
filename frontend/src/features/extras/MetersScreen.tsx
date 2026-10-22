import { KEY_LABEL, METER_LABEL } from '@/domain/catalog';
import { newId } from '@/domain/protocol';
import type { KeyItem, Meter } from '@/domain/schema';
import { href } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { Icon } from '@/ui/Icon';
import { Field, Loading, StepNav, Stepper, TopBar, useToast } from '@/ui/kit';
import { PhotoStrip } from '@/ui/Photos';

export function MetersScreen({ id }: { id: string }) {
  const { state, update } = useProtocol();
  const [toast, showToast] = useToast();
  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const locked = p.status !== 'draft';
  const setMeter = (mid: string, patch: Partial<Meter>) =>
    update((x) => ({ ...x, meters: x.meters.map((m) => (m.id === mid ? { ...m, ...patch } : m)) }));
  const setKey = (kid: string, patch: Partial<KeyItem>) =>
    update((x) => ({ ...x, keys: x.keys.map((k) => (k.id === kid ? { ...k, ...patch } : k)) }));

  return (
    <>
      <TopBar title="Zähler & Schlüssel" back={{ name: 'rooms', id }}>
        <StepNav protocol={p} current="meters" />
      </TopBar>
      <main className="page stack">
        <h1 className="page-title">Zählerstände</h1>
        <p className="page-sub">Gemeinsam mit dem Mieter ablesen. Foto vom Zähler als Beleg.</p>
        {p.meters.map((m) => (
          <fieldset key={m.id} className="card stack" disabled={locked}>
            <div className="row">
              <Icon name="gauge" />
              <b className="grow">
                {METER_LABEL[m.kind].label} ({METER_LABEL[m.kind].unit})
              </b>
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
              <Field label="Zähler-Nr.">
                <input
                  className="input"
                  autoComplete="off"
                  value={m.number}
                  onChange={(e) => setMeter(m.id, { number: e.currentTarget.value })}
                />
              </Field>
              <Field label="Stand">
                <input
                  className="input"
                  inputMode="decimal"
                  autoComplete="off"
                  value={m.reading}
                  onChange={(e) => setMeter(m.id, { reading: e.currentTarget.value.replace(/[^\d.,]/g, '') })}
                />
              </Field>
            </div>
            <Field label="Ort">
              <input
                className="input"
                autoComplete="off"
                value={m.location}
                onChange={(e) => setMeter(m.id, { location: e.currentTarget.value })}
              />
            </Field>
            <PhotoStrip
              protocolId={id}
              ids={m.photoIds}
              disabled={locked}
              onError={showToast}
              onChange={(photoIds) => setMeter(m.id, { photoIds })}
            />
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
          <a className="btn btn--primary btn--block" href={href({ name: 'finish', id })}>
            Weiter zum Abschluss
          </a>
        </div>
      </div>
      {toast}
    </>
  );
}
