import { createApp } from './app.mjs';
import { findAudiveris } from './omr.mjs';

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  const omr = findAudiveris();
  console.log(`Régie orchestre : http://localhost:${port}`);
  console.log(omr ? `OMR (PDF scannés) : Audiveris trouvé (${omr})` : 'OMR désactivé : Audiveris introuvable (voir README).');
});
