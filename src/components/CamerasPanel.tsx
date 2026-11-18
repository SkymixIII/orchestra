import { useState } from 'react';
import type { Camera, Project } from '../lib/model';
import { newId } from '../lib/model';

export const CAMERA_COLORS = ['#e4572e', '#2e86ab', '#17a398', '#f3a712', '#a23b72', '#6a4c93', '#3bb273', '#c06c84', '#355070', '#8a5a44'];

interface Props {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
}

export function CamerasPanel({ project, update }: Props) {
  const [count, setCount] = useState(3);
  const { cameras, score } = project;

  const setCam = (id: string, patch: Partial<Camera>) =>
    update((p) => ({ ...p, cameras: p.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const addCameras = (n: number) =>
    update((p) => {
      const start = p.cameras.length;
      const added: Camera[] = Array.from({ length: n }, (_, i) => ({
        id: newId('cam'),
        name: `Caméra ${start + i + 1}`,
        operator: '',
        partIds: [],
        instructions: {},
      }));
      return { ...p, cameras: [...p.cameras, ...added] };
    });

  return (
    <div className="panel cameras">
      <div className="panel-head">
        <h2>Caméras</h2>
        <span className="row tight">
          <input type="number" min={1} max={30} value={count} onChange={(e) => setCount(+e.target.value)} style={{ width: 56 }} />
          <button onClick={() => addCameras(Math.max(1, Math.min(30, count || 1)))}>Créer {count} caméra{count > 1 ? 's' : ''}</button>
        </span>
      </div>
      {!cameras.length && <p className="hint">Créez vos caméras puis cochez les instruments que chacune doit filmer.</p>}
      <div className="cam-list">
        {cameras.map((c, ci) => (
          <div className="cam" key={c.id} style={{ borderColor: CAMERA_COLORS[ci % CAMERA_COLORS.length] }}>
            <div className="row">
              <i className="swatch" style={{ background: CAMERA_COLORS[ci % CAMERA_COLORS.length] }} />
              <input value={c.name} onChange={(e) => setCam(c.id, { name: e.target.value })} aria-label="Nom de la caméra" />
              <input
                placeholder="Cadreur"
                value={c.operator ?? ''}
                onChange={(e) => setCam(c.id, { operator: e.target.value })}
                aria-label="Cadreur"
              />
              <button
                className="ghost"
                title="Supprimer la caméra"
                onClick={() => {
                  if (confirm(`Supprimer ${c.name} et ses consignes ?`)) update((p) => ({ ...p, cameras: p.cameras.filter((x) => x.id !== c.id) }));
                }}
              >
                ✕
              </button>
            </div>
            <div className="parts-check">
              {score.parts.map((p) => (
                <label key={p.id} className={c.partIds.includes(p.id) ? 'checked' : ''}>
                  <input
                    type="checkbox"
                    checked={c.partIds.includes(p.id)}
                    onChange={(e) =>
                      setCam(c.id, {
                        partIds: e.target.checked ? [...c.partIds, p.id] : c.partIds.filter((x) => x !== p.id),
                      })
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
