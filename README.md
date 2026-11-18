# Régie orchestre

Appli web pour préparer la réalisation vidéo d'un concert d'orchestre :

1. **Importer la partition du chef** : MusicXML en priorité (`.musicxml`, `.xml`, `.mxl`), sinon **PDF scanné** reconnu par OCR musical ([Audiveris](https://github.com/Audiveris/audiveris)), sinon timeline vierge à partir d'une liste d'instruments.
2. **Timeline** : une ligne par instrument, une colonne par mesure, cases pleines quand l'instrument joue. Repères (A, B…) et tempos sont lus dans la partition.
3. **Lecture** : défilement de la timeline avec BPM modifiable en direct, saut de mesures, mesures coupées. En lecture, **maintenir le bouton (ou la touche) d'un instrument** le marque comme jouant sur les mesures parcourues.
4. **Tops globaux t1, t2, t3…** posés pendant la lecture (touche `T`). Le réalisateur annonce « t3 », chaque cadreur lit sa consigne pour ce top.
5. **Caméras** : créez X caméras, assignez-leur des instruments. L'appli propose une consigne par caméra et par top (entrées / sorties de ses instruments), que vous corrigez à la main. Case vide = rien à faire.
6. **Conducteurs papier** : une page par caméra, chaque ligne commence par où on en est (`t3 · mes. 45 · repère B +2 ≈ 2:35`). Les tops sans action sont grisés avec « rien à faire, prochaine action à t5 ». Un conducteur général (toutes caméras) est aussi disponible.

Le projet est sauvegardé automatiquement dans le navigateur, et peut être enregistré/rouvert en fichier `.regie.json`.

## Lancer

```bash
npm install
npm run build
npm start            # http://localhost:3001
```

En développement : `npm run dev` (Vite sur http://localhost:5173 + API sur 3001).

Un bouton « Essayer avec une partition d'exemple » charge `public/demo.musicxml`.

## OCR des PDF scannés (Audiveris)

L'import PDF passe par le serveur (`POST /api/omr`), qui lance Audiveris en mode batch et renvoie le MusicXML produit.

1. Installer Audiveris (≥ 5.3) depuis https://github.com/Audiveris/audiveris/releases (Java 17+ requis).
2. Le mettre dans le `PATH` sous le nom `audiveris`, ou indiquer son chemin :
   ```bash
   AUDIVERIS_CMD=/opt/audiveris/bin/Audiveris npm start
   ```
3. `GET /api/health` renvoie `{ "omr": true }` quand Audiveris est détecté.

La reconnaissance d'une partition d'orchestre complète est lente (plusieurs minutes) et imparfaite : vérifiez et corrigez la timeline (clic sur les cases) après import.

## Raccourcis clavier (régie)

| Touche | Action |
| --- | --- |
| Espace | Lecture / pause |
| ← / → | Mesure précédente / suivante (Maj : 8 mesures) |
| ↑ / ↓ | BPM + / − 2 |
| T | Poser un top à la mesure courante |
| 1…0, A, Z, E, R, Y… | Maintenir : l'instrument correspondant joue (touche affichée sur chaque bouton) |

Sur la timeline : clic sur une case = ajouter/retirer l'instrument, clic sur un numéro de mesure = y aller, double-clic = couper/rétablir la mesure.

## Limites actuelles

- Les reprises et D.C./D.S. ne sont pas dépliées : la partition est lue dans l'ordre écrit (utilisez les mesures coupées si besoin).
- La résolution est la mesure (un instrument « joue » dans une mesure s'il a au moins une note, hors notes de repère/cue).
- Les tops sont posés au début d'une mesure.

## Tests

```bash
npm test
```
