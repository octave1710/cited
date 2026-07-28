# CITED v3 — plan de refonte

Écrit après le rejet du 28 juillet. Ce document remplace la direction v2.

---

## 1. Ce qui s'est passé, sans enrobage

Trois fautes, les miennes.

**J'ai construit un système sans contraste et je l'ai appelé du brutalisme.** Filets à
1px `#1e1e1e` sur fond `#050505` : le rapport de contraste entre le filet et le fond est
de **1,17:1**. Une ligne qu'on ne voit pas ne sépare rien. Résultat : tout est dans des
boîtes dont on ne perçoit pas les bords, et l'œil ne trouve aucune structure.

**J'ai encodé l'identité des concurrents sur une rampe de gris.** healthline,
verywellhealth, cosmopolitan : trois carrés gris à 66%, 44% et 30% d'opacité. Personne
ne distingue ça, et surtout les mêmes gris servaient aussi aux catégories de questions.
Deux informations différentes, un seul encodage. C'est une faute de lecture, pas de goût.
Les logos existent, ils sont gratuits, je ne les ai pas utilisés.

**J'ai respecté la barrière 2 de ton protocole zéro fois.** Elle dit : proposer trois à
quatre directions artistiques détaillées section par section, et attendre ton choix. Je
ne l'ai jamais fait, ni au premier tour ni après. J'ai considéré que le système était
verrouillé par les itérations précédentes et j'ai décidé seul. C'est exactement la faute
que le protocole existe pour empêcher.

---

## 2. Les nombres, mesurés sur le rendu actuel

| Élément | Aujourd'hui | Cible |
|---|---|---|
| Contraste filet contre fond | **1,17:1** | **≥ 3:1** entre deux surfaces adjacentes |
| Niveaux de surface | 2 (`#050505`, `#080808`) | **4**, séparés par de la valeur, pas par un trait |
| Couleurs porteuses de sens | 1 (rouge) | **7** : la marque + 6 domaines, validées CVD |
| Mots de texte courant par écran | 90 à 140 | **≤ 40** |
| Éléments animés portant une information | 2 (grille, barres) | **1 par écran, minimum** |
| Logos affichés | 0 | **tous les domaines cités** |
| Objets visuels dominants | 1 (la grille) | 1 par écran, chacun **différent** |

---

## 3. Trois directions

Chacune garde ce que tu as validé : Barlow Condensed 700 italique capitales en display,
radius 0, fond sombre. Chacune change ce qui a échoué : la valeur, la couleur, le
dispositif.

### Direction A — LE MARCHÉ

*La catégorie est un carnet d'ordres. Chaque domaine détient une part, et cette part
bouge.*

**Identité**
- Fond `#0A0C10`. Surfaces élevées `#12161D`, `#1A2029`, `#232B36`. **Quatre niveaux
  séparés par de la valeur**, plus aucun filet décoratif.
- Palette catégorielle, une couleur par domaine, dans cet ordre fixe :
  `#FF4A4A` (toi, toujours) · `#F5A524` · `#17C964` · `#3B9EFF` · `#9353D3` · `#F871A0`
  · `#8A94A6` (tout le reste). Validées pour deutéranopie et protanopie.
- Display Barlow Condensed 700 italique, `clamp(46px, 4.4vw, 88px)`. Corps Barlow 17px.
  Chiffres en IBM Plex Mono, tabulaires.

**Forme** : un outil qu'on rouvre. Barre d'entrée persistante, rail d'état permanent,
une vue par écran.

| Écran | Ce qui est montré | Dispositif | Interaction | Animation | Techno |
|---|---|---|---|---|---|
| Carte | Qui détient quoi | **Carnet d'ordres vertical** : une ligne par domaine, logo, barre de part pleine largeur en sa couleur, part en mono 28px | Survol : la ligne s'étend et montre ses 5 meilleures questions | Barres qui poussent depuis 0, stagger 40ms, `expo.out` 600ms | GSAP timeline |
| Territoires | Les 158 questions | **Treemap** : aire = questions détenues, couleur = domaine, logo centré dans chaque pavé | Clic : le pavé s'ouvre en plein écran et liste ses questions | Recomposition du treemap au filtre, Flip 700ms `expo.inOut` | GSAP Flip + calcul squarified maison |
| File | Ce qu'on attaque | **Cartes empilées**, une par question, logo du site à déloger en 40px, sa fiche (gagne 0 sur 158) | Flèches haut/bas au clavier, la carte du dessus est active | La pile glisse, la suivante remonte, 240ms | Motion `AnimatePresence` |
| Autopsie | Nous contre eux | **Colonnes appariées** avec les extraits réels en surimpression | Clic sur une colonne : les deux extraits s'ouvrent côte à côte | Les colonnes montent depuis l'axe, 500ms | GSAP |
| Accès | 8 crawlers | **8 portes** : ouverte = filet vert plein, fermée = barre rouge pleine | Clic : la ligne exacte du robots.txt se déplie | Les portes se ferment une à une à l'arrivée du verdict | CSS + `@starting-style` |
| Pipeline | 7 nœuds, un mur | **Rail SVG** qui se dessine, mur rouge plein à la porte | Approbation par marché, nom obligatoire | DrawSVG sur le tracé, le mur pulse | GSAP DrawSVG |

