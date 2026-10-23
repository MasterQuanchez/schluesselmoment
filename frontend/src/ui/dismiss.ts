import { useEffect, useRef } from 'react';

/**
 * Offenes Sheet oder Dialog legt einen History-Eintrag. Android-Zurück und
 * iOS-Wischen schließen zuerst die Fläche, die Route und die Daten bleiben.
 */
export function useDismissHistory(open: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushed = useRef(false);

  useEffect(() => {
    if (!open) return;
    history.pushState({ smDismiss: true }, '');
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  return () => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    }
    onCloseRef.current();
  };
}
