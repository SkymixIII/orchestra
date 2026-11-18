import type { Measure, Project, Score } from './model';

const KEY = 'regie-orchestre:projet';

export function saveLocal(project: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    /* stockage indisponible : on continue sans */
  }
}

export function loadLocal(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? validateProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}

export function validateProject(data: unknown): Project {
  const p = data as Project;
  if (!p || p.version !== 1 || !p.score?.parts || !p.score?.measures) {
    throw new Error("Ce fichier n'est pas un projet de régie valide.");
  }
  return {
    ...p,
    overrides: p.overrides ?? {},
    soloOverrides: p.soloOverrides ?? {},
    partColors: p.partColors ?? {},
    cutMeasures: p.cutMeasures ?? [],
    tops: p.tops ?? [],
    cameras: p.cameras ?? [],
  };
}

export function downloadJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${project.score.title || 'regie'}.regie.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Liste d'instruments de l'orchestre (fournie par la régie), utilisée pour une timeline sans partition. */
export const DEFAULT_INSTRUMENTS = [
  'Violons I',
  'Violons II',
  'Altos',
  'Violoncelles',
  'Contrebasses',
  'Percussions',
  'Flûtes',
  'Clarinettes',
  'Hautbois',
  'Bassons',
  'Tuba',
  'Cors',
  'Trombones',
  'Trompettes',
];

/**
 * Partition « vide » sans fichier : instruments + nombre de mesures + chiffrage + tempo.
 * La timeline se remplit ensuite à la main (boutons pendant la lecture).
 */
export function manualScore(
  title: string,
  instruments: string[],
  measureCount: number,
  beats: number,
  beatType: number,
  tempo: number,
): Score {
  const quarters = (beats * 4) / beatType;
  const measures: Measure[] = Array.from({ length: measureCount }, (_, i) => ({
    label: String(i + 1),
    quarters,
    startQuarter: i * quarters,
    tempo,
    time: `${beats}/${beatType}`,
  }));
  const parts = instruments.map((name, i) => ({ id: `P${i + 1}`, name }));
  const activity: Record<string, boolean[]> = {};
  for (const p of parts) activity[p.id] = new Array(measureCount).fill(false);
  return { title: title || 'Sans titre', parts, measures, activity, source: 'manuel' };
}
