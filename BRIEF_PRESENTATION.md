# CITED, ce que ça fait et pourquoi

Document de préparation, écrit le 28 juillet 2026. Chaque chiffre ci-dessous a été
mesuré sur cette machine et vérifié une seconde fois par une passe contradictoire qui
a relu le code. Les chiffres que cette passe a invalidés ont été corrigés ici, pas
gardés. La section finale liste ce qui est faible, à dire toi-même avant qu'on te le
demande.

---

## 1. Le problème, en une phrase

Personne ne sait montrer à une marque la liste des questions où un assistant répond
pour sa catégorie et ne la nomme jamais.

**Pourquoi ça compte maintenant.** Une partie de la recherche d'achat se fait
désormais dans un assistant. Un assistant ne rend pas dix liens, il cite une poignée
de sources et rédige la réponse. Soit la marque est une des sources nommées, soit elle
ne l'est pas, et il n'y a pas de deuxième page où être.

**Pourquoi personne ne le voit.** Ce manque à gagner est invisible dans les outils
qu'une agence utilise déjà. Un clic qui n'a pas lieu ne laisse aucune trace dans
l'analytics ni dans les plateformes publicitaires. Rien dans le reporting mensuel ne
dit que ça s'est produit.

**Ce que ça change dans le travail.** L'unité de travail cesse d'être une position sur
un mot clé et devient **une question d'acheteur**. La seule chose qui compte est de
savoir si le site de la marque est nommé dans la réponse à cette question.

---

## 2. Les quatre écrans

### Écran 1, la carte de citation

**Ce que c'est.** Environ 160 questions d'acheteur dans une catégorie, et pour chacune,
quels sites l'assistant nomme comme sources et si la marque en fait partie.

**Ce que tu tapes.** La catégorie dans les mots d'un acheteur, `vitamin c serum`. Le
nom de la marque. L'adresse du site, `theordinary.com`, refusée si ce n'est pas une
vraie adresse. Le marché, parmi neuf, qui détermine **la langue** dans laquelle les
questions sont écrites et répondues.

**Ce que tu repars avec.** Trois fichiers tableur dans un téléchargement.
`citation-map.csv`, chaque question avec chaque site nommé. `unclaimed-questions.csv`,
les questions où aucune page commerciale n'est nommée. `seats.csv`, pour chaque
question non tenue, le site le plus faible à déloger.

**Mesuré en vrai.**

| Run | Résultat |
|---|---|
| `theordinary.com`, vitamin c serum, Royaume-Uni | 2 questions tenues sur 156 |
| `emma-matelas.fr`, matelas, France | 0 sur 40 |
| glp-1, Royaume-Uni | 159 questions, 167 appels, 1,34 cent de modèle, 1,4 s médian par question |

**Pourquoi ça vaut de l'argent.** C'est le livrable que l'agence n'a pas aujourd'hui,
et il coûte un centime, donc il se lance **avant** un rendez-vous de new business. Tu
entres avec 160 questions de la catégorie du prospect et le nom du site qui prend
chacune.

**Le point le plus intelligent de l'écran**, et c'est celui à raconter. La file de
travail ne pointe pas vers le leader, elle pointe vers **le site le plus faible assis
dans une réponse**. Battre le site qui gagne 152 questions, c'est un an de travail.
Prendre le siège d'un site qui n'en gagne aucune ailleurs, c'est une page.

---

### Écran 2, l'autopsie

**Ce que c'est.** Pour une question perdue, l'outil trouve la page exacte du concurrent
qui est citée, note cette page et la tienne sur les neuf mêmes facteurs, et montre quel
écart précis coûte la citation.

**Ce que tu tapes.** Le domaine du concurrent, pré-rempli si tu viens d'une ligne de la
carte. La question exacte. Ton URL, facultative.

**Ce que tu repars avec.** Rien à télécharger sur cet écran. À l'écran: deux cartes de
page avec score et nombre de mots, neuf lignes d'écart sur un axe unique, ordonnées par
l'écart qui coûte le plus, chacune s'ouvrant sur **les phrases exactes** extraites des
deux pages, jamais une paraphrase. Plus la trace de comment la page a été trouvée.

**Pourquoi ça vaut de l'argent.** Ça met fin à la discussion d'opinion dans la salle.
La recommandation cesse d'être l'avis de l'agence sur ce qu'est un bon contenu et
devient une mesure de la page qui gagne réellement. La page du concurrent est trouvée
via **leur propre sitemap**, donc le client peut ouvrir la même adresse et lire les
mêmes phrases. Sur `healthline.com` ça veut dire parcourir deux sitemaps déclarés, le
second contenant 11 252 adresses.

---

### Écran 3, l'audit de page, le plan de correction et le fichier corrigé

**Ce que c'est.** Une adresse de page en entrée, un score sur 100 avec la preuve
derrière chaque point, une liste de réécritures classées, et un fichier contenant la
page avec les corrections sûres déjà écrites dedans.

**Ce que tu tapes.** Une adresse. Plus tard dans le flux, le fichier
`facts-needed.csv` rempli, recollé dans l'outil. C'est **le seul moyen** pour que les
corrections de fond, un chiffre, une citation, un auteur nommé, soient appliquées.

