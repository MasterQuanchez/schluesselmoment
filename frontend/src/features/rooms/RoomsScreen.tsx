import { roomProgress, roomStatusLabel } from '@/domain/protocol';
import { href } from '@/router';
import { useProtocol } from '@/storage/useProtocol';
import { Icon } from '@/ui/Icon';
import { Loading, StepNav, TopBar } from '@/ui/kit';

export function RoomsScreen({ id }: { id: string }) {
  const { state } = useProtocol();
  if (state.status !== 'ready') return <Loading state={state} />;
  const p = state.protocol;
  const done = p.rooms.filter((r) => r.completedAt).length;
  const next = p.rooms.find((r) => !r.completedAt);

  return (
    <>
      <TopBar title="Räume" back={{ name: 'home' }}>
        <StepNav protocol={p} current="rooms" />
      </TopBar>
      <main className="page stack">
        <div>
          <h1 className="page-title">Räume</h1>
          <p className="page-sub">
            Tippen Sie auf einen Raum, um Mängel zu erfassen · {done}/{p.rooms.length} erledigt
          </p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${(done / Math.max(1, p.rooms.length)) * 100}%` }} />
          </div>
        </div>
        <ul className="list">
          {p.rooms.map((r) => {
            const prog = roomProgress(r);
            const status = roomStatusLabel(r);
            return (
              <li key={r.id}>
                <a className="list-item" href={href({ name: 'room', id, roomId: r.id })}>
                  <div className="grow">
                    <div className="list-item__title">{r.label}</div>
                    <div className="small muted">
                      {prog.done}/{prog.total} geprüft
                    </div>
                  </div>
                  {status ? (
                    <span className={status.tone === 'ok' ? 'badge badge--ok' : 'badge badge--defect'}>
                      {status.label}
                    </span>
                  ) : null}
                  <Icon name="next" />
                </a>
              </li>
            );
          })}
        </ul>
      </main>
      <div className="bottombar">
        <div className="bottombar__inner">
          {next ? (
            <a className="btn btn--primary btn--block" href={href({ name: 'room', id, roomId: next.id })}>
              Weiter: {next.label}
            </a>
          ) : (
            <a className="btn btn--primary btn--block celebrate" href={href({ name: 'meters', id })}>
              🎉 Alle Räume erledigt – weiter zu Zählern
            </a>
          )}
        </div>
      </div>
    </>
  );
}
