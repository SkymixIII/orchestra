import { describe, expect, it } from 'vitest';
import { emptyProject, type Camera, type Project } from '../src/lib/model';
import { manualScore } from '../src/lib/storage';
import { advance, isPlaying, measureAt, measureClock, numberTops, suggestInstruction, whereLabel } from '../src/lib/timeline';

function project(): Project {
  const score = manualScore('Test', ['Violons', 'Cors', 'Flûtes'], 12, 4, 4, 60);
  // Violons 0-5, Cors 4-9, Flûtes jamais
  for (let m = 0; m < 6; m++) score.activity.P1[m] = true;
  for (let m = 4; m < 10; m++) score.activity.P2[m] = true;
  score.measures[4].rehearsal = 'A';
  return emptyProject(score);
}

describe('lecture', () => {
  it('trouve la mesure courante', () => {
    const p = project();
    expect(measureAt(p.score.measures, 0)).toBe(0);
    expect(measureAt(p.score.measures, 3.99)).toBe(0);
    expect(measureAt(p.score.measures, 4)).toBe(1);
    expect(measureAt(p.score.measures, 47)).toBe(11);
  });

  it('avance au BPM choisi et saute les mesures coupées', () => {
    const p = project();
    const m = p.score.measures;
    // 1 s à 120 = 2 noires
    expect(advance(m, new Set(), 0, 1, 120)).toBe(2);
    // On entre dans la mesure 1 coupée → on atterrit au début de la mesure 2 (+ reste)
    expect(advance(m, new Set([1]), 3, 1, 120)).toBe(9);
    // Fin de pièce
    expect(advance(m, new Set(), 47, 1, 120)).toBeNull();
  });

  it('chronomètre les mesures sans les coupures', () => {
    const p = project();
    const clock = measureClock(p.score.measures, new Set([0]));
    expect(clock[0]).toBe(0);
    expect(clock[1]).toBe(0);
    expect(clock[2]).toBe(4);
  });

  it('applique les corrections manuelles', () => {
    const p = project();
    expect(isPlaying(p, 'P3', 2)).toBe(false);
    p.overrides['P3:2'] = true;
    p.overrides['P1:0'] = false;
    expect(isPlaying(p, 'P3', 2)).toBe(true);
    expect(isPlaying(p, 'P1', 0)).toBe(false);
  });
});

describe('tops et consignes', () => {
  const cam = (partIds: string[]): Camera => ({ id: 'c', name: 'Cam', partIds, instructions: {} });

  it('numérote les tops dans l’ordre de la partition et indique où on en est', () => {
    const p = project();
    p.tops = [
      { id: 'b', measureIndex: 6 },
      { id: 'a', measureIndex: 0 },
      { id: 'c', measureIndex: 4 },
    ];
    const tops = numberTops(p);
    expect(tops.map((t) => [t.top.id, t.number, t.endMeasure])).toEqual([
      ['a', 1, 4],
      ['c', 2, 6],
      ['b', 3, 12],
    ]);
    expect(whereLabel(p, tops[0])).toBe('t1 · mes. 1');
    expect(whereLabel(p, tops[1])).toBe('t2 · mes. 5 · repère A');
    expect(whereLabel(p, tops[2])).toBe('t3 · mes. 7 · repère A +2');
  });

  it('propose une consigne seulement quand quelque chose change pour la caméra', () => {
    const p = project();
    p.tops = [
      { id: 't1', measureIndex: 0 },
      { id: 't2', measureIndex: 2 },
      { id: 't3', measureIndex: 4 },
      { id: 't4', measureIndex: 6 },
      { id: 't5', measureIndex: 10 },
    ];
    const tops = numberTops(p);
    const cors = cam(['P2']);
    expect(tops.map((_, i) => suggestInstruction(p, cors, tops, i))).toEqual([
      '',
      '',
      'Cadrer Cors (entrée)',
      '',
      "Libre (Cors s'arrête)",
    ]);
    const cordes = cam(['P1', 'P2']);
    expect(suggestInstruction(p, cordes, tops, 0)).toBe('Cadrer Violons');
    expect(suggestInstruction(p, cordes, tops, 1)).toBe('');
    expect(suggestInstruction(p, cordes, tops, 2)).toBe('Cadrer Violons, Cors (entrée)');
    expect(suggestInstruction(p, cordes, tops, 3)).toBe('Cadrer Cors');
  });
});
