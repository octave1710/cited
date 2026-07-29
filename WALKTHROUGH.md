# CITED — script d'entretien

Pour le call avec les deux managers. Tout ce qui suit est mesuré sur cette machine et
vérifiable en direct. Les chiffres cités sont réels, pas des exemples.

---

# PARTIE 0 — l'ouverture, 90 secondes

> « Le brief dit que vous voulez voir mon jugement, pas mon volume. Donc je commence par
> la décision qui a coûté le plus cher : j'ai jeté la première version de la partie qui
> mesure la visibilité, parce qu'elle était fausse. Je vais vous montrer pourquoi. »

**La première version** demandait à `gpt-4o-mini` : *« quels sites citerais-tu pour cette
question ? »*. Ça produisait un site par question, et rien n'était vérifiable. C'est un
modèle qui décrit son comportement imaginaire.

**Ce qui l'a tuée** : une vraie réponse d'assistant cite **plusieurs** sources, et elles
diffèrent d'un moteur à l'autre. Mesuré sur une seule question : AI Overview 3 domaines,
AI Mode 27, Perplexity 12, ChatGPT 11, Gemini 3. Un propriétaire unique par question est
donc faux par construction.

**Ce que j'ai fait à la place** : interroger les six vrais moteurs.

Si on ne retient qu'une phrase de l'entretien, c'est celle-là.

---

# PARTIE 1 — l'architecture, avant de cliquer

## Le principe qui gouverne tout le code

**Tout ce qui est affiché doit être vérifiable en dehors de l'outil.** Trois conséquences
concrètes, et elles sont dans le code, pas dans le discours :

1. Une question est une phrase qu'on retape dans un assistant.
2. Une ligne de `robots.txt` est citée mot pour mot depuis un fichier public.
3. Une phrase de comparaison est extraite de la page telle quelle, jamais paraphrasée.

Corollaire : **quand une donnée manque, le trou reste visible**. Le générateur de
corrections émet un emplacement `[SOURCED STAT]` et compte la correction comme *refusée*
plutôt que d'inventer un chiffre.

## La carte du dépôt

```
engines/     la mesure : six moteurs, le tableau, le teardown, les exports
engine/      le Case 1 : ingestion, parsing, neuf facteurs, corrections, schema
autopsy/     le bonus du Case 1 : résolution de la page concurrente, comparaison
pipeline/    le Case 2 : sept nœuds, la porte, le contrôle d'originalité
adapters/    la frontière LLM, avec ses modes réel / rejeu / auto
lib/         zip sans dépendance, sqlite, sujet partagé, persistance d'écran
app/         Next 16, quatre écrans et les routes API
```

## Le stack, et pourquoi

| Choix | Raison |
|---|---|
| Next 16 App Router | routes API et écrans dans un dépôt, streaming NDJSON natif |
| `node:sqlite` | pas de `better-sqlite3` : pas de toolchain de compilation sur cette machine, et une dépendance native est une dette pour qui reprend le projet |
| Écrivain ZIP maison | 120 lignes, CRC32 et en-têtes locaux. Une dépendance de moins pour produire un livrable |
| vitest | 240 tests, chacun échouant si le défaut qu'il documente revient |
| GSAP + Motion | animation d'arrivée qui porte l'information, pas de la décoration |
| Playwright | second recours de lecture, voir plus bas |

---

# PARTIE 2 — la démo, écran par écran

## Écran 1 — BOARD. « Qui est cité, réellement »

### Ce que tu tapes
Un sujet. Un domaine, facultatif. Un marché parmi neuf. Le nombre de questions à poser.

### Ce que tu dis en tapant
> « Le sujet peut être n'importe quelle catégorie. Le champ marque est optionnel : l'outil
> répond même sans marque, parce que la question "qui gagne dans ma catégorie" se pose
> avant d'avoir un client. »

### Ce qui se passe, dans l'ordre

**Étape 1, les questions.** Huit angles d'achat, chacun demandant N questions au modèle,
dédupliquées sur une forme normalisée. Coût mesuré : **1,3 cent** pour ~160 questions.

> **Si on te demande pourquoi un LLM ici et pas ailleurs :** écrire les questions qu'un
> acheteur pose est exactement ce pour quoi un modèle de langue est bon, et personne ne
> prétend que ce sont des volumes de recherche. Elles sont lisibles et éditables à l'écran.
> Mesurer qui est cité est l'inverse : ça demande une observation, pas une génération.

