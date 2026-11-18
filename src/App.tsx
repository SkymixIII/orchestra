import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CamerasPanel, CAMERA_COLORS } from './components/CamerasPanel';
import { ImportPanel } from './components/ImportPanel';
import { PrintView } from './components/PrintView';
import { Timeline, type Tool } from './components/Timeline';
import { TopsPanel } from './components/TopsPanel';
import type { Project, Score } from './lib/model';
import { emptyProject, newId } from './lib/model';
import { STAGE_CHANNEL, stageState, type StageMessage } from './lib/stage';
import { clearLocal, downloadJson, loadLocal, saveLocal } from './lib/storage';
import { advance, isPlaying, isSolo, measureAt, nextPlayable, overrideKey } from './lib/timeline';

/** Touches clavier des boutons d'instruments (T, espace et flèches sont réservées). */
const PAD_KEYS = '1234567890azeryuiopqsdfghjklmwxcvbn'.split('');

export default function App() {
  const [project, setProject] = useState<Project | null>(() => loadLocal());
  const [view, setView] = useState<'regie' | 'print'>('regie');
  const [pos, setPos] = useState(0); // position en noires
  const [playing, setPlaying] = useState(false);
  const [bpmOverride, setBpmOverride] = useState<number | null>(null);
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [selectedTop, setSelectedTop] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('toggle');

  useEffect(() => {
    if (project) saveLocal(project);
  }, [project]);

  const update = useCallback((fn: (p: Project) => Project) => setProject((p) => (p ? fn(p) : p)), []);

  const measures = project?.score.measures ?? [];
  const cuts = useMemo(() => new Set(project?.cutMeasures ?? []), [project?.cutMeasures]);
  const currentMeasure = measureAt(measures, pos);
  // Tempo stable par défaut : celui du début de la pièce. Les changements de tempo écrits
  // dans la partition ne s'appliquent que si l'on coche « suivre la partition ».
  const [followScoreTempo, setFollowScoreTempo] = useState(false);
  const scoreTempo = (followScoreTempo ? measures[currentMeasure]?.tempo : measures[0]?.tempo) ?? 120;
  const bpm = bpmOverride ?? scoreTempo;

  // ---- Marquage d'instruments (bouton enfoncé = l'instrument joue) ----
  const markPlaying = useCallback(
    (partIds: Iterable<string>, m: number) =>
      update((p) => {
        const overrides = { ...p.overrides };
        let changed = false;
        for (const id of partIds) {
          const key = overrideKey(id, m);
          if (isPlaying(p, id, m)) continue;
          if (p.score.activity[id]?.[m]) delete overrides[key];
          else overrides[key] = true;
          changed = true;
        }
        return changed ? { ...p, overrides } : p;
      }),
    [update],
  );

  const press = useCallback(
    (partId: string) => {
      setHeld((h) => new Set(h).add(partId));
      markPlaying([partId], currentMeasure);
    },
    [markPlaying, currentMeasure],
  );
  const release = useCallback((partId: string) => {
    setHeld((h) => {
      const n = new Set(h);
      n.delete(partId);
      return n;
    });
  }, []);

  // ---- Boucle de lecture ----
  const state = useRef({ pos, bpm, cuts, measures, held, lastMeasure: currentMeasure });
  state.current = { ...state.current, bpm, cuts, measures, held };

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    state.current.pos = pos;
    // Horloge à intervalle fixe (et non requestAnimationFrame, qui s'arrête quand la fenêtre
    // de la régie passe en arrière-plan, par exemple derrière l'écran des instruments).
    // La position est toujours calculée à partir du temps réellement écoulé.
    const tick = () => {
      const now = performance.now();
      const s = state.current;
      const next = advance(s.measures, s.cuts, s.pos, (now - last) / 1000, s.bpm);
      last = now;
      if (next === null) {
        setPlaying(false);
        return;
      }
      s.pos = next;
      const m = measureAt(s.measures, next);
      if (m !== s.lastMeasure) {
        s.lastMeasure = m;
        if (s.held.size) markPlaying(s.held, m);
      }
      setPos(next);
    };
    const timer = window.setInterval(tick, 20);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const seekMeasure = useCallback(
    (m: number) => {
      const target = Math.max(0, Math.min(measures.length - 1, m));
      const q = measures[target]?.startQuarter ?? 0;
      state.current.pos = q;
      state.current.lastMeasure = target;
      setPos(q);
    },
    [measures],
  );

  const skip = (delta: number) => {
    let m = currentMeasure + delta;
    while (m >= 0 && m < measures.length && cuts.has(m)) m += Math.sign(delta);
    seekMeasure(m);
  };

  const addTop = useCallback(() => {
    update((p) => (p.tops.some((t) => t.measureIndex === currentMeasure) ? p : { ...p, tops: [...p.tops, { id: newId('top'), measureIndex: currentMeasure }] }));
  }, [update, currentMeasure]);

  const toggleCell = useCallback(
    (partId: string, m: number) =>
      update((p) => {
        const overrides = { ...p.overrides };
        const key = overrideKey(partId, m);
        const target = !isPlaying(p, partId, m);
        if ((p.score.activity[partId]?.[m] ?? false) === target) delete overrides[key];
        else overrides[key] = target;
        return { ...p, overrides };
      }),
    [update],
  );

  const eraseCell = useCallback(
    (partId: string, m: number) =>
      update((p) => {
        if (!isPlaying(p, partId, m)) return p;
        const overrides = { ...p.overrides };
        const key = overrideKey(partId, m);
        if (p.score.activity[partId]?.[m]) overrides[key] = false;
        else delete overrides[key];
        return { ...p, overrides };
      }),
    [update],
  );

  const toggleSolo = useCallback(
    (partId: string, m: number) =>
      update((p) => {
        if (!isPlaying(p, partId, m)) return p;
        const soloOverrides = { ...p.soloOverrides };
        const key = overrideKey(partId, m);
        delete soloOverrides[key];
        const auto = isSolo({ ...p, soloOverrides }, partId, m);
        const current = isSolo(p, partId, m);
        if (auto !== !current) soloOverrides[key] = !current;
        return { ...p, soloOverrides };
      }),
    [update],
  );

  const setPartColor = useCallback(
    (partId: string, color: string) => update((p) => ({ ...p, partColors: { ...p.partColors, [partId]: color } })),
    [update],
  );

  const toggleCut = useCallback(
    (m: number) =>
      update((p) => ({
        ...p,
        cutMeasures: p.cutMeasures.includes(m) ? p.cutMeasures.filter((x) => x !== m) : [...p.cutMeasures, m].sort((a, b) => a - b),
      })),
    [update],
  );

  const selectTop = useCallback(
    (id: string) => {
      setSelectedTop(id);
      const t = project?.tops.find((x) => x.id === id);
      if (t) seekMeasure(t.measureIndex);
    },
    [project?.tops, seekMeasure],
  );

  // ---- Écran des instruments (autre fenêtre), synchronisé par BroadcastChannel ----
  const channel = useRef<BroadcastChannel | null>(null);
  const stageRef = useRef<ReturnType<typeof stageState> | null>(null);
  stageRef.current = project ? stageState(project, currentMeasure, playing) : null;
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(STAGE_CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<StageMessage>) => {
      if (e.data.type === 'hello' && stageRef.current) ch.postMessage({ type: 'state', state: stageRef.current } satisfies StageMessage);
    };
    return () => ch.close();
  }, []);
  const stageKey = JSON.stringify(stageRef.current);
  useEffect(() => {
    if (stageRef.current) channel.current?.postMessage({ type: 'state', state: stageRef.current } satisfies StageMessage);
  }, [stageKey]);

  // ---- Clavier ----
  const parts = project?.score.parts ?? [];
  useEffect(() => {
    if (!project || view !== 'regie') return;
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        setPlaying((x) => !x);
      } else if (k === 't') addTop();
      else if (k === 'arrowright') skip(e.shiftKey ? 8 : 1);
      else if (k === 'arrowleft') skip(e.shiftKey ? -8 : -1);
      else if (k === 'arrowup') setBpmOverride(Math.min(400, Math.round(bpm + 2)));
      else if (k === 'arrowdown') setBpmOverride(Math.max(20, Math.round(bpm - 2)));
      else {
        const i = PAD_KEYS.indexOf(k);
        if (i >= 0 && parts[i] && !e.repeat) press(parts[i].id);
      }
    };
    const up = (e: KeyboardEvent) => {
      const i = PAD_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && parts[i]) release(parts[i].id);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const cameraColors = useMemo(() => {
    const out: Record<string, string[]> = {};
    project?.cameras.forEach((c, ci) => c.partIds.forEach((id) => (out[id] ??= []).push(CAMERA_COLORS[ci % CAMERA_COLORS.length])));
    return out;
  }, [project?.cameras]);

  const loadScore = (score: Score) => {
    setProject(emptyProject(score));
    setPos(0);
    setBpmOverride(null);
  };

  if (!project) {
    return <ImportPanel onScore={loadScore} onProject={(p) => setProject(p)} />;
  }
  if (view === 'print') {
    return <PrintView project={project} onClose={() => setView('regie')} />;
  }

  const m = measures[currentMeasure];

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <strong>{project.score.title}</strong>
          <small>
            {project.score.parts.length} instruments · {measures.length} mesures ·{' '}
            {project.score.source === 'omr' ? 'PDF reconnu (à vérifier)' : project.score.source === 'manuel' ? 'sans partition' : 'MusicXML'}
          </small>
        </div>
        <div className="row">
          <button
            onClick={() => window.open(`${window.location.pathname}#scene`, 'regie-scene', 'popup,width=1280,height=720')}
            title="Ouvre une deuxième fenêtre : les instruments qui jouent, en grand"
          >
            🖥 Écran instruments
          </button>
          <button onClick={() => setView('print')}>🖨 Conducteurs papier</button>
          <button className="ghost" onClick={() => downloadJson(project)}>
            Enregistrer le projet
          </button>
          <button
            className="ghost"
            onClick={() => {
              if (confirm('Fermer ce projet ? (pensez à l’enregistrer)')) {
                setPlaying(false);
                clearLocal();
                setProject(null);
              }
            }}
          >
            Nouveau
          </button>
        </div>
      </header>

      <div className="transport">
        <button onClick={() => seekMeasure(nextPlayable(0, measures.length, cuts))} title="Début">⏮</button>
        <button onClick={() => skip(-1)} title="Mesure précédente (←, Maj+← : 8 mesures)">◀</button>
        <button className="play" onClick={() => setPlaying((x) => !x)} title="Lecture / pause (espace)">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => skip(1)} title="Mesure suivante (→, Maj+→ : 8 mesures)">▶▶</button>
        <div className="position">
          <span className="big">mes. {m?.label}</span>
          <small>
            {m?.time}
            {m?.rehearsal ? ` · repère ${m.rehearsal}` : ''}
          </small>
        </div>
        <label className="bpm">
          <span>
            ♩ = <strong>{Math.round(bpm)}</strong>
            {bpmOverride === null ? <small> (partition)</small> : <small> (réglé)</small>}
          </span>
          <input type="range" min={20} max={300} value={Math.round(bpm)} onChange={(e) => setBpmOverride(+e.target.value)} />
        </label>
        {bpmOverride !== null && (
          <button className="ghost" onClick={() => setBpmOverride(null)} title="Revenir au tempo écrit">
            Tempo partition
          </button>
        )}
        <label className="small" title="Applique les changements de tempo écrits dans la partition (sinon le tempo reste constant)">
          <input type="checkbox" checked={followScoreTempo} onChange={(e) => setFollowScoreTempo(e.target.checked)} />
          Suivre les changements de tempo
        </label>
        <label className="small">
          Aller à
          <select value={currentMeasure} onChange={(e) => seekMeasure(+e.target.value)}>
            {measures.map((mm, i) => (
              <option key={i} value={i}>
                {mm.label}
                {mm.rehearsal ? ` [${mm.rehearsal}]` : ''}
                {cuts.has(i) ? ' (coupée)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="ghost" onClick={() => toggleCut(currentMeasure)} title="Couper / rétablir la mesure courante (sautée à la lecture)">
          {cuts.has(currentMeasure) ? 'Rétablir la mesure' : 'Couper la mesure'}
        </button>
        <button className="top-btn" onClick={addTop} title="Poser un top à la mesure courante (T)">
          + Top
        </button>
      </div>

      <div className="pad">
        {parts.map((p, i) => (
          <button
            key={p.id}
            className={`pad-btn${held.has(p.id) ? ' held' : ''}${isPlaying(project, p.id, currentMeasure) ? ' on' : ''}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              press(p.id);
            }}
            onPointerUp={() => release(p.id)}
            onPointerCancel={() => release(p.id)}
            title="Maintenir pendant la lecture : l'instrument est marqué comme jouant"
          >
            {PAD_KEYS[i] && <kbd>{PAD_KEYS[i].toUpperCase()}</kbd>}
            {p.name}
          </button>
        ))}
      </div>

      <div className="tools" role="toolbar" aria-label="Outils de la timeline">
        <span className="small">Outil :</span>
        <button className={tool === 'toggle' ? 'active' : ''} onClick={() => setTool('toggle')} title="Clic sur une case : l'instrument joue / ne joue pas">
          ✎ Ajouter / retirer
        </button>
        <button className={tool === 'erase' ? 'active' : ''} onClick={() => setTool('erase')} title="Cliquer-glisser sur les cases pour les effacer">
          ⌫ Gomme
        </button>
        <button className={tool === 'solo' ? 'active solo' : 'solo'} onClick={() => setTool('solo')} title="Clic sur une case jouée : marquer / retirer un solo">
          ★ Solo
        </button>
        <span className="hint">Couleur d'un instrument : cliquez sur la pastille à gauche de son nom.</span>
      </div>

      <Timeline
        project={project}
        tool={tool}
        onEraseCell={eraseCell}
        onToggleSolo={toggleSolo}
        onPartColor={setPartColor}
        position={pos}
        playing={playing}
        cameraColors={cameraColors}
        onToggleCell={toggleCell}
        onSeek={seekMeasure}
        onToggleCut={toggleCut}
        onSelectTop={selectTop}
      />
      <p className="hint legend">
        <i className="lg on" /> joue <i className="lg solo" /> solo <i className="lg manual" /> ajouté à la main <i className="lg muted" /> retiré à la main{' '}
        <i className="lg cut" /> mesure coupée · Clic sur un numéro : y aller · Double-clic : couper
      </p>

      <div className="panels">
        <CamerasPanel project={project} update={update} />
        <TopsPanel project={project} update={update} selectedTop={selectedTop} onSeek={seekMeasure} />
      </div>
    </div>
  );
}
