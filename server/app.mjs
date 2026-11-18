import express from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAudiveris, runOmr } from './omr.mjs';

export function createApp() {
  const app = express();
  const upload = multer({ dest: path.join(tmpdir(), 'regie-uploads'), limits: { fileSize: 200 * 1024 * 1024 } });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, omr: Boolean(findAudiveris()) });
  });

  app.post('/api/omr', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    // Audiveris se fie à l'extension : on renomme le fichier temporaire.
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.pdf';
    const input = req.file.path + ext;
    try {
      await rename(req.file.path, input);
      const { name, data } = await runOmr(input);
      res.setHeader('Content-Type', 'application/vnd.recordare.musicxml');
      res.setHeader('X-Score-Name', encodeURIComponent(name));
      res.send(data);
    } catch (e) {
      res.status(e.status ?? 500).json({ error: e.message });
    } finally {
      await rm(input, { force: true });
      await rm(req.file.path, { force: true });
    }
  });

  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}
