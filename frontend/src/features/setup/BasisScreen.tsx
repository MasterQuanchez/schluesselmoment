import { PROTOCOL_TYPE_LABEL } from '@/domain/catalog';
import { applyFeatures } from '@/domain/protocol';
import type { Features, Party, Protocol } from '@/domain/schema';
import { href } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { Field, Loading, StepNav, Stepper, Switch, TopBar } from '@/ui/kit';

function PartyFields({
  value,
  onChange,
  prefix,
  disabled,
}: {
  value: Party;
  onChange: (p: Party) => void;
  prefix: string;
  disabled: boolean;
}) {
  const set = (k: keyof Party) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.currentTarget.value });
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }} disabled={disabled}>
      <Field label={`${prefix}: Name`}>
        <input className="input" autoComplete="off" value={value.name} onChange={set('name')} />
      </Field>
      <div className="grid-2">
        <Field label="Telefon">
          <input
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={value.phone}
            onChange={set('phone')}
          />
        </Field>
        <Field label="E-Mail">
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={value.email}
            onChange={set('email')}
          />
        </Field>
      </div>
    </fieldset>
  );
}

export function BasisScreen({ id }: { id: string }) {
  const { state, update } = useProtocol();
  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const locked = p.status !== 'draft';
  const prop = (k: keyof Protocol['property']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value;
    update((x) => ({ ...x, property: { ...x.property, [k]: v } }));
  };
  const feat = <K extends keyof Features>(k: K, v: Features[K]) =>
    update((x) => applyFeatures(x, { ...x.features, [k]: v }));
  const f = p.features;

  return (
    <>
      <TopBar title={PROTOCOL_TYPE_LABEL[p.type]} back={{ name: 'home' }}>
        <StepNav protocol={p} current="basis" />
      </TopBar>
      <main className="page stack">
        <h1 className="page-title">Basisdaten</h1>

        <h2 className="section-title">Objekt</h2>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }} disabled={locked}>
          <Field label="Straße und Nr.">
            <input className="input" autoComplete="off" value={p.property.street} onChange={prop('street')} />
          </Field>
          <div className="grid-2">
            <Field label="PLZ">
              <input
                className="input"
                inputMode="numeric"
                autoComplete="off"
                value={p.property.postalCode}
                onChange={prop('postalCode')}
              />
            </Field>
            <Field label="Ort">
              <input className="input" autoComplete="off" value={p.property.city} onChange={prop('city')} />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Lage (z. B. 2. OG links)">
              <input className="input" autoComplete="off" value={p.property.unit} onChange={prop('unit')} />
            </Field>
            <Field label="Objekt-Nr.">
              <input
                className="input"
                autoComplete="off"
                value={p.property.objectNumber}
                onChange={prop('objectNumber')}
              />
            </Field>
          </div>
          <Field label="Erstellt von">
            <input
              className="input"
              autoComplete="off"
              value={p.inspector}
              readOnly={p.inspector === 'Demo'}
              onChange={(e) => {
                const v = e.currentTarget.value;
                update((x) => ({ ...x, inspector: v }));
              }}
            />
          </Field>
          {p.inspector === 'Demo' ? <p className="hint">Demo-Protokoll</p> : null}
          <Field label="Übergabe am">
            <input
              className="input"
              type="date"
              required
              value={p.handoverOn}
              onChange={(e) => {
                const handoverOn = e.currentTarget.value;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(handoverOn)) return;
                update((x) => ({ ...x, handoverOn }));
              }}
            />
          </Field>
          {p.type === 'uebergabe' ? (
            <Field label="Einzug am">
              <input
                className="input"
                type="date"
                value={p.moveInOn}
                onChange={(e) => {
                  const moveInOn = e.currentTarget.value;
                  update((x) => ({ ...x, moveInOn }));
                }}
              />
            </Field>
          ) : null}
          {p.type === 'abnahme' ? (
            <Field label="Auszug zum">
              <input
                className="input"
                type="date"
                value={p.moveOutOn}
                onChange={(e) => {
                  const moveOutOn = e.currentTarget.value;
                  update((x) => ({ ...x, moveOutOn }));
                }}
              />
            </Field>
          ) : null}
        </fieldset>

        <h2 className="section-title">Ausstattung</h2>
        <p className="hint">Daraus entsteht die Raumliste. Bereits erfasste Räume bleiben erhalten.</p>
        <fieldset className="card stack" disabled={locked}>
          <div className="switch-row">
            <span>Zimmer</span>
            <Stepper
              label="Zimmer"
              value={f.roomCount}
              min={0}
              max={20}
              onChange={(n) => feat('roomCount', n)}
            />
          </div>
          <div className="switch-row">
            <span>Bäder</span>
            <Stepper
              label="Bäder"
              value={f.bathroomCount}
              min={1}
              max={5}
              onChange={(n) => feat('bathroomCount', n)}
            />
          </div>
          <div className="switch-row">
            <span>Küche</span>
            <div className="row">
              {(
                [
                  ['none', 'Keine'],
                  ['basic', 'Normal'],
                  ['fitted', 'Einbau'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className="chip chip--option"
                  aria-pressed={f.kitchen === v}
                  onClick={() => feat('kitchen', v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Switch label="Gäste-WC" checked={f.guestWc} onChange={(b) => feat('guestWc', b)} />
          <Switch label="Keller" checked={f.basement} onChange={(b) => feat('basement', b)} />
          <Switch
            label="Elektro unter Putz"
            checked={f.elektroUnterPutz}
            onChange={(b) => feat('elektroUnterPutz', b)}
          />
          <div className="stack">
            <span>Außenbereich</span>
            <div className="chips">
              {(
                [
                  ['none', 'Keiner'],
                  ['balcony', 'Balkon'],
                  ['terrace', 'Terrasse'],
                  ['loggia', 'Loggia'],
                  ['wintergarden', 'Wintergarten'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className="chip chip--option"
                  aria-pressed={f.outdoor === v}
                  onClick={() => feat('outdoor', v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <h2 className="section-title">Beteiligte</h2>
        <PartyFields
          prefix="Vermieter/Verwalter"
          value={p.landlord}
          disabled={locked}
          onChange={(landlord) => update((x) => ({ ...x, landlord }))}
        />
        {p.tenants.map((t, i) => (
          <PartyFields
            // biome-ignore lint/suspicious/noArrayIndexKey: Reihenfolge der Mieter ist stabil
            key={i}
            prefix={p.tenants.length > 1 ? `Mieter ${i + 1}` : 'Mieter'}
            value={t}
            disabled={locked}
            onChange={(tenant) =>
              update((x) => ({ ...x, tenants: x.tenants.map((y, j) => (j === i ? tenant : y)) }))
            }
          />
        ))}
        {locked ? null : (
          <div className="row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                update((x) => ({
                  ...x,
                  tenants: [...x.tenants, { name: '', phone: '', email: '', newAddress: '' }],
                }))
              }
            >
              + Weitere Mieter
            </button>
            {p.tenants.length > 1 ? (
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => update((x) => ({ ...x, tenants: x.tenants.slice(0, -1) }))}
              >
                Letzten entfernen
              </button>
            ) : null}
          </div>
        )}
      </main>
      <div className="bottombar">
        <div className="bottombar__inner">
          <a className="btn btn--primary btn--block" href={href({ name: 'rooms', id })}>
            Weiter zu den Räumen
          </a>
        </div>
      </div>
    </>
  );
}