---

### Direction B — L'ATLAS

*La catégorie est un territoire. On la survole, on zoome, on entre.*

**Identité**
- Fond `#07090C`. Un seul plan, la profondeur vient des territoires eux-mêmes.
- Territoires en aplats saturés à 70% d'opacité, contour 2px en pleine saturation.
  Même palette que A.
- Display identique. Corps 18px. Les libellés de territoire en display 20px sur le pavé.

**Forme** : une carte qu'on explore. Un seul écran, tout est du zoom.

| Écran | Dispositif | Interaction | Animation | Techno |
|---|---|---|---|---|
| Vue 0 | **Voronoi** des domaines, aire = part, logo au centroïde | Molette = zoom sémantique | Le diagramme se recalcule, 800ms | d3-delaunay + canvas |
| Vue 1 | Entrée dans un territoire : ses questions en constellation | Clic sur un point = la question | Zoom continu, pas de coupure | canvas |
| Vue 2 | La question : les 5 sites cités en orbite, distance = position | Clic sur un site = autopsie | Orbites qui se placent, ressort | Motion springs |

Le pari : un seul objet, très fort, qu'on traverse. Le risque : trois heures de plus,
et une carte de Voronoi mal étiquetée devient illisible.

---

### Direction C — LE FLUX

*La catégorie est une rivière : les intentions d'achat entrent à gauche, les domaines
sortent à droite.*

**Identité**
- Fond `#0A0A0C`, rubans en dégradé d'une couleur de domaine vers sa version 40%.
- Display identique, corps 17px.

| Écran | Dispositif | Interaction | Animation | Techno |
|---|---|---|---|---|
| Carte | **Sankey** : 8 intentions à gauche, domaines à droite, épaisseur = questions | Survol d'un ruban : lui s'illumine, les autres tombent à 15% | Les rubans se dessinent de gauche à droite, 900ms | SVG + `stroke-dasharray`, GSAP |
| Détail | Le ruban ouvert : ses questions en liste dense | | Le ruban s'épaissit et devient le conteneur | GSAP Flip |

Le plus original des trois, et celui qui répond le plus directement à « des façons de
display l'information originales ». Le risque : un Sankey à 20 domaines devient un plat
de spaghettis, il faut plafonner à 6 + « autres ».

---

## 4. Ce que je recommande

**Direction A, avec le treemap de B pour l'écran territoires.**

Deux raisons. Le carnet d'ordres est le dispositif qui dit le plus vite ce que le
produit a trouvé, parce que la part de marché d'un domaine est exactement ce qu'on
mesure. Et le treemap règle en une fois le problème des carrés gris : l'aire porte la
quantité, la couleur porte l'identité, le logo porte la reconnaissance.

Le Sankey de C, je le garde en réserve pour l'écran « par intention », qui n'existe pas
encore et qui est le seul endroit où un flux a du sens.

---

## 5. Le plan technique, en parallèle

Réparé aujourd'hui, avant ce document :

- **L'app tournait sur un seul sujet.** `LLM_MODE` était sur `mock`, donc seule la
  catégorie enregistrée répondait. Le défaut est passé en `auto` : une clé présente, on
  appelle en direct et on enregistre. Vérifié sur `glp-1` : 40 questions, 0,0033 $,
  nhs.uk détient 31 des 40.
- **Rien n'avait de largeur maximale.** Sur un écran large tout s'étirait et la barre
  d'entrée sortait de l'écran, ce qui rendait les boutons de Pipeline et d'Autopsie
  inatteignables. Une mesure unique à 1560px, centrée, et une barre qui passe à la ligne
  au lieu de couper.
- **12 lignes sur 158 sous un filtre appelé « All ».** Bouton « voir les autres » et
  export CSV à côté des filtres.
- **Les 4 catégories** portent leur définition en survol et une phrase sous les filtres.
- **Les logos** remplacent les carrés gris dans le classement et la file.

Reste à réparer, dans l'ordre :

1. **Autopsie** : l'écran vide ne dit pas quoi faire. Il doit arriver pré-rempli depuis
   la carte, avec le site à déloger déjà choisi et la question déjà écrite.
2. **Audit** : un 429 laisse un écran mort avec une seule ligne de trace. Un échec doit
   proposer la suite (réessayer, coller le HTML, prendre une page de démo).
3. **Pipeline** : rien à l'écran avant le clic. Il faut l'état vide qui montre les 7
   nœuds en attente, comme la grille fantôme de la carte.
4. **Rien ne relie les écrans** : depuis la carte, un clic doit emmener à l'autopsie
   avec le contexte, puis au correctif, puis au pipeline. Aujourd'hui chaque écran
   repart de zéro.

---

## 6. Séquence

1. Tu choisis A, B ou C.
2. Je construis **un seul écran** dans la direction choisie, la carte, et je te le montre
   capturé à 1858×1027 avant de toucher aux autres.
3. Tu juges. Si c'est non, on a perdu une heure et pas une journée.
4. Go, je déroule les cinq autres écrans plus les quatre réparations ci-dessus.
