# CITED, ce que ça fait et pourquoi

Mis à jour le 28 juillet 2026. Chaque chiffre a été mesuré sur cette machine.

---

## 1. Le problème, en une phrase

Personne ne sait montrer à une marque la liste des questions où un assistant répond
pour sa catégorie et cite quelqu'un d'autre.

Une partie de la recherche d'achat se fait dans un assistant. Un assistant ne rend pas
dix liens, il cite une poignée de sources et rédige la réponse. Soit la marque est une
des sources, soit elle ne l'est pas, et il n'y a pas de deuxième page où être. Ce manque
à gagner est invisible dans l'analytics et dans les plateformes publicitaires, parce
qu'un clic qui n'a pas lieu ne laisse aucune trace.

---

## 2. Les six moteurs, interrogés en direct

| Moteur | Comment il est interrogé |
|---|---|
| Google AI Overview | acteur Apify `google-search-scraper`, add-on `aiOverview` |
| Google AI Mode | même acteur, `aiModeSearch` |
| Perplexity | même acteur, `perplexitySearch` |
| ChatGPT search | même acteur, `chatGptSearch` |
| Gemini | même acteur, `geminiSearch` |
| **Claude** | **API Anthropic Messages avec l'outil `web_search`, appelée à la source** |

Claude n'existe pas comme add-on de l'acteur, il est donc appelé directement. C'est la
seule lecture de première main des six, et elle tourne en parallèle de l'acteur.

**Mesuré en direct, 4 questions, 6 moteurs, 0,0985 $ :** AI Mode 72 citations,
Perplexity 61, Claude 57, ChatGPT 37, Gemini 18, AI Overview 9. Total 254 citations
sur 136 domaines.

Ce que la version précédente faisait, et qui était faux : demander à un modèle *ce qu'il
citerait*. Un modèle qui décrit son comportement imaginaire, un seul site par question,
rien de vérifiable.

---

## 3. Les cinq écrans

### BOARD, l'écran d'entrée
Tu tapes un sujet, ton domaine, un marché. Il écrit environ 160 questions d'acheteur,
en pose un panel aux six moteurs, et compte qui chacun cite.

Trois faits gardés **séparés**, parce que ce sont trois problèmes différents : la
**portée** (combien de moteurs te citent), le **volume** (combien de citations), et la
**première place** (combien de fois tu es la source nommée en premier). Sur un panel
réel, `youtube.com` a la plus grosse part et **zéro première place**. Un total unique
aurait caché exactement ça.

Le consensus se calcule sur les moteurs qui ont **répondu**, pas sur les six définis,
sinon un moteur muet vide l'ensemble pour une raison qui n'a rien à voir avec les
domaines comparés.

### WHY, dans le même écran
Pourquoi ce domaine-là gagne, calculé sur les mêmes citations. Trois facteurs mesurables
sans rien fetcher de plus : la portée moteur, la propriété des premières places par type
de question, et **le fait d'être nommé dans le texte sans que ton site soit cité**. Sur
un panel réel, 5 marques sur 6 nommées dans les réponses l'étaient avec **zéro citation
de leur propre site**. C'est ça qui prouve que le levier n'est pas le balisage on-page.

Deux colonnes en sortie : ce qu'un client peut copier, et ce qu'aucune page n'achètera
(on ne devient pas Reddit, on ne devient pas la Cleveland Clinic).

### MAP, l'espace de demande
Huit colonnes, un angle d'achat chacune, une tuile par question. La hauteur est le
nombre de questions, le remplissage est l'état. On voit d'un coup où la marque est citée
et où personne ne l'est.

### AUDIT, la page notée
Une URL, un score sur 100, neuf facteurs portant chacun son poids et sa source publiée.
Le dispositif est une **échelle de poids** : la largeur d'une bande est ce que vaut le
facteur, le remplissage est ce que la page a gagné, donc le vide EST le score manquant à
l'échelle. Sortie : un zip avec le plan de réécriture, les faits à faire remplir par le
client, le patch robots.txt, le JSON-LD et la page corrigée.

### PIPELINE, le garde-fou
Sept étapes, trois marchés, et un refus de publier tant qu'une personne **nommée** n'a
pas approuvé chaque marché. Le refus vit dans la logique métier : appeler l'endpoint
directement renvoie 409, une approbation anonyme renvoie 400.

---

## 4. Ce que le client repart avec

Un zip, construit à partir des chiffres du run, jamais d'un modèle de prose :
`citations.csv` (une ligne par citation : question, moteur, domaine, URL, rang),
`board.csv` (une ligne par domaine, une colonne par moteur), `gaps.csv` (les questions
où la marque est absente et qui les prend), `brief.md` (le brief écrit à partir de ces
nombres) et `README.txt` (ce que ça prouve et ce que ça ne prouve pas).

---

## 5. Les coûts et les temps, mesurés

| | |
|---|---|
| 4 questions, 6 moteurs | 0,0985 $, environ 4 minutes |
| 6 questions, 5 moteurs | 0,1635 $, 273 secondes |
| par question sur tous les moteurs | environ 2,5 centimes |
| écriture des ~160 questions | 1,3 centime, quelques secondes |

Le panel est un sous-ensemble **par construction** : poser les 160 questions aux six
moteurs coûterait environ quatre dollars et prendrait la majeure partie d'une heure.
L'écran dit combien ont été posées et liste celles qui ne l'ont pas été.

---

## 6. Pourquoi une agence paierait pour ça

**New business.** Une carte tourne sur un prospect avant le rendez-vous pour un centime,
et le panel réel pour un quart de dollar. Tu entres avec les questions de sa catégorie et
le nom du site qui prend chacune.

**Travail récurrent.** `gaps.csv` est une file de briefs, une question par ligne, avec le
site à déloger nommé. Et la file pointe vers **le site le plus faible assis dans une
réponse**, pas vers le leader. Battre celui qui gagne partout, c'est un an. Prendre le
siège d'un site qui ne gagne nulle part ailleurs, c'est une page.

**Contrôle du risque.** Le pipeline refuse de publier sans signature nommée par marché.

---

## 7. La phrase à retenir

Tout ce que l'outil affiche est vérifiable en dehors de l'outil. Les questions se
retapent dans un assistant. Les lignes de `robots.txt` sont citées mot pour mot depuis un
fichier public. Les phrases de comparaison sont extraites des pages telles quelles. Quand
une donnée manque, l'outil laisse le trou visible et demande le fait au client.
