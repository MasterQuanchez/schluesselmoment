import { useEffect, useState } from 'react';
import { PROTOCOL_TYPE_LABEL, RULES } from '@/domain/catalog';
import { applyFeatures, protocolIssues } from '@/domain/protocol';
import type { Features, Party, Protocol } from '@/domain/schema';
import { href } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { Icon } from '@/ui/Icon';
import { Field, Loading, StepNav, Stepper, Switch, TopBar } from '@/ui/kit';

function PartyFields({
  value,
  onChange,
  prefix,
  disabled,
  idPrefix,
  errorFor,
  onBlur,
  tenant,
  showNewAddress,
  contactRequired,
}: {
  value: Party;
  onChange: (p: Party) => void;
  prefix: string;
  disabled: boolean;
  idPrefix: string;
  errorFor: (fieldId: string) => string | undefined;
  onBlur: (fieldId: string) => () => void;
  tenant: boolean;
  showNewAddress: boolean;
  contactRequired: boolean;
}) {
  const set = (k: keyof Party) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.currentTarget.value });
  const nameId = `${idPrefix}-name`;
  const phoneId = `${idPrefix}-phone`;
  const emailId = `${idPrefix}-email`;
  const skipEmail = tenant && value.noEmail;
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }} disabled={disabled}>
      <Field label={`${prefix}: Name`} required id={nameId} error={errorFor(nameId)}>
        <input
          className="input"
          autoComplete="name"
          enterKeyHint="next"
          value={value.name}
          onChange={set('name')}
          onBlur={onBlur(nameId)}
        />
      </Field>
      <div className="grid-2">
        <Field label="Telefon" required={contactRequired} id={phoneId} error={errorFor(phoneId)}>
          <input
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            value={value.phone}
            onChange={set('phone')}
            onBlur={onBlur(phoneId)}
          />
        </Field>
        <Field
          label="E-Mail"
          required={contactRequired && !skipEmail}
          id={emailId}
          error={skipEmail ? undefined : errorFor(emailId)}
        >
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            value={value.email}
            disabled={skipEmail}
            onChange={set('email')}
            onBlur={onBlur(emailId)}
          />
        </Field>
      </div>
      {tenant ? (
        <label className="check-row">
          <input
            type="checkbox"
            checked={value.noEmail}
            onChange={(e) => onChange({ ...value, noEmail: e.currentTarget.checked })}
          />
          <span>Keine E-Mail-Adresse</span>
        </label>
      ) : null}
      {showNewAddress ? (
        <Field label="Neue Adresse (nach Auszug)">
          <input
            className="input"
            autoComplete="street-address"
            enterKeyHint="next"
            value={value.newAddress}
            onChange={set('newAddress')}
          />
        </Field>
      ) : null}
    </fieldset>
  );
}

