# Régie orchestre

Appli web pour préparer la réalisation vidéo d'un concert d'orchestre :

1. **Importer la partition du chef** : MusicXML en priorité (`.musicxml`, `.xml`, `.mxl`), sinon **PDF scanné** reconnu par OCR musical ([Audiveris](https://github.com/Audiveris/audiveris)), sinon timeline vierge à partir d'une liste d'instruments.
2. **Timeline** : une ligne par instrument, une colonne par mesure, cases pleines quand l'instrument joue. Repères (A, B…) et tempos sont lus dans la partition. Outils : ajouter/retirer une case, **joue (pas solo)** (cliquer-glisser : l'instrument joue sans jamais passer en solo), **gomme** (cliquer-glisser pour effacer), **solo**. Toutes les mesures ont la même largeur (option « Largeur selon la durée » pour qu'une 3/4 soit plus étroite qu'une 4/4). La durée d'une mesure vient du chiffrage, pas des notes (évite les erreurs d'OCR) ; seule une vraie levée est plus courte. Les **solos sont en rouge** : indication « Solo » de la partition (jusqu'à « Tutti » ou un silence), instrument seul à jouer, ou marqué à la main. La **couleur de chaque instrument** se change avec la pastille à gauche de son nom.
3. **Lecture** : défilement de la timeline à tempo constant (celui du début de la pièce, ou celui que vous réglez ; cochez « Suivre les changements de tempo » pour appliquer ceux de la partition), BPM modifiable en direct, saut de mesures, mesures coupées. En lecture, **maintenir le bouton (ou la touche) d'un instrument** le marque comme jouant sur les mesures parcourues.
4. **Tops globaux t1, t2, t3…** posés pendant la lecture (touche `T`). Le réalisateur annonce « t3 », chaque cadreur lit sa consigne pour ce top.
5. **Caméras** : créez X caméras, donnez-leur un nom (« Cam jardin », « Steadicam »…), assignez-leur des instruments. L'appli propose une consigne par caméra et par top (entrées / sorties de ses instruments), que vous corrigez à la main. Case vide = rien à faire.
6. **Écran instruments** (bouton 🖥) : une deuxième fenêtre, synchronisée avec la régie, où seuls les instruments qui jouent s'affichent en grand et se partagent tout l'écran (solos en rouge), avec deux modes d'affichage : « Tout » (tous les instruments qui jouent) ou « Par caméra » (colonnes par caméra, titre = nom de la caméra ; un instrument suivi par deux caméras apparaît dans les deux, ceux sans caméra dans « Sans caméra »). Double-clic pour le plein écran.
7. **Conducteurs papier** : une page par caméra, chaque ligne se lit « `t4 →` consigne, jusqu'à t5 » : le cadreur tient la consigne jusqu'à l'annonce du top suivant. Les cadreurs n'ayant pas la partition, ni mesures, ni repères, ni minutage n'y figurent. Les tops sans action sont grisés avec « rien à faire, prochaine action à t5 ». Le conducteur général (réalisateur, toutes caméras) garde mesures et repères.

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

Sur la timeline : selon l'outil choisi, clic sur une case = ajouter/retirer l'instrument, gomme ou solo ; clic sur un numéro de mesure = y aller, double-clic = couper/rétablir la mesure.

## Limites actuelles

- Les reprises et D.C./D.S. ne sont pas dépliées : la partition est lue dans l'ordre écrit (utilisez les mesures coupées si besoin).
- La résolution est la mesure (un instrument « joue » dans une mesure s'il a au moins une note, hors notes de repère/cue).
- Les tops sont posés au début d'une mesure.

## Tests

```bash
npm test
```