**Étape 2, les six moteurs.** Cinq passent par un seul acteur Apify qui les expose en
add-ons : `aiOverview`, `aiModeSearch`, `perplexitySearch`, `chatGptSearch`, `geminiSearch`.

> **Détail technique à garder sous le coude :** chaque add-on est un **objet**, pas un
> booléen. Passer `true` renvoie un HTTP 400. Ça m'a coûté un aller-retour.

**Claude est le sixième** et n'est pas un add-on de cet acteur. Il est appelé à la source,
sur l'API Anthropic Messages avec l'outil `web_search`, **en parallèle** de l'acteur :
l'acteur prend des minutes, ces appels prennent des secondes, les enchaîner n'ajouterait
que de l'attente. C'est la seule lecture de première main des six.

**Étape 3, le tableau.**

### Le dispositif, et pourquoi il encode trois choses séparément

> « Un total unique cacherait le constat central. »

| Encodage | Ce qu'il dit |
|---|---|
| **Blocs verts** à gauche | combien de moteurs citent ce site |
| **Carrés bleus**, aire en racine carrée | combien de fois, par moteur |
| **Traits ambre** à droite | combien de fois ce site **ouvre** la réponse |

**Le constat qui justifie la séparation, mesuré :** `youtube.com` a la plus grosse part de
citations d'un panel et **zéro première place**. Être cité et être la source sur laquelle
le moteur s'appuie sont deux résultats différents.

> **Pourquoi la racine carrée :** l'aire est lue comme une quantité. Un côté linéaire fait
> lire un 9 comme neuf fois un 1 alors que l'œil lit le carré.

### Les chiffres d'en-tête
`5/10`, `19/65` : le premier est ce que les lignes affichées contiennent, le second est
tout ce que ce moteur a donné. **Additionne la colonne, tu tombes sur le premier chiffre.**
Invite le recruteur à le faire.

### Le consensus
Les domaines cités par **tous les moteurs qui ont répondu**. Pas tous les moteurs définis :
Gemini se tait souvent, et exiger sa voix viderait l'ensemble pour une raison sans rapport
avec les domaines comparés.

### La section WHY

**Comment la cible est choisie**, et c'est écrit à l'écran : **premières places d'abord**,
puis portée moteur, puis volume. Pas le plus gros volume.

> **Anecdote à raconter :** le tri initial était sur la portée. Sur un panel réel il a
> désigné `smytten.com`, huit citations et **zéro** première place. Un domaine sur lequel
> les moteurs ne s'appuient jamais n'apprend rien sur comment être choisi.

**Trois facteurs, trois dispositifs différents**, chacun nommant son dénominateur :
- **Portée moteur** — un coin, aire en racine carrée
- **Premières places par intention** — un escalier, en ambre
- **Nommé sans être cité** — un peigne de 22 traits

**Le troisième est le plus commercial.** Mesuré : *Simple* est nommée dans 8 réponses sur
les 5 moteurs, avec son propre domaine cité **1 fois**. *CeraVe* nommée dans 5, cité **0**.
Sur un autre panel, **5 marques sur 6** nommées dans les réponses l'étaient avec zéro
citation de leur site.

> **Ce que ça prouve, et c'est le cœur de l'argument :** le levier n'est pas le balisage
> on-page. C'est d'être nommé sur la page de quelqu'un d'autre.

**Les deux colonnes du bas.** Ce qu'un client peut copier, et ce qu'aucune page n'achètera.
La seconde existe pour qu'on ne vende jamais à un client un plan pour devenir Reddit.

**La ligne d'honnêteté, qui reste visible :** *« This teardown answers 3 of the 9 designed
factors. The other 6 need a page fetch, a second engine run, or are not measurable at all »*,
avec les six nommés.

> « Je préfère qu'un outil déclare ce qu'il n'a pas mesuré plutôt qu'il donne un score sur
> neuf facteurs dont six sont devinés. »

### Le téléchargement
`citations.csv`, `board.csv`, `gaps.csv`, `brief.md`, `README.txt`. Tout construit depuis
les chiffres du run.

---

## Écran 2 — AUDIT. Le Case 1

### L'ingestion
Une URL, **ou du HTML collé**. Le brief le demande explicitement.

**Le garde SSRF, à raconter si on te demande la sécurité.** J'ai trouvé trois
contournements en me testant :
- `[::ffff:127.0.0.1]` et `2130706433` sont des écritures légales de localhost
- une URL publique répondant `302` vers `169.254.169.254`, l'endpoint de métadonnées cloud

