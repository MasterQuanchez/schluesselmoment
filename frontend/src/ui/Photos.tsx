import { useEffect, useState } from 'react';
import { photoUrl, removePhoto, storePhoto } from '@/storage/photos';
import { Icon } from './Icon';

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
 * Foto-Leiste: Kamera direkt öffnen (capture), mehrere Bilder möglich.
 * Fotos werden sofort verkleinert und lokal gespeichert; das Protokoll speichert nur IDs.
 */
export function PhotoStrip({
  protocolId,
  ids,
  onChange,
  onError,
  disabled,
}: {
  protocolId: string;
  ids: string[];
  onChange: (ids: string[]) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
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
  return (
    <div className="thumbs">
      {ids.map((id) => (
        <Thumb
          key={id}
          id={id}
          disabled={disabled}
          onRemove={() => {
            onChange(ids.filter((x) => x !== id));
            void removePhoto(id);
          }}
        />
      ))}
      {disabled ? null : (
        <label className="thumb thumb--add" aria-label="Foto aufnehmen">
          {busy ? '…' : <Icon name="camera" size={26} />}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => {
              void add(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
