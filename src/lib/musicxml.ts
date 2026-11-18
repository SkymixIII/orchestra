import { unzipSync, strFromU8 } from 'fflate';
import type { Measure, Part, Score } from './model';

const DEFAULT_TEMPO = 120;

function kids(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}
function kid(el: Element, name: string): Element | undefined {
  return kids(el, name)[0];
}
function text(el: Element | undefined, name?: string): string | undefined {
  const target = el && name ? kid(el, name) : el;
  const t = target?.textContent?.trim();
  return t ? t : undefined;
}
function descendants(el: Element, name: string): Element[] {
  return Array.from(el.getElementsByTagName(name));
}

const BEAT_UNIT_IN_QUARTERS: Record<string, number> = {
  breve: 8,
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
};

/** Tempo en noires/minute trouvé dans une mesure (son > métronome), sinon undefined. */
function tempoIn(measure: Element): number | undefined {
  for (const sound of descendants(measure, 'sound')) {
    const t = parseFloat(sound.getAttribute('tempo') ?? '');
    if (t > 0) return t;
  }
  for (const metro of descendants(measure, 'metronome')) {
    const unit = text(metro, 'beat-unit');
    const perMinute = parseFloat(text(metro, 'per-minute') ?? '');
    if (!unit || !(perMinute > 0)) continue;
    let q = BEAT_UNIT_IN_QUARTERS[unit] ?? 1;
    if (kid(metro, 'beat-unit-dot')) q *= 1.5;
    return perMinute * q;
  }
  return undefined;
}

/** Indication de solo / fin de solo dans le texte d'une mesure. */
function soloMarkIn(measure: Element): 'solo' | 'tutti' | undefined {
  let mark: 'solo' | 'tutti' | undefined;
  for (const w of descendants(measure, 'words')) {
    const t = (w.textContent ?? '').toLowerCase();
    if (/\b(solo|soli|soliste)\b/.test(t)) mark = 'solo';
    else if (/\b(tutti|tous|a ?2|à ?2|unis)\b/.test(t)) mark = 'tutti';
  }
  return mark;
}

function rehearsalIn(measure: Element): string | undefined {
  for (const r of descendants(measure, 'rehearsal')) {
    const t = r.textContent?.trim();
    if (t) return t;
  }
  return undefined;
}

/** Convertit une partition « timewise » en liste de mesures par part. */
function measuresByPart(root: Element): Map<string, Element[]> {
  const out = new Map<string, Element[]>();
  if (root.localName === 'score-partwise') {
    for (const p of kids(root, 'part')) out.set(p.getAttribute('id') ?? '', kids(p, 'measure'));
  } else {
    for (const m of kids(root, 'measure')) {
      for (const p of kids(m, 'part')) {
        const id = p.getAttribute('id') ?? '';
        if (!out.has(id)) out.set(id, []);
        // On garde l'attribut number de la mesure sur l'élément part.
        if (!p.hasAttribute('number')) p.setAttribute('number', m.getAttribute('number') ?? '');
        
        out.get(id)!.push(p);
      }
    }
  }
  return out;
}

/**
 * Lit un document MusicXML (texte) et en extrait instruments, mesures, tempos,
 * repères et la carte « qui joue dans quelle mesure ».
 */
