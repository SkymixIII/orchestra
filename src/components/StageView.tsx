import { useEffect, useState } from 'react';
import { STAGE_CHANNEL, stageGrid, type StageMessage, type StageState } from '../lib/stage';

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

/** Écran plein cadre : seuls les instruments qui jouent, en grand, partagent tout l'écran. */
export function StageView() {
  const [state, setState] = useState<StageState | null>(null);
  const { w, h } = useWindowSize();

  useEffect(() => {
    document.title = 'Instruments — Régie orchestre';
    const ch = new BroadcastChannel(STAGE_CHANNEL);
    ch.onmessage = (e: MessageEvent<StageMessage>) => {
      if (e.data.type === 'state') setState(e.data.state);
    };
    ch.postMessage({ type: 'hello' } satisfies StageMessage);
    return () => ch.close();
  }, []);

  const barH = 34;
  const tiles = state?.tiles ?? [];
  const { cols, rows } = stageGrid(tiles.length, w, h - barH);
  const tileW = w / cols;
  const tileH = (h - barH) / rows;

  return (
    <div className="stage" onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
      <div className="stage-bar" style={{ height: barH }}>
        <span>{state ? state.title : 'En attente de la régie… (ouvrez la régie dans une autre fenêtre)'}</span>
        {state && (
          <span>
            {state.top && <strong>{state.top}</strong>} mes. {state.measureLabel} {state.playing ? '▶' : '⏸'}
          </span>
        )}
        <span className="stage-help">double-clic : plein écran</span>
      </div>
      <div className="stage-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {tiles.map((t) => {
          const font = Math.max(14, Math.min(tileH * 0.32, (tileW * 0.9) / Math.max(4, t.name.length * 0.58)));
          return (
            <div key={t.id} className={`stage-tile${t.solo ? ' solo' : ''}`} style={{ background: t.solo ? '#d62828' : t.color }}>
              <span style={{ fontSize: font }}>{t.name}</span>
              {t.solo && <em style={{ fontSize: Math.max(12, font * 0.35) }}>SOLO</em>}
            </div>
          );
        })}
        {state && !tiles.length && <div className="stage-empty">Silence</div>}
      </div>
    </div>
  );
}
