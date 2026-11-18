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
  const groups = state?.groups ?? [];
  const total = groups.reduce((n, g) => n + g.tiles.length, 0);
  // Largeur des colonnes : racine du nombre d'instruments, pour qu'une caméra avec un seul
  // instrument garde une colonne lisible à côté d'une caméra qui en suit beaucoup.
  const weight = (n: number) => Math.sqrt(n);
  const totalWeight = groups.reduce((n, g) => n + weight(g.tiles.length), 0);
  const pad = 4;
  const gap = 8;
  const headH = 30;
  const areaW = w - pad * 2 - gap * Math.max(0, groups.length - 1);
  const areaH = h - barH - pad * 2;

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
      {/* Une colonne par caméra (titre = nom de la caméra). */}
      <div className="stage-groups" style={{ padding: pad, gap }}>
        {groups.map((g) => {
          const gw = (areaW * weight(g.tiles.length)) / totalWeight;
          const gh = areaH - (g.name ? headH : 0);
          const { cols, rows } = stageGrid(g.tiles.length, gw, gh);
          const tileW = gw / cols;
          const tileH = gh / rows;
          return (
            <section key={g.id} className="stage-group" style={{ flex: `0 0 ${gw}px` }}>
              {g.name && (
                <header style={{ height: headH, borderColor: g.color ?? '#555', color: g.color ?? '#aaa' }}>{g.name}</header>
              )}
              <div className="stage-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                {g.tiles.map((t) => {
                  const font = Math.max(12, Math.min(tileH * 0.32, (tileW * 0.9) / Math.max(4, t.name.length * 0.58)));
                  return (
                    <div key={t.id} className={`stage-tile${t.solo ? ' solo' : ''}`} style={{ background: t.solo ? '#d62828' : t.color }}>
                      <span style={{ fontSize: font }}>{t.name}</span>
                      {t.solo && <em style={{ fontSize: Math.max(11, font * 0.35) }}>SOLO</em>}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {state && !total && <div className="stage-empty">Silence</div>}
      </div>
    </div>
  );
}