Donc : parsing réel de l'adresse, résolution DNS, et **redirections suivies à la main**
avec revalidation de l'hôte à **chaque** saut. `redirect: "follow"` valide la première URL
puis va où on l'envoie.

### Le second recours, et pourquoi ce n'est pas de la triche

Trois sites répondaient 403 à toute lecture automatique, y compris leur propre robots.txt.
**Mesuré, dans cet ordre :**

| Route | mayoclinic.org | bmj.com | nutrition.org |
|---|---|---|---|
| `fetch` déclaré CITEDBot | 403 | 403 | 403 |
| Navigateur **headless** | 403 | 403 | 403 |
| **Chrome fenêtré** | **200, 1 151 mots** | **200, 3 915 mots** | **200, 482 mots** |

> « Le mur ne détecte pas "es-tu un robot", il détecte "es-tu headless". Falsifier le
> user-agent n'aurait rien donné. Ouvrir la page dans Chrome n'est pas une usurpation :
> c'est Chrome qui est Chrome. Et la route utilisée est affichée sur chaque résultat,
> parce qu'un site qui sert les humains et refuse les lecteurs automatiques est
> probablement invisible pour les moteurs aussi. C'est un constat, pas un contournement. »

Le garde DNS est appliqué sur **chaque requête que le navigateur émet**, pas seulement sur
la navigation principale.

### Les neuf facteurs

Chacun porte **son poids et sa source publiée**. Structure de réponse 24 %, citations
sourcées 20 %, spécificité chiffrée 18 %, fraîcheur 14 %, autorité hors site 12 %, fan-out
8 %, rang Google 3 %, données structurées **1 %**.

> **Le 1 % est le détail qui montre le jugement.** Une étude sur 1 885 pages n'a trouvé
> aucun effet causal du balisage. Je le génère quand même pour l'hygiène, et je le pèse à
> 1 % au lieu de raconter que c'est important.

Et la **crawlabilité est une porte binaire**, pas un facteur pondéré. Un moteur qui ne peut
pas lire la page ne peut pas la citer, quels que soient les huit autres.

### Le dispositif : l'échelle de poids
La largeur d'une bande est ce que vaut le facteur, le remplissage est ce que la page a
gagné. **Le vide EST le score manquant, à l'échelle.** Sur `healthline.com`, l'œil tombe sur
la bande de 20 % entièrement sombre avant de lire un chiffre : citations sourcées à 0/100,
qui coûte exactement 20 des 54 points manquants.

### Les corrections
Chacune nomme la phrase qu'elle remplace. **Celles qui réclament un chiffre ou un expert
nommé ne sont pas inventées** : elles reviennent dans `facts-needed.csv`, une ligne par
refus, avec la phrase de sa propre page que la réponse remplacerait.

> **Détail à assumer si on te le demande :** l'ordre est `impact × (6 − effort)`, donc
> impact contre effort, pas impact seul. C'est le bon arbitrage commercial, et les deux
> colonnes sont affichées pour qu'on puisse en juger.

### La boucle fermée
Sur la page échantillon du dépôt : **33 → 81**, avec **toutes** les corrections de fond
refusées faute de fait fourni. Le refus est la fonctionnalité.

> **Pourquoi une page du dépôt et pas une vraie :** on ne peut pas publier un correctif sur
> `nhs.uk`. La boucle appliquer-puis-re-tester ne peut se fermer que sur une page qu'on
> contrôle. C'est étiqueté comme tel à l'écran.

---

## Écran 3 — AUTOPSY. Le bonus du Case 1

### Comment la page concurrente est trouvée
**Le sitemap du site d'abord.** Chaque URL qu'il contient est une page que le site a publiée.

> **L'anecdote qui explique la décision :** la première version demandait au modèle de
> nommer l'URL. Pour une question GLP-1 sur BMJ il a produit trois chemins
> `/content/377/bmj.n246x`. **Aucun n'existe.** Un modèle retient la *forme* des URL d'un
> éditeur, pas lesquelles existent.

**Trois faux positifs, chacun pire qu'un échec**, et les trois gardes qui en sortent :
- « work » a matché `worksop-pharmacy` → correspondance sur **segment entier**
- « effects », sept lettres, a matché `/antibiotics/side-effects/` → un jeu de mots
  **génériques** que la longueur ne suffit pas à écarter
