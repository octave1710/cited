# HANDOFF — Shopify in-session @ The Lighthouse · build event

**Pour une session Claude Code neuve dans `C:\Users\octav\Documents\precis-case`.**
Écrit le 2026-07-26. Événement : **lundi 27 juillet, 16h-21h**, The Lighthouse Brooklyn, 58 Kent St. Gratuit, **filmé**, laptop obligatoire.

---

## 0. LIRE D'ABORD, DANS CET ORDRE
1. Ce fichier en entier.
2. `GOAL.md` → l'état de CITED, la checklist D1-D13, et surtout la section **"Design constraints (hard, from repeated rejections)"**.
3. `design/DESIGN_PLAN.md` → le système visuel validé. **Ne rien réinventer.**
4. La mémoire projet locale de Claude Code pour ce dossier (préférences de voix, rejets design d'Octave).

**Qui est Octave :** marketing engineer franco-américain à Brooklyn, ex-Hermès (Data & Performance, 12 marchés). Diplômé le 28/08/2026. Deux objectifs simultanés : décrocher son premier client e-commerce payant, et un poste en marketing IA dans une startup à SF.

---

## 1. LES DEUX OBJECTIFS DE LA SOIRÉE (tout découle de ça)

**A. Trouver des propriétaires de boutiques Shopify / marques e-commerce** qui, en voyant la démo, se disent "il me faut ça".
**B. Impressionner les équipes partenaires**, par ordre de priorité : **Vercel**, puis **Perplexity**, puis Replit, pour qu'ils se disent "il nous faut ce gars".

Personnes présentes :
- **Shopify** : Dominic Coryell (Director of Product, ex-Meta/Instacart, co-fondateur Talkable), Nick Nehaul (Senior PM Growth, ex-JPMorgan)
- **Perplexity** : Ian Sampson, Jenny Sung
- **Replit** : Asif Bhatti, Aman Mathur, Horacio Lopez
- **Vercel** : Matt Lewis, Laura Colagrande, Alli Pope

Déroulé : 16h portes → 17h session "Build with AI" au théâtre → **18h30 build ouvert, formation d'équipes** → 21h fin.
➡️ **Seulement ~2h30 de code sur place.** Le dur doit être fait avant. Le brief l'autorise explicitement : *"An idea or project in mind is a bonus."*

---

## 2. LA DÉCISION STRATÉGIQUE (arbitrée, ne pas rouvrir)

**On forke CITED. On ne repart PAS du creative strategist engine du hackathon précédent.**

Pourquoi :
- Le creative engine produit du **goût**, qui est discutable. VYQRA vient de rejeter des créas d'Octave sur exactement ce motif ("won't work with the direction and positioning we're going for"). Dans une salle bruyante avec 90 secondes d'attention, une belle image se juge lentement et se conteste vite.
- CITED produit une **perte constatable** : la question qu'un client pose à ChatGPT/Perplexity, et le nom du concurrent qui est recommandé à sa place.
- **Perplexity est dans la salle.** Un outil qui mesure si une boutique est recommandée par les moteurs de réponse est leur sujet, pas de la flatterie.
- Le système de design est **déjà validé** par les rejets d'Octave, donc zéro risque esthétique.

### Le pivot exact
CITED audite aujourd'hui **une URL** pour sa visibilité dans les moteurs de réponse.
On le forke en **audit de rayon pour boutique Shopify** : au niveau **produit**, pas au niveau page.

### L'arme secrète
**Presque toutes les boutiques Shopify exposent publiquement `/products.json`** (ex. `boutique.com/products.json`). Pas d'auth, pas de clé, pas de permission. Donc on peut lancer la démo sur la boutique de **n'importe qui dans la salle**, en direct, en deux secondes.
⚠️ Certaines boutiques le bloquent → prévoir un repli (sitemap.xml, ou scrape de la page collection).

---

## 3. ⚠️ LE CONTRAT DE VÉRIFIABILITÉ (la partie la plus importante de ce document)

**Octave a explicitement rejeté la première version de la démo parce qu'elle s'auto-notait.** Sa critique, mot pour mot : un outil qui réécrit la page en mémoire, redemande au moteur, et s'attribue la victoire, produit *"un simple chiffre qui augmente on ne sait comment sur des metrics que l'average business owner ne ressent pas"*. Il déteste ce pattern par-dessus tout : des outputs sans valeur réelle, aucune action agentique véritable, tout reste superficiel.

**Les quatre règles qui en découlent, non négociables :**

### R1 — Le "avant" doit être vérifié par le propriétaire, pas affirmé par l'outil
On ne montre **jamais un score** comme argument principal. On montre **la question d'achat, la réponse réelle du moteur, et le nom du concurrent recommandé**. Le propriétaire sort son téléphone, tape la même requête dans Perplexity, et le constate lui-même en dix secondes. Il ne nous croit sur rien.
Le chiffre agrégé ("tu apparais dans 2 des 12 questions") n'est qu'un résumé de lignes qu'il peut recompter une par une à l'écran.

### R2 — Il repart avec des artefacts déployables, pas avec un rapport
Trois livrables concrets, dont deux existent déjà dans le code :
1. **Le bloc JSON-LD** valide, prêt à coller dans son thème → `engine/schemaGen.ts`.
2. **La fiche produit réécrite**, avant/après, prête à coller dans Shopify → `engine/fixes.ts`.
3. **Le bloc de contenu qui répond à la question perdue** (paragraphe comparatif ou FAQ). À produire.
Il doit pouvoir tout déployer lui-même le soir même, sans Octave.

### R3 — Le "après" se démontre sur un artefact réel, jamais en mémoire
**Interdit :** patcher le HTML en RAM, redemander au LLM, annoncer une amélioration.
**Obligatoire :** publier la page corrigée sur une **vraie URL live** (Vercel, pendant l'événement), puis relancer la requête **en donnant au moteur le choix entre la page actuelle et la page corrigée, les deux réellement accessibles**. `runLab(target, competitors, queries, llm)` prend déjà les concurrents en paramètre, donc l'architecture le permet.
Formulation exacte à l'écran et à l'oral : *"voilà la version corrigée, elle est en ligne à cette adresse, la machine la choisit maintenant. Pour l'avoir sur ta boutique, tu colles ces deux blocs."*
Le propriétaire peut refaire ce test lui-même.

### R4 — Ce qu'on ne prétend JAMAIS
Pas de "ton trafic va augmenter de X%". Pas de "tu apparaîtras dans Perplexity demain". Les moteurs recrawlent quand ils veulent. On démontre le **mécanisme** et on livre les **pièces**. Aucune donnée inventée : les chiffres manquants restent des emplacements vides visibles (règle déjà dans `GOAL.md`).

---

## 4. LA DÉMO, TEMPS PAR TEMPS (90 secondes, sur la boutique d'un inconnu)

1. Un propriétaire donne son domaine.
2. Son **vrai catalogue** apparaît, tiré de `/products.json`, sous ses yeux.
3. L'outil génère **les vraies questions d'achat** de sa catégorie (intention comparative, pas du contenu).
4. Il les envoie à un moteur de réponse réel.
5. L'écran affiche, ligne par ligne : la question, **qui est recommandé**, et si lui y est. Les noms des concurrents sont l'élément central.
6. **Le propriétaire vérifie une ligne sur son propre téléphone.** C'est le moment qui vend.
7. Il clique sur une question perdue → pourquoi (pas de données structurées, pas de contenu comparatif, aucun avis exposé, aucune donnée chiffrée citable).
8. Clic → **la page corrigée est publiée en live**, le test est refait avec les deux pages réelles, le moteur choisit la corrigée.
9. Il repart avec les trois artefacts (§3 R2) et Octave repart avec son domaine.

Le point 5 est le coup au ventre (voir un concurrent nommé à sa place). Le point 6 est ce qui rend tout indiscutable. Le point 8 est le choc de clôture.

---

## 5. CE QUI EXISTE DÉJÀ ET QU'ON RÉUTILISE

| Pièce | Fichier | Rôle dans la nouvelle démo |
|---|---|---|
| Moteur de scoring 9 facteurs | `engine/` (`factors/`, `score.ts`) | Le "pourquoi" d'une question perdue. **Ne pas réécrire la logique ni les poids** (interdit par GOAL.md). |
| Génération de correctifs avant/après | `engine/fixes.ts` → `generateFixes()` | Artefact livrable n°2 |
| Génération JSON-LD | `engine/schemaGen.ts` → `generateSchemas()` | Artefact livrable n°1 |
| Application des correctifs au HTML | `engine/apply.ts` | Sert à produire la page corrigée à publier |
| Test contre moteur de réponse **avec concurrents** | `querylab/run.ts` → `runLab(target, competitors, queries, llm)` | Le cœur. Les concurrents sont déjà de première classe. |
| Fan-out de requêtes | `querylab/fanout.ts` | **À réécrire pour le commerce** (voir §6) |
| Adaptateur LLM | `adapters/llm.ts` | `LLM_MODE=mock|real` |
| Adaptateur Profound | `adapters/profound.ts` | **Secondaire seulement**, voir avertissement §8 |
| Routes API | `app/api/runs/[id]/{querylab,fixes,schema,retest,truth}` | `/retest` existe déjà |
| Persistance | `lib/db.ts` (SQLite, `data/cited.db`) | Recharger un run par id |
| Streaming | `lib/stream.ts` | Le fan-out est long, il doit streamer |
| Système de design validé | `design/DESIGN_PLAN.md` + `design/mockups/variant-b-brutalist.html` | **Référence unique. Zéro nouveau design.** |
| Tests | `vitest`, 26 tests existants | `npm run verify` |

---

## 6. CE QU'IL FAUT CONSTRUIRE, DANS L'ORDRE

### Bloc 1 — ce soir (3 à 4 heures maximum, ne pas se cramer)
1. **Adaptateur catalogue Shopify** : `adapters/shopify.ts`, lit `{domaine}/products.json`, renvoie titres, descriptions, variantes, prix, URLs produit. Repli sur `sitemap.xml` si bloqué. ~40 lignes. Gérer proprement l'échec (règle D12 : jamais de crash blanc).
2. **Réécrire `fanout()` pour l'intention d'achat.** L'actuel est façonné pour du contenu (*"what is X and does it actually work"*). Il faut du comparatif d'achat réel, dérivé de la catégorie du catalogue :
   - `best {catégorie} for {cas d'usage}`
   - `{catégorie} that {contrainte}` (ex. "protein powder that mixes in water not milk")
   - `{marque} vs {alternative}`
   - `is {marque} worth it`
   - `{catégorie} under ${prix}`
3. **Extraction des concurrents depuis la réponse du moteur.** C'est le cœur émotionnel, à ne pas laisser pour la fin. Récupérer les noms de marques nommées dans chaque réponse.
4. **Enregistrer des fixtures pour 3 boutiques réelles.** NON NÉGOCIABLE (voir §8).

### Bloc 2 — demain matin (2 à 3 heures)
5. **L'écran Rayon** : une ligne par question d'achat, avec qui est recommandé, et si la marque y figure. Dans le système brutaliste existant. **Un bouton d'action à côté de chaque chiffre** (règle dure de GOAL.md : un chiffre sans action, c'est du reporting, et le reporting est rejeté).
6. **Le bundle livrable** : un bouton qui produit les 3 artefacts de §3 R2 en texte copiable.

### Bloc 3 — sur place (18h30-21h)
7. **Déployer sur Vercel en arrivant**, pour démontrer depuis une vraie URL (et c'est un geste qui parle à l'équipe Vercel).
8. **Publier la page corrigée en live** pour le test avant/après honnête de §3 R3. C'est le morceau ambitieux ; si le temps manque, se replier sur une page corrigée pré-publiée sur une boutique de démo, en le disant.
9. Lancer l'outil sur les boutiques des gens présents, **collecter les domaines**.

---

## 7. LES DEUX PLAYS DE NETWORKING (différents, ne pas les confondre)

**Avec les propriétaires** : la démo *est* le pitch, on ne pitche rien. On lance l'outil sur leur boutique, on leur fait vérifier une ligne sur leur téléphone, on leur donne les trois artefacts. Puis "je t'envoie la lecture complète" et on prend le domaine. C'est la machine d'outreach d'Octave, en direct et instantanée.

**Avec Vercel et Perplexity : ne JAMAIS demander un job.** Poser une question technique que seuls eux peuvent répondre, puis montrer ce qui a été construit avec la réponse.
- **Vercel (priorité 1)** : le fan-out est une série d'appels longs → parler streaming et edge, et leur montrer l'outil déployé chez eux pendant l'événement.
- **Perplexity (priorité 2)** : comment leur surface shopping choisit les produits qu'elle recommande, quels signaux comptent. C'est une vraie question d'ingénierie, et Octave arrive avec un outil qui la mesure.

---

## 8. TROIS AVERTISSEMENTS DURS

**1. La démo doit fonctionner hors ligne.** L'événement est **filmé** et 200 personnes seront sur le même wifi. Une démo qui dépend d'une API en direct est le pire scénario. Le code a déjà le bon pattern (fixture + dégradation annoncée honnêtement, jamais de substitution silencieuse). **Enregistrer les fixtures ce soir**, garder le mode réel pour l'effet quand ça passe.

**2. Sortir Profound de la colonne vertébrale.** Le commentaire de `adapters/profound.ts` le dit : HTTP 403 quand le compte n'est pas habilité sur un domaine. Donc **Profound ne peut pas fonctionner sur la boutique d'un inconnu**. À garder comme couche de crédibilité sur une marque déjà habilitée, jamais comme dépendance de la démo live. C'était le piège du plan initial d'Octave.

**3. Une seule chose nouvelle.** Un écran, une perte constatable, un avant/après réel. Tout le reste est du bonus qui mène à une démo cassée.

---

## 9. CONTRAINTES DESIGN (extraites de GOAL.md, à respecter au mot)

- C'est **une app, pas une page qui scrolle**. Barre d'input persistante, état de run visible, **un bouton d'action à côté de chaque chiffre**.
- **Aucun texte de contenu en gris.** Le contenu est en encre pleine. Le gris est réservé aux dates, unités, sources, en-têtes de colonnes.
- **Un seul accent** dans toute l'app : rouge `#FF3B3B`, remplissage bouton `#D81E1E`. **Zéro bleu.**
- Le propos de chaque écran est un **vrai titre en encre pleine**, jamais un petit label mono gris.
- Pas de numéros d'index décoratifs, pas de murs de lignes uniformes, rien collé au bord.
- Chaque donnée affichée porte une ligne courte en langage simple disant ce qu'elle mesure. Les requêtes réelles s'affichent en casse de phrase, jamais en capitales mono.
- Direction : brutalisme technique. Fond `#050505`, encre `#ECEBE7`, Barlow Condensed 700 italique capitales pour le display, Barlow pour le corps, IBM Plex Mono pour les labels, radius 0, filets 1px `#1e1e1e`.
- Interdits : Aceternity/Magic UI/React Bits, Inter/Roboto/Open Sans/Playfair, tout bleu.
- Motion : GSAP pour scroll/canvas, Motion pour les micro-interactions, jamais les deux sur un même élément. Tout sous `prefers-reduced-motion`.

**Checkpoints humains obligatoires** (l'esthétique n'est pas vérifiable par machine, Octave juge) : montrer les pixels rendus (a) au premier écran Rayon complet, (b) au premier avant/après qui fonctionne.

---

## 10. COMMANDES ET ENVIRONNEMENT

```bash
npm run dev        # Next.js
npm run verify     # typecheck + vitest + build  (à faire passer avant de livrer)
npm run test
npm run audit      # CLI existant
```

`.env` (voir `.env.example`, **ne jamais committer**) :
```
PROFOUND_API_KEY=...     # secondaire, voir §8
ANTHROPIC_API_KEY=...    # Query Lab en réel
LLM_MODE=mock            # mock = fixtures hors ligne | real = appels live
PROFOUND_MODE=mock
DATABASE_PATH=./data/cited.db
FIXTURES_DIR=./fixtures
```

---

## 11. RÈGLES DE TRAVAIL AVEC OCTAVE

- **Brique par brique.** Fin de brique = stop, démo, feu vert explicite. Ne pas enchaîner en autonomie sur du sensible.
- **Sur le goût, boucles courtes.** Montrer les pixels, il juge.
- **Jamais survendre.** Livrer avec le score honnête et la liste de ce qui est faible. L'écart entre le récit et l'artefact est une faute de qualité.
- **Un blocage se remonte avec une tentative de solution**, jamais un flag seul.
- **Vocabulaire simple, aucun acronyme non expliqué.** Dire "la base de connaissances (le dossier _kb)", pas "le KB".
- **Aucun chiffre non vérifié.** Test de troncature obligatoire sur tout scrape : si `reçu >= demandé`, les données sont tronquées et le total est inconnu. Détail : `MakoAI/SideBusiness_Sandbox/01_Ecommerce_Growth/_CONTEXT/09_DATA_RIGOUR.md`.
- Pas d'em dashes, pas de flatterie, pas de titres ornementaux.

---

## 12. LE PIÈGE À NE PAS REFAIRE

La première version de cette démo a été rejetée parce qu'elle produisait **un chiffre qui monte tout seul**. Avant d'écrire une ligne, se poser la question : *"le propriétaire peut-il vérifier ça lui-même, et repart-il avec quelque chose qu'il peut déployer ?"* Si la réponse est non aux deux, la fonctionnalité ne sert à rien, quel que soit son aspect.
