import { type ReactNode, useEffect, useState } from 'react';
import type { Protocol } from '@/domain/schema';
import { href, type Route } from '@/router';
import { Icon } from './Icon';

export function TopBar({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: Route;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {back ? (
          <a className="topbar__back" href={href(back)} aria-label="Zurück">
            <Icon name="back" size={22} /> Zurück
          </a>
        ) : null}
        <span className="topbar__title grow">{title}</span>
        {action}
      </div>
      {children}
    </header>
  );
}

const STEPS = [
  { key: 'basis', label: 'Basis' },
  { key: 'rooms', label: 'Räume' },
  { key: 'meters', label: 'Zähler/Schlüssel' },
  { key: 'finish', label: 'Abschluss' },
] as const;

export function StepNav({
  protocol,
  current,
}: {
  protocol: Protocol;
  current: (typeof STEPS)[number]['key'];
}) {
  const roomsDone = protocol.rooms.every((r) => r.completedAt);
  const done: Record<string, boolean> = {
    basis: Boolean(protocol.property.street && protocol.landlord.name && protocol.tenants[0]?.name),
    rooms: roomsDone,
    meters: protocol.meters.some((m) => m.reading) || protocol.keys.some((k) => k.count > 0),
    finish: protocol.status === 'signed',
  };
  return (
    <nav className="steps" aria-label="Schritte">
      {STEPS.map((s) => (
        <a
          key={s.key}
          href={href({ name: s.key, id: protocol.id } as Route)}
          aria-current={s.key === current ? 'page' : undefined}
          data-done={done[s.key] ? 'true' : 'false'}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // The input is passed as children and rendered inside the label. Biome cannot see through children.
    // biome-ignore lint/a11y/noLabelWithoutControl: control is the child of this label
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    // A fieldset would add the browser border and padding and change the Harbour stepper.
    // biome-ignore lint/a11y/useSemanticElements: role=group names the counter without fieldset chrome
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`${label} weniger`}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`${label} mehr`}>
        +
      </button>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <div className="switch-row">
      <span>{label}</span>
      <div className="row">
        <button
          type="button"
          className="chip chip--option"
          aria-pressed={checked}
          onClick={() => onChange(true)}
        >
          Ja
        </button>
        <button
          type="button"
          className="chip chip--option"
          aria-pressed={!checked}
          onClick={() => onChange(false)}
        >
          Nein
        </button>
      </div>
    </div>
  );
}

/** Kurzer Hinweis unten (z. B. „Gespeichert“, Fehlermeldung). */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return [
    msg ? (
      <div key="toast" className="toast" role="status">
        {msg}
      </div>
    ) : null,
    setMsg,
  ];
}

export function Loading({ state }: { state: { status: string; message?: string } }) {
  if (state.status === 'missing')
    return (
      <div className="empty">
        Protokoll nicht gefunden. <a href="#/">Zur Übersicht</a>
      </div>
    );
  if (state.status === 'error') return <div className="empty">Fehler: {state.message}</div>;
  return <div className="empty">Lädt …</div>;
}