- « vitamin C » a perdu son C et matché `vitamin-b` → **paires adjacentes**, et si une URL
  porte le composé, celles qui ne portent que « vitamin » sont écartées

Et si le modèle est quand même sollicité, `onTopic()` vérifie que le titre et l'adresse
portent un mot discriminant. Il a refusé une page sur le **diabète de type 1** proposée
pour une question vitamine C, qui se chargeait en 200 avec 736 mots.

### La contradiction que j'ai corrigée
Le titre disait « ils gagnent sur X » au-dessus de deux cartes montrant **41 pour notre
page contre 27 pour la leur**. Les deux étaient vrais et rien ne les réconciliait.

> « Un moteur cite un **passage**, pas une page. Une meilleure page peut donc perdre le
> passage. C'est écrit à l'écran maintenant. »

### Le dispositif : bandes affrontées
Un axe, leur page pousse à droite, la tienne à gauche. Une égalité est un marqueur scindé,
et une égalité **à zéro** est un talon fixe, parce qu'une bande de largeur nulle se lit
comme une donnée manquante.

---

## Écran 4 — PIPELINE. Le Case 2

### Les huit étapes du brief, et où elles vivent

| Étape | Où | Ce qui se passe |
|---|---|---|
| Input | `app/pipeline/page.tsx` | sujet + marchés, plafond à six |
| Ancrage par marché | `fixtures/grounding.json` | UK 40 500/mois, SE 6 600, DK 3 200 |
| Brief | `pipeline/run.ts` | chaque angle cite sa ligne d'ancrage |
| Rédaction | `pipeline/run.ts` | jeu de questions **par marché, dans sa langue** |
| Optimisation | `engine/score.ts` | **le moteur du Case 1, importé** |
| Localisation | `pipeline/run.ts` | hreflang + lignes marquées pour relecture |
| Porte qualité | `pipeline/originality.ts` + gate | score, plagiat/IA, approbation nommée |
| Sortie CMS | `pipeline/run.ts` | markdown, métadonnées, hreflang |

### Le point d'ancrage, à montrer lentement
> « La traduction littérale *vitamin c serum* fait **480** recherches en Suède.
> *c-vitaminserum*, en un mot, en fait **6 600**. **14 contre 1.** Une page qui cible la
> traduction cible un terme que personne ne tape. Et le danois **sépare** là où le suédois
> **compose**. Trois marchés, trois pages, pas une page traduite trois fois. »

### La porte qualité, et l'honnêteté du contrôle plagiat/IA

Le brief demande « plagiarism / AI-detection checks ». **Ce que je refuse d'affirmer est le
sujet.**

> « Il n'y a pas de vérification de plagiat honnête sans corpus, et aucun classifieur ne
> peut dire qu'un passage a été écrit par une machine à un taux de faux positifs
> présentable. Donc je n'affirme ni l'un ni l'autre. »

Ce qui est mesuré, local et vérifiable à la main :
- **recouvrement en séquences de 8 mots** entre chaque brouillon et ses frères, avec la
  plus longue suite partagée **citée**
- **les tournures qui survivent à un brouillon non édité**, comptées, chacune avec sa phrase

**L'anecdote qui vaut de l'or :** le contrôle a immédiatement rapporté **95 % de
recouvrement** entre UK, SE et DK. Il avait raison. Mon générateur produisait quatre
paragraphes anglais identiques et changeait le mot-clé. *Adaptation, not translation* n'était
ni l'un ni l'autre.

**Après correction : 95 % → 0 %.** Chaque marché a son jeu de questions, sa langue, son angle :
- **SE** : quatre heures de jour en décembre, l'argument UV est faible, l'angle est la
  pigmentation sur l'année
- **DK** : le règlement cosmétique européen interdit les allégations médicamenteuses, donc
  reprendre la copie britannique est un problème de **conformité**

> « L'outil a attrapé mon propre pipeline en train de faire exactement ce que le brief
> reproche à "just use AI to generate it". C'est la meilleure preuve que le contrôle sert
> à quelque chose. »

### Les trois refus, que le brief demande explicitement

| Refus | Où c'est appliqué |
|---|---|
| Publier sans nom, par marché | `publish()` lève, la route renvoie **409** |
| Signature anonyme | la route d'approbation renvoie **400** |
| Deviner un marché | pas d'ancrage, arrêt net avec la raison |
| Déployer une localisation | hreflang **proposé, jamais poussé** |