export function parseMusicXml(xml: string, source: Score['source'] = 'musicxml'): Score {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Fichier MusicXML illisible (XML invalide).');
  }
  const root = doc.documentElement;
  if (root.localName !== 'score-partwise' && root.localName !== 'score-timewise') {
    throw new Error("Ce fichier n'est pas une partition MusicXML (score-partwise attendu).");
  }

  const title =
    text(kid(root, 'work') , 'work-title') ??
    text(kid(root, 'movement-title')) ??
    text(descendants(root, 'credit-words')[0]) ??
    'Sans titre';

  const partList = kid(root, 'part-list');
  const parts: Part[] = (partList ? kids(partList, 'score-part') : []).map((sp, i) => ({
    id: sp.getAttribute('id') ?? `P${i + 1}`,
    name: text(sp, 'part-name') ?? text(sp, 'part-abbreviation') ?? `Instrument ${i + 1}`,
    abbreviation: text(sp, 'part-abbreviation'),
  }));

  const byPart = measuresByPart(root);
  // Parts présentes dans les mesures mais absentes de la part-list.
  for (const id of byPart.keys()) {
    if (!parts.some((p) => p.id === id)) parts.push({ id, name: id });
  }
  const measureCount = Math.max(0, ...parts.map((p) => byPart.get(p.id)?.length ?? 0));

  const activity: Record<string, boolean[]> = {};
  const solo: Record<string, boolean[]> = {};
  const inSolo = new Map<string, boolean>();
  for (const p of parts) {
    activity[p.id] = new Array(measureCount).fill(false);
    solo[p.id] = new Array(measureCount).fill(false);
  }

  const divisions = new Map<string, number>();
  // Chiffrage en vigueur pour chaque instrument (l'OCR peut en mal lire un sur une part).
  const partTime = new Map<string, string>();
  let lastTime = '4/4';
  let tempo = DEFAULT_TEMPO;
  let start = 0;
  const measures: Measure[] = [];

  for (let m = 0; m < measureCount; m++) {
    let label = String(m + 1);
    let actualQuarters = 0;
    let rehearsal: string | undefined;
    let measureTempo: number | undefined;

    parts.forEach((p, pi) => {
      const el = byPart.get(p.id)?.[m];
      if (!el) return;
      if (pi === 0 || label === String(m + 1)) label = el.getAttribute('number') || label;

      let div = divisions.get(p.id) ?? 1;
      let cursor = 0;
      let maxCursor = 0;
      let plays = false;
      for (const child of Array.from(el.children)) {
        switch (child.localName) {
          case 'attributes': {
            const d = parseFloat(text(child, 'divisions') ?? '');
            if (d > 0) {
              div = d;
              divisions.set(p.id, d);
            }
            const time = kid(child, 'time');
            if (time) {
              const b = parseInt(text(time, 'beats') ?? '', 10);
              const bt = parseInt(text(time, 'beat-type') ?? '', 10);
              if (b > 0 && bt > 0) partTime.set(p.id, `${b}/${bt}`);
            }
            break;
          }
          case 'note': {
            const isRest = !!kid(child, 'rest');
            const isGrace = !!kid(child, 'grace');
            const isChord = !!kid(child, 'chord');
            const isCue = !!kid(child, 'cue');
            if (!isRest && !isCue) plays = true;
            if (!isGrace && !isChord) {
              cursor += parseFloat(text(child, 'duration') ?? '0') || 0;
            }
            break;
          }
          case 'backup':
            cursor -= parseFloat(text(child, 'duration') ?? '0') || 0;
            break;
          case 'forward':
            cursor += parseFloat(text(child, 'duration') ?? '0') || 0;
            break;
        }
        maxCursor = Math.max(maxCursor, cursor);
      }
      actualQuarters = Math.max(actualQuarters, maxCursor / div);
      activity[p.id][m] = plays;
      // Un « Solo » vaut jusqu'à « Tutti » ou jusqu'à la première mesure de silence.
      const mark = soloMarkIn(el);
      if (mark) inSolo.set(p.id, mark === 'solo');
      if (!plays) inSolo.set(p.id, false);
      solo[p.id][m] = plays && !!inSolo.get(p.id);
      rehearsal ??= rehearsalIn(el);
      measureTempo ??= tempoIn(el);
    });

    if (measureTempo) tempo = measureTempo;
    // Chiffrage de la mesure = celui de la majorité des instruments.
    const votes = new Map<string, number>();
    for (const p of parts) {
      const t = partTime.get(p.id);
      if (t) votes.set(t, (votes.get(t) ?? 0) + 1);
    }
    let time = lastTime;
    let best = 0;
    for (const [t, n] of votes) if (n > best || (n === best && t === lastTime)) [time, best] = [t, n];
    lastTime = time;
    const [timeBeats, timeBeatType] = time.split('/').map(Number);
    const nominal = (timeBeats * 4) / timeBeatType;
    // La durée vient du chiffrage en vigueur, pas du contenu des notes (souvent faux après OCR).
    // Seule exception : une levée (première mesure incomplète).
    const isPickup = m === 0 && actualQuarters > 0 && actualQuarters < nominal;
    const quarters = isPickup ? actualQuarters : nominal;
    measures.push({
      label,
      quarters,
      startQuarter: start,
      tempo,
      time,
      rehearsal,
    });
    start += quarters;
  }

  if (!parts.length || !measures.length) {
    throw new Error('Aucun instrument ou aucune mesure trouvé dans ce MusicXML.');
  }
  return { title, parts, measures, activity, solo, source };
}

/** Extrait le MusicXML principal d'une archive .mxl (MusicXML compressé). */
export function unzipMxl(data: Uint8Array): string {
  const files = unzipSync(data);
  const container = files['META-INF/container.xml'];
  if (container) {
    const doc = new DOMParser().parseFromString(strFromU8(container), 'application/xml');
    const path = doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
    if (path && files[path]) return strFromU8(files[path]);
  }
  const name = Object.keys(files).find((f) => !f.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(f));
  if (!name) throw new Error('Archive .mxl sans partition MusicXML.');
  return strFromU8(files[name]);
}

/** Lit un fichier .musicxml / .xml / .mxl. */
export async function readScoreFile(file: File, source: Score['source'] = 'musicxml'): Promise<Score> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
  const xml = isZip ? unzipMxl(buf) : new TextDecoder().decode(buf);
  const score = parseMusicXml(xml, source);
  if (score.title === 'Sans titre') score.title = file.name.replace(/\.[^.]+$/, '');
  return score;
}
