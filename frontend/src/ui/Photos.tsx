import { useEffect, useRef, useState } from 'react';
import { photoUrl, removePhoto, storePhoto } from '@/storage/photos';
import { Icon } from './Icon';
import { useToast } from './kit';

function Thumb({ id, onRemove, disabled }: { id: string; onRemove: () => void; disabled?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void photoUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <div className="thumb">
      {url ? <img src={url} alt="Foto des Mangels" /> : null}
      {disabled ? null : (
        <button type="button" onClick={onRemove} aria-label="Foto löschen">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * Foto-Leiste. `pills`: Kamera und Galerie als große Knöpfe.
 * `tile`: eine Kachel, wie bei den Zählern.
 * Fotos werden sofort verkleinert und lokal gespeichert; das Protokoll speichert nur IDs.
 */
export function PhotoStrip({
  protocolId,
  ids,
  onChange,
  onError,
  disabled,
  variant = 'tile',
}: {
  protocolId: string;
  ids: string[];
  onChange: (ids: string[]) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
  variant?: 'tile' | 'pills';
}) {
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  const pendingDelete = useRef<{ id: string; previous: string[]; timer: number } | null>(null);

  useEffect(() => {
    return () => {
      const pending = pendingDelete.current;
      if (!pending) return;
      window.clearTimeout(pending.timer);
      void removePhoto(pending.id);
    };
  }, []);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) added.push(await storePhoto(f, protocolId));
      onChange([...ids, ...added]);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Foto konnte nicht gespeichert werden');
    } finally {
      setBusy(false);
    }
  };
  const onFiles = (list: FileList | null) => {
    void add(list);
  };
  const thumbs = ids.map((id) => (
    <Thumb
      key={id}
      id={id}
      disabled={disabled}
      onRemove={() => {
        const previous = pendingDelete.current;
        if (previous) {
          window.clearTimeout(previous.timer);
          void removePhoto(previous.id);
        }
        const snapshot = ids;
        onChange(ids.filter((x) => x !== id));
        const timer = window.setTimeout(() => {
          pendingDelete.current = null;
          void removePhoto(id);
        }, 5000);
        pendingDelete.current = { id, previous: snapshot, timer };
        showToast('Gelöscht', {
          ms: 5000,
          actionLabel: 'Rückgängig',
          onAction: () => {
            const current = pendingDelete.current;
            if (!current || current.id !== id) return;
            window.clearTimeout(current.timer);
            pendingDelete.current = null;
            onChange(current.previous);
          },
        });
      }}
    />
  ));
  if (variant === 'pills') {
    return (
      <div className="stack">
        {disabled ? null : (
          <div className="stack">
            <label className="btn btn--primary btn--block btn--file">
              <Icon name="camera" size={20} /> {busy ? '…' : 'Foto aufnehmen'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  onFiles(e.currentTarget.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <label className="btn btn--block btn--file">
              Aus Galerie
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  onFiles(e.currentTarget.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        )}
        {ids.length ? <div className="thumbs">{thumbs}</div> : null}
        {toast}
      </div>
    );
  }
  return (
    <>
      <div className="thumbs">
        {thumbs}
        {disabled ? null : (
          <label className="thumb thumb--add" aria-label="Foto aufnehmen">
            {busy ? '…' : <Icon name="camera" size={26} />}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => {
                onFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
          </label>
        )}
      </div>
      {toast}
    </>
  );
}
