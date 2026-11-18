import { useState } from 'react';
import type { Camera, Project } from '../lib/model';
import { cameraPartsPlaying, formatClock, measureClock, numberTops, whereLabel } from '../lib/timeline';

interface Props {
  project: Project;
  onClose: () => void;
}

function CameraSheet({ project, camera }: { project: Project; camera: Camera }) {
  const tops = numberTops(project);
  const clock = measureClock(project.score.measures, new Set(project.cutMeasures));
  const partName = (id: string) => project.score.parts.find((p) => p.id === id)?.name ?? id;
  const nextActionAfter = (i: number) => tops.slice(i + 1).find((t) => camera.instructions[t.top.id]?.trim());
  const actions = tops.filter((t) => camera.instructions[t.top.id]?.trim()).length;

  return (
    <section className="sheet">
      <header>
        <div>
          <h1>{camera.name}</h1>
          {camera.operator && <p className="operator">Cadreur : {camera.operator}</p>}
        </div>
        <div className="meta">
          <strong>{project.score.title}</strong>
          <span>Instruments : {camera.partIds.length ? camera.partIds.map(partName).join(', ') : '—'}</span>
          <span>
            {actions} action{actions > 1 ? 's' : ''} sur {tops.length} tops
          </span>
        </div>
      </header>
      <ol className="script">
        {tops.map((nt, i) => {
          const text = camera.instructions[nt.top.id]?.trim();
          const next = nextActionAfter(i);
          const playing = cameraPartsPlaying(project, camera, nt);
          return (
            <li key={nt.top.id} className={text ? 'action' : 'idle'}>
              <div className="where">
                <span className="tnum">t{nt.number}</span>
                {/* Les cadreurs n'ont pas la partition : pas de mesures ni de repères ici. */}
                <span className="loc">
                  <span className="clock">≈ {formatClock(clock[nt.top.measureIndex] ?? 0)}</span>
                  {nt.top.note && <span className="cue"> · {nt.top.note}</span>}
                </span>
              </div>
              <div className="what">
                {text ? (
                  <>
                    <p>{text}</p>
                    {playing.length > 0 && <small>Jouent : {playing.map(partName).join(', ')}</small>}
                  </>
                ) : (
                  <p className="nothing">
                    — rien à faire —{next ? ` prochaine action à t${next.number}` : ' fin de vos actions'}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DirectorSheet({ project }: { project: Project }) {
  const tops = numberTops(project);
  const clock = measureClock(project.score.measures, new Set(project.cutMeasures));
  return (
    <section className="sheet director">
      <header>
        <div>
          <h1>Conducteur général</h1>
        </div>
        <div className="meta">
          <strong>{project.score.title}</strong>
          <span>{project.cameras.length} caméras · {tops.length} tops</span>
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>Top</th>
            {project.cameras.map((c) => (
              <th key={c.id}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tops.map((nt) => (
            <tr key={nt.top.id}>
              <td className="where">
                <strong>{whereLabel(project, nt)}</strong>
                <small> ≈ {formatClock(clock[nt.top.measureIndex] ?? 0)}</small>
                {nt.top.note && <div>{nt.top.note}</div>}
              </td>
              {project.cameras.map((c) => (
                <td key={c.id} className={c.instructions[nt.top.id]?.trim() ? '' : 'nothing'}>
                  {c.instructions[nt.top.id]?.trim() || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PrintView({ project, onClose }: Props) {
  const [which, setWhich] = useState<string>('all');
  const cams = which === 'all' ? project.cameras : project.cameras.filter((c) => c.id === which);

  return (
    <div className="print-view">
      <div className="print-toolbar no-print">
        <button onClick={onClose}>← Retour à la régie</button>
        <select value={which} onChange={(e) => setWhich(e.target.value)}>
          <option value="all">Toutes les caméras (une page chacune)</option>
          <option value="director">Conducteur général (réalisateur)</option>
          {project.cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.operator ? ` · ${c.operator}` : ''}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>
      {!project.tops.length && <p className="hint no-print">Aucun top posé : les conducteurs sont vides.</p>}
      {which === 'director' ? <DirectorSheet project={project} /> : cams.map((c) => <CameraSheet key={c.id} project={project} camera={c} />)}
    </div>
  );
}
