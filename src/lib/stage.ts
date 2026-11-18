import type { Project } from './model';
import { CAMERA_COLORS } from './colors';
import { isPlaying, isSolo, numberTops, partColor } from './timeline';

/** Ce que l'écran des instruments affiche, envoyé par la régie à chaque changement. */
export interface StageState {
  title: string;
  measureLabel: string;
  top?: string;
  playing: boolean;
  tiles: StageTile[];
  /** Instruments qui jouent, regroupés par caméra (un instrument suivi par 2 caméras apparaît 2 fois). */
  groups: StageGroup[];
}

export interface StageTile {
  id: string;
  name: string;
  color: string;
  solo: boolean;
}

export interface StageGroup {
  id: string;
  name: string;
  color?: string;
  tiles: StageTile[];
}

export const STAGE_CHANNEL = 'regie-orchestre:scene';
export type StageMessage = { type: 'state'; state: StageState } | { type: 'hello' };

export function stageState(project: Project, m: number, playing: boolean): StageState {
  const tops = numberTops(project);
  const current = [...tops].reverse().find((t) => t.top.measureIndex <= m);
  const tiles: StageTile[] = project.score.parts
    .filter((p) => isPlaying(project, p.id, m))
    .map((p) => ({ id: p.id, name: p.name, color: partColor(project, p.id), solo: isSolo(project, p.id, m) }));
  const groups: StageGroup[] = project.cameras.map((c, i) => ({
    id: c.id,
    name: c.name,
    color: CAMERA_COLORS[i % CAMERA_COLORS.length],
    tiles: tiles.filter((t) => c.partIds.includes(t.id)),
  }));
  const unassigned = tiles.filter((t) => !project.cameras.some((c) => c.partIds.includes(t.id)));
  if (unassigned.length) groups.push({ id: 'none', name: project.cameras.length ? 'Sans caméra' : '', tiles: unassigned });
  return {
    title: project.score.title,
    measureLabel: project.score.measures[m]?.label ?? '',
    top: current ? `t${current.number}` : undefined,
    playing,
    tiles,
    groups: groups.filter((g) => g.tiles.length),
  };
}

/**
 * Grille qui remplit tout l'écran avec n tuiles : on choisit le nombre de colonnes
 * qui donne les tuiles les plus grandes (les plus proches du carré).
 */
export function stageGrid(n: number, width: number, height: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 1, rows: 1 };
  let best = { cols: 1, rows: n, score: -1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = width / cols;
    const h = height / rows;
    // Taille utile d'une tuile : le plus petit côté, en pénalisant les tuiles très allongées.
    const score = Math.min(w, h * 2.2);
    if (score > best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}