> « Le refus est dans la logique métier, pas derrière un bouton désactivé. Appelez
> l'endpoint de publication directement, vous prenez un 409. »

---

# PARTIE 3 — les questions qu'ils vont poser

**« Pourquoi Apify et pas les API directes ? »**
Perplexity et Gemini ont des API, mais AI Overview et AI Mode n'en ont pas. Un acteur qui
expose les cinq en add-ons, c'est une intégration au lieu de cinq, et une seule facture.
Claude n'y est pas, donc je l'appelle à la source. Le seam est `engines/run.ts` : remplacer
l'acteur par des API directes ne touche pas le reste.

**« Combien ça coûte, et est-ce que ça passe à l'échelle ? »**
2,5 centimes par question sur les six moteurs, mesuré. Le panel est un sous-ensemble **par
construction** : les 160 questions coûteraient quatre dollars et prendraient une heure.
L'écran dit combien ont été posées et liste celles qui ne l'ont pas été.

**« Qu'est-ce qui est réel et qu'est-ce qui est simulé ? »**
Réel : les six moteurs, les fetch de page, le scoring, les corrections, le schema, le zip.
Simulé : les volumes de recherche par marché, qui viennent d'un fixture étiqueté comme
échantillon enregistré. Le brief autorise explicitement « real data or a realistic mock ».

**« Qu'est-ce que vous feriez avec une semaine de plus ? »**
1. Extraire un `GroundingClient` derrière une interface comme la frontière LLM, pour brancher
   DataForSEO ou Semrush par configuration au lieu d'un `readFileSync`.
2. Câbler le re-test sur les vraies questions de la carte et les vrais concurrents cités,
   au lieu du jeu de requêtes gabarit actuel.
3. Un facteur *clarté d'entité* dédié : le sujet du H1 apparaît-il dans les 100 premiers
   mots, le nom est-il constant, y a-t-il un nœud `Organization` avec un `sameAs`.

**« Comment vous avez utilisé l'IA pour construire ça ? »**
Claude Code, en boucles courtes avec des sous-agents adverses : je fais relire chaque
affirmation par un agent dont la consigne est de la **casser** en lisant le code. C'est
comme ça que j'ai trouvé le hreflang ukrainien, les titres anglais sur les pages nordiques,
et le fait que le titre d'un écran nommait un domaine pendant que la section en dessous en
démontait un autre.

**« Qu'est-ce qui est faible ? »**
Trois choses, et je les dis avant qu'on me les demande :
- La carte enregistre ce qu'un moteur **cite aujourd'hui**, pas ce qu'il indexera demain.
- L'autorité hors site est un **indicateur de substitution** on-page, écrit à l'écran sur
  la ligne concernée.
- Le pipeline tourne sur **un sujet ancré**, sur trois marchés. Le plafond de six est dans
  le code, pas dans les données.

---

# PARTIE 4 — l'ordre de la démo, 12 minutes

| Temps | Écran | Le point à faire passer |
|---|---|---|
| 0:00 | — | « J'ai jeté la première version parce qu'elle était fausse » |
| 1:30 | **BOARD**, run live | six moteurs, vraies citations, le tableau se remplit |
| 4:00 | **BOARD**, le WHY | nommé sans être cité : le levier n'est pas on-page |
| 6:00 | **AUDIT** | l'échelle de poids, le vide EST le score manquant |
| 8:00 | **AUDIT**, corrections | la correction refusée faute de fait fourni |
| 9:30 | **PIPELINE** | 480 contre 6 600, puis le mur et le 409 |
| 11:30 | — | ce que je ferais avec une semaine de plus |

**Ne pas montrer** : la route `/map`, retirée de la navigation. Elle porte l'ancienne
méthode invalidée.

---

# ANNEXE — les chiffres à connaître par cœur

| | |
|---|---|
| Moteurs interrogés | **6** |
| Coût par question, six moteurs | **~2,5 cents** |
| Coût des ~160 questions écrites | **1,3 cent** |
| Run de démo, 8 questions | **0,229 $**, ~4 min |
| Tests | **240**, typecheck et build propres |
| Boucle fermée sur la page échantillon | **33 → 81** |
| Suédois : traduction littérale vs terme réel | **480 vs 6 600** |
| Recouvrement inter-marchés, avant / après | **95 % → 0 %** |
| Poids des données structurées | **1 %**, étude sur 1 885 pages |