**Ce que tu repars avec.** Un fichier zip. Dedans: `fix-plan.csv`, chaque réécriture
classée avec l'avant, l'après, la raison, et une colonne qui dit si elle réclame un
fait que le client doit fournir. `facts-needed.csv`, une ligne par refus, citant la
phrase de sa propre page que la réponse remplacerait. `robots-patch.txt`, présent
seulement si des robots sont réellement bloqués. `schema.jsonld`. `README.txt` qui dit
ce que le re-test prouve et ce qu'il ne prouve pas. `corrected.html` apparaît une fois
l'étape appliquer et re-tester passée.

**Mesuré.** Sur une page de test, les corrections automatiques seules font passer le
score de 33 à 53, et **toutes** les corrections de fond sont refusées faute d'un fait
fourni. Ce refus est la fonctionnalité, pas un bug.

**Pourquoi ça vaut de l'argent.** C'est la forme qu'une agence facture. Le client
repart avec un fichier corrigé et une liste ordonnée, pas une slide. Et le fichier des
faits transforme ce qui bloque normalement un projet de contenu, obtenir un vrai chiffre
et un expert nommé de la part du client, en un formulaire que son équipe remplit.

Le barème est défendable ligne par ligne: chacun des neuf facteurs porte son poids et
sa source publiée. Structure de réponse 24 %, données structurées 1 %, et ce 1 % est bas
exprès parce qu'une étude sur 1 885 pages n'a trouvé aucun effet causal.

---

### Écran 4, l'accès des robots, les fichiers, et le pipeline multi-marchés

**L'accès.** Un verdict pour huit robots nommés, GPTBot, OAI-SearchBot, ChatGPT-User,
PerplexityBot, ClaudeBot, Google-Extended, Applebot-Extended et CCBot, contre le
`robots.txt` du client. Là où une règle tranche, **la ligne est citée mot pour mot**.
Là où rien dans le fichier ne nomme le robot, le verdict le dit, il n'invente pas une
ligne.

**Les fichiers.** `llms.txt`, un index des pages échantillonnées dont chaque titre et
description est repris mot pour mot des pages du client. `robots.txt.diff`, un
correctif que le client teste avec `patch --dry-run` avant d'appliquer quoi que ce soit.

**Mesuré le 28 juillet 2026.** `nytimes.com` bloque les huit, chacun sur sa propre
ligne `Disallow: /`, et produit un correctif de 36 lignes. `theordinary.com` n'en bloque
aucun, donc aucun correctif n'est émis, et son `llms.txt` fait 6 234 octets sur 24 pages
échantillonnées.

**Le pipeline.** Sept étapes qui emmènent un sujet à travers trois marchés, et qui
**refusent physiquement de publier** tant qu'une personne nommée n'a pas approuvé chaque
marché. Le refus vit dans la logique métier, pas dans l'interface: appeler l'adresse de
publication directement renvoie un 409. Une approbation anonyme est rejetée.

C'est l'argument de gestion du risque pour une agence qui publie dans plusieurs pays.

---

## 3. Ce qui est honnêtement faible, à dire avant qu'on te le demande

C'est la partie qui te fait gagner en crédibilité, pas celle qui te coûte.

1. **La carte enregistre ce que le modèle dit qu'il citerait, pas ce que ChatGPT en
   production récupère en direct.** L'outil le dit lui-même dans le README du
   téléchargement. C'est une approximation défendable, pas une mesure de production.
2. **La carte nomme des domaines, pas des adresses de page.** Nommer la page exacte,
   c'est l'autopsie, une étape séparée.
3. **L'autorité de marque hors site est un indicateur de substitution**, calculé hors
   ligne, pas une mesure réelle. C'est écrit à l'écran sur la ligne concernée.
4. **Le pipeline tourne aujourd'hui sur un seul sujet amorcé, sur trois marchés.** Il
   s'arrête net plutôt que de deviner quand il manque la donnée d'ancrage d'un marché.
   Le plafond de six marchés est dans le code, pas dans les données.
5. **La vérification des robots est branchée sous l'audit et sous l'autopsie**, pas sous
   la carte ni sous le pipeline.
6. **Les sites dont les adresses sont des identifiants opaques ne se résolvent pas par
   mot clé.** `bmj.com`: 149 998 adresses parcourues, 0 correspondance, et l'outil le
   dit au lieu d'inventer. On colle l'URL à la main dans ce cas.
7. **Aucun téléchargement sur l'écran pipeline** aujourd'hui, les charges utiles sont à
   l'écran.

---

## 4. La phrase à retenir si tu n'en gardes qu'une

Tout ce que l'outil affiche est vérifiable en dehors de l'outil. Les questions sont des
phrases ordinaires qu'on retape dans un assistant. Les lignes de `robots.txt` sont
citées mot pour mot depuis un fichier public. Les phrases de comparaison sont extraites
des pages telles quelles. Quand l'outil manque une donnée, il laisse le trou visible et
demande le fait au client au lieu de l'inventer.
