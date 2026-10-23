import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Unterschriftsfeld mit Pointer Events (Finger, Stift, Maus).
 * Glättung über Mittelpunkte (quadratische Kurven), scharf auf High-DPI-Displays.
 */
export function SignaturePad({
  onSave,
  onCancel,
  name,
}: {
  onSave: (png: string) => void;
  onCancel: () => void;
  name: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useRef<Array<{ x: number; y: number }>>([]);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    setEmpty(true);
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    pts.current = [p];
    const ctx = e.currentTarget.getContext('2d');
    ctx?.beginPath();
    ctx?.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx?.fill();
    setEmpty(false);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const events =
      'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      const arr = pts.current;
      arr.push(p);
      if (arr.length < 3) continue;
      const [a, b, c] = arr.slice(-3) as [typeof p, typeof p, typeof p];
      const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y);
      ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
      ctx.stroke();
    }
  };

  const up = () => {
    drawing.current = false;
    pts.current = [];
  };

  return (
    <div className="card stack">
      <b>Unterschrift: {name}</b>
      <p className="hint">
        Mit Ihrer Unterschrift bestätigen Sie dieses Protokoll einschließlich Zählerständen und
        Schlüsselübergabe.
      </p>
      <div className="sigpad-wrap">
        <canvas
          ref={ref}
          className="sigpad"
          aria-label={`Unterschriftsfeld für ${name}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <span className="sigpad__cross" aria-hidden="true">
          ×
        </span>
        <span className="sigpad__line" aria-hidden="true" />
        {empty ? <p className="sigpad__hint">Hier mit dem Finger unterschreiben</p> : null}
      </div>
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={empty}
        onClick={() => ref.current && onSave(ref.current.toDataURL('image/png'))}
      >
        Übernehmen
      </button>
      <div className="sigpad__actions">
        <button type="button" className="btn btn--text" onClick={setup}>
          Löschen
        </button>
        <button type="button" className="btn btn--text" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
