/** Un instrument (une « part » de la partition). */
export interface Part {
  id: string;
  name: string;
  abbreviation?: string;
}

/** Une mesure, telle qu'elle apparaît dans la partition (ordre linéaire, sans reprises). */
export interface Measure {
  /** Numéro affiché (attribut `number` du MusicXML : "0" pour une levée, "12a"…). */
  label: string;
  /** Durée en noires. */
  quarters: number;
  /** Position de début, en noires depuis le début de la pièce. */
  startQuarter: number;
  /** Tempo (noires par minute) en vigueur au début de la mesure. */
  tempo: number;
  /** Chiffrage, ex. "4/4". */
  time: string;
  /** Lettre ou chiffre de répétition (repère) commençant dans cette mesure. */
  rehearsal?: string;
}

/** La partition importée, réduite à ce qui sert à la régie. */
export interface Score {
  title: string;
  parts: Part[];
  measures: Measure[];
  /** activity[partId][measureIndex] = true si l'instrument joue dans la mesure. */
  activity: Record<string, boolean[]>;
  /** solo[partId][measureIndex] = true si la partition indique un solo (« Solo », « Soli »). */
  solo?: Record<string, boolean[]>;
  source: 'musicxml' | 'omr' | 'manuel';
}

/** Un top global (t1, t2…) posé au début d'une mesure. */
export interface Top {
  id: string;
  measureIndex: number;
  /** Commentaire libre pour le réalisateur (« entrée cors », « tutti »…). */
  note?: string;
}

export interface Camera {
  id: string;
  name: string;
  operator?: string;
  /** Instruments que cette caméra doit filmer. */
  partIds: string[];
  /** Consigne par top (clé = id du top). Vide = rien à faire. */
  instructions: Record<string, string>;
}

export interface Project {
  version: 1;
  score: Score;
  /**
   * Corrections manuelles de la timeline : clé `${partId}:${measureIndex}`,
   * true = l'instrument joue (ajouté pendant la lecture), false = forcé silencieux.
   */
  overrides: Record<string, boolean>;
  /** Solos ajoutés (true) ou retirés (false) à la main, clé `${partId}:${measureIndex}`. */
  soloOverrides?: Record<string, boolean>;
  /** Couleur choisie pour chaque instrument (clé = id de l'instrument). */
  partColors?: Record<string, string>;
  /** Mesures coupées (sautées à la lecture). */
  cutMeasures: number[];
  tops: Top[];
  cameras: Camera[];
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyProject(score: Score): Project {
  return { version: 1, score, overrides: {}, soloOverrides: {}, partColors: {}, cutMeasures: [], tops: [], cameras: [] };
}
