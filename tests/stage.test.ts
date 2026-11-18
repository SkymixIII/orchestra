import { describe, expect, it } from 'vitest';
import { emptyProject } from '../src/lib/model';
import { stageGrid, stageState } from '../src/lib/stage';
import { manualScore } from '../src/lib/storage';

describe('écran des instruments', () => {
  it('remplit l’écran avec les tuiles', () => {
    expect(stageGrid(1, 1600, 900)).toEqual({ cols: 1, rows: 1 });
    // Deux bandes larges : les noms d'instruments, longs, y tiennent mieux.
    expect(stageGrid(2, 1600, 900)).toEqual({ cols: 1, rows: 2 });
    expect(stageGrid(4, 1600, 900)).toEqual({ cols: 2, rows: 2 });
    const g = stageGrid(14, 1600, 900);
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(14);
  });

  it('ne montre que les instruments qui jouent, avec couleur, solo et top', () => {
    const score = manualScore('T', ['Violons', 'Cors', 'Tuba'], 4, 4, 4, 60);
    score.activity.P1[1] = true;
    score.activity.P2[1] = true;
    score.activity.P3[2] = true;
    const p = emptyProject(score);
    p.partColors = { P2: '#123456' };
    p.tops = [{ id: 'a', measureIndex: 1 }];
    const s1 = stageState(p, 1, true);
    expect(s1.tiles.map((t) => [t.name, t.color, t.solo])).toEqual([
      ['Violons', '#2f6f8f', false],
      ['Cors', '#123456', false],
    ]);
    expect(s1.top).toBe('t1');
    const s2 = stageState(p, 2, true);
    expect(s2.tiles).toEqual([{ id: 'P3', name: 'Tuba', color: '#2f6f8f', solo: true }]);
    expect(stageState(p, 0, false).tiles).toEqual([]);
    expect(stageState(p, 0, false).top).toBeUndefined();
  });
});
