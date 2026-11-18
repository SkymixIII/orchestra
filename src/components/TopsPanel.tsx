import type { Project } from '../lib/model';
import { cameraPartsPlaying, numberTops, suggestInstruction, whereLabel } from '../lib/timeline';
import { CAMERA_COLORS } from './CamerasPanel';

interface Props {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  selectedTop: string | null;
  onSeek: (m: number) => void;
}

export function TopsPanel({ project, update, selectedTop, onSeek }: Props) {
  const tops = numberTops(project);
  const { cameras, score } = project;
  const partName = (id: string) => score.parts.find((p) => p.id === id)?.name ?? id;

  const setInstruction = (camId: string, topId: string, value: string) =>
    update((p) => ({
      ...p,
      cameras: p.cameras.map((c) => (c.id === camId ? { ...c, instructions: { ...c.instructions, [topId]: value } } : c)),
    }));

  const fillSuggestions = (overwrite: boolean) =>
    update((p) => {
      const nts = numberTops(p);
      return {
        ...p,
        cameras: p.cameras.map((c) => {
          const instructions = { ...c.instructions };
          nts.forEach((nt, i) => {
            if (overwrite || !instructions[nt.top.id]?.trim()) instructions[nt.top.id] = suggestInstruction(p, c, nts, i);
          });
          return { ...c, instructions };
        }),
      };
    });

  return (
    <div className="panel tops-panel">
      <div className="panel-head">
        <h2>Tops & consignes</h2>
        <span className="row tight">
          <button disabled={!tops.length || !cameras.length} onClick={() => fillSuggestions(false)} title="Remplit les cases vides à partir de la timeline">
            Proposer les consignes
          </button>
          <button
            className="ghost"
            disabled={!tops.length || !cameras.length}
            onClick={() => confirm('Remplacer toutes les consignes par les propositions automatiques ?') && fillSuggestions(true)}
          >
            Tout regénérer
          </button>
        </span>
      </div>
      {!tops.length && (
        <p className="hint">
          Posez des tops pendant la lecture (touche <kbd>T</kbd> ou bouton « Top ») : ce sont les moments t1, t2… que le réalisateur annonce.
        </p>
      )}
      {!!tops.length && (
        <div className="tops-table-wrap">
          <table className="tops-table">
            <thead>
              <tr>
                <th>Top</th>
                {cameras.map((c, ci) => (
                  <th key={c.id} style={{ borderTop: `4px solid ${CAMERA_COLORS[ci % CAMERA_COLORS.length]}` }}>
                    {c.name}
                    {c.operator ? <small> · {c.operator}</small> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tops.map((nt, i) => (
                <tr key={nt.top.id} className={selectedTop === nt.top.id ? 'selected' : ''}>
                  <td className="where">
                    <button className="link" onClick={() => onSeek(nt.top.measureIndex)}>
                      {whereLabel(project, nt)}
                    </button>
                    <div className="row tight">
                      <label className="small">
                        mes.
                        <select
                          value={nt.top.measureIndex}
                          onChange={(e) =>
                            update((p) => ({ ...p, tops: p.tops.map((t) => (t.id === nt.top.id ? { ...t, measureIndex: +e.target.value } : t)) }))
                          }
                        >
                          {score.measures.map((m, mi) => (
                            <option key={mi} value={mi}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="ghost"
                        title="Supprimer ce top"
                        onClick={() => update((p) => ({ ...p, tops: p.tops.filter((t) => t.id !== nt.top.id) }))}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      className="note"
                      placeholder="Note (ex. entrée des cors)"
                      value={nt.top.note ?? ''}
                      onChange={(e) => update((p) => ({ ...p, tops: p.tops.map((t) => (t.id === nt.top.id ? { ...t, note: e.target.value } : t)) }))}
                    />
                  </td>
                  {cameras.map((c) => {
                    const playing = cameraPartsPlaying(project, c, nt);
                    return (
                      <td key={c.id}>
                        <textarea
                          rows={2}
                          value={c.instructions[nt.top.id] ?? ''}
                          placeholder={suggestInstruction(project, c, tops, i) || 'Rien à faire'}
                          onChange={(e) => setInstruction(c.id, nt.top.id, e.target.value)}
                        />
                        {!!c.partIds.length && (
                          <small className="playing">{playing.length ? `Jouent : ${playing.map(partName).join(', ')}` : 'Ses instruments ne jouent pas'}</small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
