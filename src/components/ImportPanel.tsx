import { useEffect, useState } from 'react';
import type { Project, Score } from '../lib/model';
import { readScoreFile, unzipMxl, parseMusicXml } from '../lib/musicxml';
import { DEFAULT_INSTRUMENTS, manualScore, validateProject } from '../lib/storage';

interface Props {
  onScore: (score: Score) => void;
  onProject: (project: Project) => void;
}

export function ImportPanel({ onScore, onProject }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [omrAvailable, setOmrAvailable] = useState<boolean | null>(null);
  const [manual, setManual] = useState({
    title: '',
    instruments: DEFAULT_INSTRUMENTS.join('\n'),
    measures: 100,
    beats: 4,
    beatType: 4,
    tempo: 100,
  });

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setOmrAvailable(Boolean(j.omr)))
      .catch(() => setOmrAvailable(false));
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const onMusicXml = (file: File) => run('Lecture du MusicXML…', async () => onScore(await readScoreFile(file)));

  const onPdf = (file: File) =>
    run('Reconnaissance de la partition (Audiveris)… cela peut prendre plusieurs minutes.', async () => {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/omr', { method: 'POST', body });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Erreur serveur (${res.status}).`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const xml = buf[0] === 0x50 && buf[1] === 0x4b ? unzipMxl(buf) : new TextDecoder().decode(buf);
      const score = parseMusicXml(xml, 'omr');
      if (score.title === 'Sans titre') score.title = file.name.replace(/\.[^.]+$/, '');
      onScore(score);
    });

  const onJson = (file: File) => run('Ouverture du projet…', async () => onProject(validateProject(JSON.parse(await file.text()))));

  const pick = (accept: string, cb: (f: File) => void) => (
    <input
      type="file"
      accept={accept}
      disabled={!!busy}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) cb(f);
        e.target.value = '';
      }}
    />
  );

  return (
    <div className="import">
      <h1>Régie orchestre</h1>
      <p className="lead">
        Importez la partition du chef : l'appli construit la timeline des instruments, vous posez les tops (t1, t2…), assignez
        les caméras, puis imprimez un conducteur papier par cadreur.
      </p>
      {busy && <p className="busy">{busy}</p>}
      {error && <p className="error">{error}</p>}

      <div className="import-grid">
        <section className="card primary">
          <h2>1. MusicXML <span className="badge">recommandé</span></h2>
          <p>Fichier <code>.musicxml</code>, <code>.xml</code> ou <code>.mxl</code> exporté depuis MuseScore, Sibelius, Finale, Dorico…</p>
          {pick('.musicxml,.xml,.mxl', onMusicXml)}
          <button
            className="ghost"
            disabled={!!busy}
            onClick={() =>
              run('Chargement de l’exemple…', async () => {
                const res = await fetch(`${import.meta.env.BASE_URL}demo.musicxml`);
                onScore(parseMusicXml(await res.text()));
              })
            }
          >
            Essayer avec une partition d'exemple
          </button>
        </section>

        <section className="card">
          <h2>2. PDF scanné (OCR musical)</h2>
          <p>
            Si vous n'avez pas de MusicXML : la partition est reconnue par Audiveris sur le serveur. Moins fiable, vérifiez la
            timeline ensuite.
          </p>
          {omrAvailable === false && (
            <p className="warn">Audiveris n'est pas détecté sur le serveur : voir le README pour l'installer.</p>
          )}
          {pick('.pdf,.png,.jpg,.jpeg,.tif,.tiff', onPdf)}
        </section>

        <section className="card">
          <h2>3. Sans partition</h2>
          <p>Timeline vierge : vous marquez les instruments à la main pendant la lecture.</p>
          <label>
            Titre
            <input value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} />
          </label>
          <label>
            Instruments (un par ligne)
            <textarea rows={6} value={manual.instruments} onChange={(e) => setManual({ ...manual, instruments: e.target.value })} />
          </label>
          <div className="row">
            <label>
              Mesures
              <input type="number" min={1} value={manual.measures} onChange={(e) => setManual({ ...manual, measures: +e.target.value })} />
            </label>
            <label>
              Chiffrage
              <span className="row tight">
                <input type="number" min={1} value={manual.beats} onChange={(e) => setManual({ ...manual, beats: +e.target.value })} />/
                <input type="number" min={1} value={manual.beatType} onChange={(e) => setManual({ ...manual, beatType: +e.target.value })} />
              </span>
            </label>
            <label>
              Tempo
              <input type="number" min={20} value={manual.tempo} onChange={(e) => setManual({ ...manual, tempo: +e.target.value })} />
            </label>
          </div>
          <button
            disabled={!!busy}
            onClick={() => {
              const names = manual.instruments.split('\n').map((s) => s.trim()).filter(Boolean);
              if (!names.length) return setError('Indiquez au moins un instrument.');
              onScore(manualScore(manual.title, names, Math.max(1, manual.measures), manual.beats || 4, manual.beatType || 4, manual.tempo || 100));
            }}
          >
            Créer la timeline
          </button>
        </section>

        <section className="card">
          <h2>Ouvrir un projet</h2>
          <p>Un fichier <code>.regie.json</code> enregistré précédemment.</p>
          {pick('.json', onJson)}
        </section>
      </div>
    </div>
  );
}
