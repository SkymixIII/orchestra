import { memo, useEffect, useRef } from 'react';
import type { Project } from '../lib/model';
import { isPlaying, numberTops, overrideKey } from '../lib/timeline';

export const MEASURE_W = 26;

interface GridProps {
  project: Project;
  cameraColors: Record<string, string[]>;
  onToggleCell: (partId: string, m: number) => void;
  onSeek: (m: number) => void;
  onToggleCut: (m: number) => void;
  onSelectTop: (topId: string) => void;
}

/** Grille instruments × mesures (mémoïsée : ne se redessine pas à chaque image de lecture). */
const Grid = memo(function Grid({ project, cameraColors, onToggleCell, onSeek, onToggleCut, onSelectTop }: GridProps) {
  const { measures, parts, activity } = project.score;
  const cuts = new Set(project.cutMeasures);
  const tops = numberTops(project);
  const width = measures.length * MEASURE_W;

  return (
    <div className="grid" style={{ width }}>
      <div className="grid-row header rehearsal">
        {measures.map((m, i) =>
          m.rehearsal ? (
            <span key={i} className="rehearsal-mark" style={{ left: i * MEASURE_W }}>
              {m.rehearsal}
            </span>
          ) : null,
        )}
      </div>
      <div className="grid-row header tops">
        {tops.map((t) => (
          <button
            key={t.top.id}
            className="top-flag"
            style={{ left: t.top.measureIndex * MEASURE_W }}
            title={t.top.note || `Top t${t.number}`}
            onClick={() => onSelectTop(t.top.id)}
          >
            t{t.number}
          </button>
        ))}
      </div>
      <div className="grid-row header numbers">
        {measures.map((m, i) => (
          <button
            key={i}
            className={`mnum${cuts.has(i) ? ' cut' : ''}`}
            style={{ width: MEASURE_W }}
            title={`Mesure ${m.label} · ${m.time} · ♩=${Math.round(m.tempo)}${cuts.has(i) ? ' · COUPÉE' : ''}\nClic : aller ici · Double-clic : couper/rétablir`}
            onClick={() => onSeek(i)}
            onDoubleClick={() => onToggleCut(i)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {parts.map((p) => (
        <div className="grid-row" key={p.id}>
          {measures.map((_, i) => {
            const on = isPlaying(project, p.id, i);
            const o = project.overrides[overrideKey(p.id, i)];
            const fromScore = activity[p.id]?.[i] ?? false;
            const cls = ['cell', on ? 'on' : '', o === true && !fromScore ? 'manual' : '', o === false && fromScore ? 'muted' : '', cuts.has(i) ? 'cut' : '']
              .filter(Boolean)
              .join(' ');
            const colors = cameraColors[p.id];
            return (
              <div
                key={i}
                className={cls}
                style={{ width: MEASURE_W, ...(on && colors?.length ? { boxShadow: `inset 0 -3px 0 ${colors[0]}` } : {}) }}
                onClick={() => onToggleCell(p.id, i)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

interface Props extends GridProps {
  position: { measure: number; fraction: number };
  playing: boolean;
}

export function Timeline(props: Props) {
  const { project, position, playing, cameraColors } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const x = (position.measure + position.fraction) * MEASURE_W;

  // Suit la tête de lecture.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const margin = 120;
    if (x < el.scrollLeft + margin || x > el.scrollLeft + el.clientWidth - margin) {
      el.scrollLeft = Math.max(0, x - (playing ? margin : el.clientWidth / 2));
    }
  }, [x, playing]);

  return (
    <div className="timeline">
      <div className="names">
        <div className="name header rehearsal">Repères</div>
        <div className="name header tops">Tops</div>
        <div className="name header numbers">Mesures</div>
        {project.score.parts.map((p) => (
          <div className="name" key={p.id} title={p.name}>
            <span className="pname">{p.name}</span>
            <span className="dots">
              {(cameraColors[p.id] ?? []).map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="scroller" ref={scroller}>
        <div className="scroll-inner">
          <Grid
            project={project}
            cameraColors={cameraColors}
            onToggleCell={props.onToggleCell}
            onSeek={props.onSeek}
            onToggleCut={props.onToggleCut}
            onSelectTop={props.onSelectTop}
          />
          <div className="playhead" style={{ transform: `translateX(${x}px)` }} />
        </div>
      </div>
    </div>
  );
}
