// Reconnaissance optique de partition (OMR) via Audiveris, pour les PDF scannés.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const candidates = () => [
  process.env.AUDIVERIS_CMD,
  'audiveris',
  'Audiveris',
  '/opt/audiveris/bin/Audiveris',
  '/opt/Audiveris/bin/Audiveris',
  '/Applications/Audiveris.app/Contents/MacOS/Audiveris',
  'C:\\Program Files\\Audiveris\\Audiveris.exe',
].filter(Boolean);

function onPath(cmd) {
  if (cmd.includes('/') || cmd.includes('\\')) return existsSync(cmd);
  const dirs = (process.env.PATH ?? '').split(path.delimiter);
  const exts = process.platform === 'win32' ? ['.exe', '.bat', '.cmd', ''] : [''];
  return dirs.some((d) => exts.some((e) => existsSync(path.join(d, cmd + e))));
}

/** Commande Audiveris utilisable, ou null si Audiveris n'est pas installé. */
export function findAudiveris() {
  return candidates().find(onPath) ?? null;
}

async function findMxl(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findMxl(full)));
    else if (/\.(mxl|musicxml|xml)$/i.test(entry.name)) found.push(full);
  }
  return found.sort();
}

/**
 * Lance Audiveris en mode batch sur un PDF/image et renvoie le MusicXML compressé (.mxl).
 * @returns {Promise<{ name: string, data: Buffer }>}
 */
export async function runOmr(inputPath, { timeoutMs = 15 * 60 * 1000 } = {}) {
  const cmd = findAudiveris();
  if (!cmd) {
    const err = new Error(
      "Audiveris n'est pas installé sur le serveur. Installez-le (https://github.com/Audiveris/audiveris/releases) " +
        'ou indiquez son chemin dans la variable AUDIVERIS_CMD.',
    );
    err.status = 501;
    throw err;
  }
  const outDir = await mkdtemp(path.join(tmpdir(), 'omr-'));
  try {
    await new Promise((resolve, reject) => {
      execFile(
        cmd,
        ['-batch', '-export', '-output', outDir, '--', inputPath],
        { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
        (error, _stdout, stderr) => {
          if (error) {
            error.message = `Audiveris a échoué : ${stderr?.toString().slice(-2000) || error.message}`;
            reject(error);
          } else resolve();
        },
      );
    });
    const files = await findMxl(outDir);
    // Audiveris produit un .mxl par mouvement ; on prend le premier non vide.
    for (const f of files) {
      if ((await stat(f)).size > 0) return { name: path.basename(f), data: await readFile(f) };
    }
    const err = new Error("Audiveris n'a reconnu aucune partition dans ce fichier (scan trop flou ?).");
    err.status = 422;
    throw err;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}
