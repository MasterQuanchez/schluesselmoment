import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Protocol } from '@/domain/schema';
import { getProtocol, saveProtocol } from './db';

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; protocol: Protocol };

const SAVE_DELAY_MS = 250;

/**
 * Lädt ein Protokoll und speichert Änderungen automatisch (entprellt).
 * `update` nimmt eine reine Funktion (siehe domain/protocol.ts) – keine Mutation.
 * Ab Status „signing“ ist der Inhalt gesperrt (nur mit allowLocked änderbar).
 */
function useProtocolState(id: string) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const pending = useRef<Protocol | null>(null);
  /** Aktueller Stand synchron (mehrere update-Aufrufe hintereinander bauen aufeinander auf). */
  const current = useRef<Protocol | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<'ok' | 'bad' | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    try {
      await saveProtocol(p);
      setSaveError(null);
      setSaveNote('ok');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveNote(null), 1500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      setSaveNote('bad');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    getProtocol(id)
      .then((p) => {
        if (!alive) return;
        current.current = p;
        setState(p ? { status: 'ready', protocol: p } : { status: 'missing' });
      })
      .catch((e: unknown) => alive && setState({ status: 'error', message: String(e) }));
    return () => {
      alive = false;
    };
  }, [id]);

  // Beim Verlassen / App in den Hintergrund: sofort speichern (Android killt Tabs gern)
  useEffect(() => {
    const onHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  const update = useCallback(
    (recipe: (p: Protocol) => Protocol, opts: { allowLocked?: boolean } = {}) => {
      const cur = current.current;
      if (!cur) return;
      if (cur.status !== 'draft' && !opts.allowLocked) return;
      const next = { ...recipe(cur), updatedAt: new Date().toISOString() };
      current.current = next;
      pending.current = next;
      setState({ status: 'ready', protocol: next });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  return { state, update, flush, saveError, saveNote };
}

type Ctx = ReturnType<typeof useProtocolState>;
const ProtocolContext = createContext<Ctx | null>(null);

/**
 * Eine Instanz pro geöffnetem Protokoll (in App.tsx), damit alle Screens denselben Stand teilen
 * und beim Wechsel zwischen Screens nichts aus IndexedDB „veraltet“ nachgeladen wird.
 */
export function ProtocolProvider({ id, children }: { id: string; children: ReactNode }) {
  const value = useProtocolState(id);
  return createElement(ProtocolContext.Provider, { value }, children);
}

export function useProtocol(): Ctx {
  const ctx = useContext(ProtocolContext);
  if (!ctx) throw new Error('useProtocol() nur innerhalb von <ProtocolProvider>');
  return ctx;
}

/** Kopfzeile auf Start und Einstellungen hat keinen Protokoll-Kontext. */
export function useSaveNote(): 'ok' | 'bad' | null {
  return useContext(ProtocolContext)?.saveNote ?? null;
}
