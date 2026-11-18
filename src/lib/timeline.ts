import type { Camera, Measure, Project, Top } from './model';

export const overrideKey = (partId: string, m: number) => `${partId}:${m}`;

/** L'instrument joue-t-il dans la mesure m (partition + corrections manuelles) ? */
export function isPlaying(project: Project, partId: string, m: number): boolean {
  const o = project.overrides[overrideKey(partId, m)];
  if (o !== undefined) return o;
  return project.score.activity[partId]?.[m] ?? false;
}

/**
 * L'instrument a-t-il un solo dans la mesure m ? Correction manuelle, sinon indication
 * « Solo » de la partition, sinon seul instrument à jouer dans la mesure.
 */
export function isSolo(project: Project, partId: string, m: number): boolean {
  if (!isPlaying(project, partId, m)) return false;
  const o = project.soloOverrides?.[overrideKey(partId, m)];
  if (o !== undefined) return o;
  if (project.score.solo?.[partId]?.[m]) return true;
  const parts = project.score.parts;
  return parts.length > 1 && parts.every((p) => p.id === partId || !isPlaying(project, p.id, m));
}

export const DEFAULT_PART_COLOR = '#2f6f8f';
export const SOLO_COLOR = '#d62828';

export function partColor(project: Project, partId: string): string {
  return project.partColors?.[partId] ?? DEFAULT_PART_COLOR;
}

/** Index de la mesure contenant la position `q` (en noires). */
export function measureAt(measures: Measure[], q: number): number {
  let lo = 0;
  let hi = measures.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measures[mid].startQuarter <= q) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Première mesure non coupée à partir de m (ou -1 s'il n'y en a plus). */
export function nextPlayable(m: number, count: number, cuts: Set<number>): number {
  for (let i = Math.max(0, m); i < count; i++) if (!cuts.has(i)) return i;
  return -1;
}

export function endQuarter(measures: Measure[]): number {
  const last = measures[measures.length - 1];
  return last ? last.startQuarter + last.quarters : 0;
}

/**
 * Avance la tête de lecture de `seconds` secondes au tempo `bpm` (noires/min),
 * en sautant les mesures coupées. Renvoie la nouvelle position ou null en fin de pièce.
 */
export function advance(
  measures: Measure[],
  cuts: Set<number>,
  q: number,
  seconds: number,
  bpm: number,
): number | null {
  let pos = q + (seconds * bpm) / 60;
  let m = measureAt(measures, pos);
  if (pos >= endQuarter(measures)) return null;
  if (cuts.has(m)) {
    const next = nextPlayable(m, measures.length, cuts);
    if (next < 0) return null;
    pos = measures[next].startQuarter + (pos - measures[m].startQuarter);
    m = next;
  }
  return pos;
}

/** Durée (s) depuis le début jusqu'au début de chaque mesure, au tempo de la partition, coupures exclues. */
export function measureClock(measures: Measure[], cuts: Set<number>): number[] {
  const out: number[] = [];
  let t = 0;
  measures.forEach((m, i) => {
    out.push(t);
    if (!cuts.has(i)) t += (m.quarters * 60) / m.tempo;
  });
  return out;
}

export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface NumberedTop {
  top: Top;
  /** 1 pour t1… */
  number: number;
  /** Fin de la séquence (exclue) : mesure du top suivant ou fin de pièce. */
  endMeasure: number;
}

/** Tops triés par position, numérotés t1, t2… */
export function numberTops(project: Project): NumberedTop[] {
  const sorted = [...project.tops].sort((a, b) => a.measureIndex - b.measureIndex);
  return sorted.map((top, i) => ({
    top,
    number: i + 1,
    endMeasure: sorted[i + 1]?.measureIndex ?? project.score.measures.length,
  }));
}

/** Repère de répétition en vigueur à la mesure m (le dernier rencontré). */
export function rehearsalAt(measures: Measure[], m: number): { mark: string; since: number } | undefined {
  for (let i = Math.min(m, measures.length - 1); i >= 0; i--) {
    const r = measures[i].rehearsal;
    if (r) return { mark: r, since: i };
  }
  return undefined;
}

/** « Où on en est » : t3 · mes. 45 · repère B (+2). */
export function whereLabel(project: Project, nt: NumberedTop): string {
  const { measures } = project.score;
  const m = nt.top.measureIndex;
  const parts = [`t${nt.number}`, `mes. ${measures[m]?.label ?? m + 1}`];
  const r = rehearsalAt(measures, m);
  if (r) parts.push(r.since === m ? `repère ${r.mark}` : `repère ${r.mark} +${m - r.since}`);
  return parts.join(' · ');
}

function playingIn(project: Project, partIds: string[], from: number, to: number): string[] {
  return partIds.filter((id) => {
    for (let m = from; m < to; m++) if (isPlaying(project, id, m)) return true;
    return false;
  });
}

/** Instruments de la caméra qui jouent pendant la séquence du top. */
export function cameraPartsPlaying(project: Project, camera: Camera, nt: NumberedTop): string[] {
  return playingIn(project, camera.partIds, nt.top.measureIndex, nt.endMeasure);
}

/**
 * Consigne proposée automatiquement pour une caméra à un top. Une consigne vaut
 * jusqu'au top suivant : on la répète donc tant que ses instruments jouent.
 * Vide = le cadreur n'a rien à faire pendant ce top.
 */
export function suggestInstruction(project: Project, camera: Camera, tops: NumberedTop[], index: number): string {
  const nt = tops[index];
  const name = (id: string) => project.score.parts.find((p) => p.id === id)?.name ?? id;
  const now = cameraPartsPlaying(project, camera, nt);
  const before = index > 0 ? cameraPartsPlaying(project, camera, tops[index - 1]) : [];
  if (!now.length) {
    return before.length ? `Libre (${before.map(name).join(', ')} s'arrête${before.length > 1 ? 'nt' : ''})` : '';
  }
  const soloIn = (id: string) => {
    for (let m = nt.top.measureIndex; m < nt.endMeasure; m++) if (isSolo(project, id, m)) return true;
    return false;
  };
  const label = now.map((id) => {
    const tags = [index > 0 && !before.includes(id) ? 'entrée' : '', soloIn(id) ? 'solo' : ''].filter(Boolean);
    return tags.length ? `${name(id)} (${tags.join(', ')})` : name(id);
  });
  return `Cadrer ${label.join(', ')}`;
}