export function BasisScreen({ id, focus }: { id: string; focus?: string }) {
  const { state, update } = useProtocol();
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!focus) return;
    setReveal(true);
    setTouched((prev) => ({ ...prev, [focus]: true }));
    const el = document.getElementById(focus);
    el?.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, [focus]);
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
  const contactRequired = RULES.requireContactFields;
  const messages = new Map(
    protocolIssues(p)
      .filter((issue) => issue.fieldId && !issue.fieldId.startsWith('field-meter-'))
      .map((issue) => [issue.fieldId as string, issue.message]),
  );
  const errorFor = (fieldId: string) => (reveal || touched[fieldId] ? messages.get(fieldId) : undefined);
  const mark = (fieldId: string) => () => setTouched((prev) => ({ ...prev, [fieldId]: true }));

  return (
    <>
      <TopBar title={PROTOCOL_TYPE_LABEL[p.type]} back={{ name: 'home' }}>
        <StepNav protocol={p} current="basis" />
      </TopBar>
      <main className="page stack">
        <h1 className="page-title">Basisdaten</h1>

        <h2 className="section-title">Objekt</h2>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }} disabled={locked}>
          <Field label="Straße und Nr." required id="field-street" error={errorFor('field-street')}>
            <input
              className="input"
              autoComplete="street-address"
              enterKeyHint="next"
              value={p.property.street}
              onChange={prop('street')}
              onBlur={mark('field-street')}
            />
          </Field>
          <div className="grid-2">
            <Field label="PLZ" required id="field-postalCode" error={errorFor('field-postalCode')}>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="postal-code"
                enterKeyHint="next"
                value={p.property.postalCode}
                onChange={prop('postalCode')}
                onBlur={mark('field-postalCode')}
              />
            </Field>
            <Field label="Ort" required id="field-city" error={errorFor('field-city')}>
              <input
                className="input"
                autoComplete="address-level2"
                enterKeyHint="next"
                value={p.property.city}
                onChange={prop('city')}
                onBlur={mark('field-city')}
              />
            </Field>
          </div>
          <div className="grid-2">
            <Field
              label="Lage (z. B. 2. OG links)"
              required={contactRequired}
              id="field-unit"
              error={errorFor('field-unit')}
            >
              <input
                className="input"
                autoComplete="off"
                enterKeyHint="next"
                value={p.property.unit}
                onChange={prop('unit')}
                onBlur={mark('field-unit')}
              />
            </Field>
            <Field
              label="Objekt-Nr."
              required={contactRequired}
              id="field-objectNumber"
              error={errorFor('field-objectNumber')}
            >
              <input
                className="input"
                autoComplete="off"
                enterKeyHint="next"
                value={p.property.objectNumber}
                onChange={prop('objectNumber')}
                onBlur={mark('field-objectNumber')}
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
          <div className="equip">
            <span className="equip__label">Zimmer</span>
            <Stepper
              label="Zimmer"
              value={f.roomCount}
              min={0}
              max={20}
              onChange={(n) => feat('roomCount', n)}
            />
          </div>
          <div className="equip">
            <span className="equip__label">Bäder</span>
            <Stepper
              label="Bäder"
              value={f.bathroomCount}
              min={1}
              max={5}
              onChange={(n) => feat('bathroomCount', n)}
            />
          </div>
          <div className="equip">
            <span className="equip__label">Küche</span>
            <div className="segment segment--3">
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
          idPrefix="field-landlord"
          errorFor={errorFor}
          onBlur={mark}
          tenant={false}
          showNewAddress={false}
          contactRequired={contactRequired}
          onChange={(landlord) => update((x) => ({ ...x, landlord }))}
        />
        {p.tenants.map((t, i) => (
          <PartyFields
            // biome-ignore lint/suspicious/noArrayIndexKey: Reihenfolge der Mieter ist stabil
            key={i}
            prefix={p.tenants.length > 1 ? `Mieter ${i + 1}` : 'Mieter'}
            value={t}
            disabled={locked}
            idPrefix={`field-tenant-${i}`}
            errorFor={errorFor}
            onBlur={mark}
            tenant
            showNewAddress={p.type === 'abnahme'}
            contactRequired={contactRequired}
            onChange={(tenant) =>
              update((x) => ({ ...x, tenants: x.tenants.map((y, j) => (j === i ? tenant : y)) }))
            }
          />
        ))}
        {locked ? null : (
          <div className="stack">
            <button
              type="button"
              className="btn btn--text"
              onClick={() =>
                update((x) => ({
                  ...x,
                  tenants: [...x.tenants, { name: '', phone: '', email: '', noEmail: false, newAddress: '' }],
                }))
              }
            >
              <Icon name="plus" size={18} /> Weitere Mieter
            </button>
            {p.tenants.length > 1 ? (
              <button
                type="button"
                className="btn btn--text btn--danger"
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
          <a
            className="btn btn--primary btn--block"
            href={href({ name: 'rooms', id })}
            onClick={(e) => {
              if (messages.size === 0 || reveal) return;
              e.preventDefault();
              setReveal(true);
              const first = messages.keys().next().value;
              if (!first) return;
              const el = document.getElementById(first);
              el?.scrollIntoView({ block: 'center' });
              el?.querySelector<HTMLElement>('input, textarea')?.focus();
            }}
          >
            Weiter zu den Räumen
          </a>
        </div>
      </div>
    </>
  );
}
