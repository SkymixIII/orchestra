import { memo, useEffect, useRef } from 'react';
import type { Measure, Project } from '../lib/model';
import { isPlaying, isSolo, measureAt, numberTops, overrideKey, partColor, SOLO_COLOR } from '../lib/timeline';

/** Outil actif sur la timeline. */
export type Tool = 'toggle' | 'play' | 'erase' | 'solo';

/**
 * Largeur d'une noire en pixels. Chaque mesure a une largeur proportionnelle à sa durée,
 * pour que la tête de lecture avance à vitesse constante à BPM constant (une mesure à 3/4
 * ou une levée ne la fait plus « accélérer »).
 */
export const QUARTER_W = 7;
/** Largeur fixe d'une mesure quand toutes les mesures ont la même taille. */
export const MEASURE_W = 28;

/** Positions horizontales des mesures et de la tête de lecture. */
function layout(measures: Measure[], proportional: boolean) {
  if (proportional) {
    const last = measures[measures.length - 1];
    return {
      x: (i: number) => (measures[i]?.startQuarter ?? 0) * QUARTER_W,
      w: (i: number) => (measures[i]?.quarters ?? 4) * QUARTER_W,
      posX: (q: number) => q * QUARTER_W,
      total: last ? (last.startQuarter + last.quarters) * QUARTER_W : 0,
    };
  }
  return {
    x: (i: number) => i * MEASURE_W,
    w: () => MEASURE_W,
    posX: (q: number) => {
      const i = measureAt(measures, q);
      const m = measures[i];
      return m ? (i + Math.min(1, (q - m.startQuarter) / m.quarters)) * MEASURE_W : 0;
    },
    total: measures.length * MEASURE_W,
  };
}

interface GridProps {
  project: Project;
  cameraColors: Record<string, string[]>;
  tool: Tool;
  /** Largeur des mesures proportionnelle à leur durée (sinon toutes identiques). */
  proportional: boolean;
  onToggleCell: (partId: string, m: number) => void;
  onEraseCell: (partId: string, m: number) => void;
  onPlayCell: (partId: string, m: number) => void;
  onToggleSolo: (partId: string, m: number) => void;
  onSeek: (m: number) => void;
  onToggleCut: (m: number) => void;
  onSelectTop: (topId: string) => void;
}

/** Grille instruments × mesures (mémoïsée : ne se redessine pas à chaque image de lecture). */
const Grid = memo(function Grid({
  project,
  cameraColors,
  tool,
  proportional,
  onToggleCell,
  onEraseCell,
  onPlayCell,
  onToggleSolo,
  onSeek,
  onToggleCut,
  onSelectTop,
}: GridProps) {
  const { measures, parts, activity } = project.score;
  const L = layout(measures, proportional);
  // Gomme / « Joue » : on peint toutes les cases survolées tant que le bouton est enfoncé.
  const painting = useRef(false);
  const paint = tool === 'erase' ? onEraseCell : tool === 'play' ? onPlayCell : null;
  useEffect(() => {
    const stop = () => (painting.current = false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);
  const cuts = new Set(project.cutMeasures);
  const tops = numberTops(project);
  const width = L.total;

  return (
    <div className="grid" style={{ width }}>
      <div className="grid-row header rehearsal">
        {measures.map((m, i) =>
          m.rehearsal ? (
            <span key={i} className="rehearsal-mark" style={{ left: L.x(i) }}>
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
            style={{ left: L.x(t.top.measureIndex) }}
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
            style={{ width: L.w(i) }}
            title={`Mesure ${m.label} · ${m.time} · ♩=${Math.round(m.tempo)}${cuts.has(i) ? ' · COUPÉE' : ''}\nClic : aller ici · Double-clic : couper/rétablir`}
            onClick={() => onSeek(i)}
            onDoubleClick={() => onToggleCut(i)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {parts.map((p) => {
        const color = partColor(project, p.id);
        return (
          <div className="grid-row" key={p.id}>
            {measures.map((_, i) => {
              const on = isPlaying(project, p.id, i);
              const solo = on && isSolo(project, p.id, i);
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
                  title={solo ? `${p.name} : solo` : undefined}
                  style={{
                    width: L.w(i),
                    ...(on ? { background: solo ? SOLO_COLOR : color } : {}),
                    ...(on && colors?.length ? { boxShadow: `inset 0 -3px 0 ${colors[0]}` } : {}),
                  }}
                  onPointerDown={(e) => {
                    if (!paint) return;
                    e.preventDefault();
                    painting.current = true;
                    paint(p.id, i);
                  }}
                  onPointerEnter={() => {
                    if (paint && painting.current) paint(p.id, i);
                  }}
                  onClick={() => {
                    if (tool === 'toggle') onToggleCell(p.id, i);
                    else if (tool === 'solo') onToggleSolo(p.id, i);
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

interface Props extends GridProps {
  /** Position de lecture, en noires. */
  position: number;
  playing: boolean;
  onPartColor: (partId: string, color: string) => void;
}

export function Timeline(props: Props) {
  const { project, position, playing, cameraColors } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const x = layout(project.score.measures, props.proportional).posX(position);

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
            <input
              type="color"
              className="pcolor"
              value={partColor(project, p.id)}
              title={`Couleur de ${p.name}`}
              onChange={(e) => props.onPartColor(p.id, e.target.value)}
            />
            <span className="pname">{p.name}</span>
            <span className="dots">
              {(cameraColors[p.id] ?? []).map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className={`scroller tool-${props.tool === 'play' ? 'erase' : props.tool}`} ref={scroller}>
        <div className="scroll-inner">
          <Grid
            project={project}
            cameraColors={cameraColors}
            tool={props.tool}
            proportional={props.proportional}
            onPlayCell={props.onPlayCell}
            onToggleCell={props.onToggleCell}
            onEraseCell={props.onEraseCell}
            onToggleSolo={props.onToggleSolo}
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
