// @vitest-environment node
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error module JS sans types
import { createApp } from '../server/app.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'fake-audiveris-'));
const fake = path.join(dir, 'audiveris');
// Faux Audiveris : écrit un .mxl factice dans le dossier -output.
writeFileSync(
  fake,
  `#!/bin/sh
while [ "$1" != "" ]; do
  if [ "$1" = "-output" ]; then shift; OUT="$1"; fi
  if [ "$1" = "--" ]; then shift; IN="$1"; fi
  shift
done
mkdir -p "$OUT/book"
printf 'PK-fake-mxl' > "$OUT/book/score.mxl"
`,
);
chmodSync(fake, 0o755);

describe('/api/omr', () => {
  const original = process.env.AUDIVERIS_CMD;
  afterEach(() => {
    process.env.AUDIVERIS_CMD = original;
  });

  it('renvoie le MusicXML produit par Audiveris', async () => {
    process.env.AUDIVERIS_CMD = fake;
    const res = await request(createApp())
      .post('/api/omr')
      .attach('file', Buffer.from('%PDF-1.4'), 'partition.pdf')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect((res.body as Buffer).toString()).toBe('PK-fake-mxl');
  });

  it('signale clairement quand Audiveris est absent', async () => {
    process.env.AUDIVERIS_CMD = '/nulle/part/audiveris';
    const app = createApp();
    const health = await request(app).get('/api/health');
    // Peut être vrai si Audiveris est réellement installé sur la machine.
    if (health.body.omr) return;
    const res = await request(app).post('/api/omr').attach('file', Buffer.from('%PDF'), 'x.pdf');
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/Audiveris/);
  });
});
