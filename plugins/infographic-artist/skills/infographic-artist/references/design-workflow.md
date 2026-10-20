# Parcours de conception — huit étapes

## Repères de lecture

- [Rôle du parcours](#rôle-du-parcours)
- [Consulter le référentiel au besoin](#consulter-le-référentiel-au-besoin)
- Les huit étapes : brief; fidélité; reproduction; perception; composition; direction artistique; corrections; évaluation.
- [Preuves et états des contrôles](#preuves-et-états-des-contrôles)
- [Récupération et restitution](#récupération-et-restitution)

## Rôle du parcours

Ce protocole transforme un brief en décisions explicites, variantes et contrôles observables. Il accompagne les neuf outils MCP existants; il n’ajoute ni moteur de rendu, ni moteur automatique de conformité. Reprendre les informations déjà confirmées par l’utilisateur et inspecter les fichiers réellement accessibles. Adapter l’effort au support et à la question. Signaler les hypothèses utiles; ne demander une précision que si elle empêche une décision importante.

Les réponses de `coach_brand_decision` et `generate_brand_directions` peuvent contenir `data.design_workflow`. Il s’agit d’un plan initialisé à `non_testé`, même si son texte propose une opération ou un critère. La réalisation et sa preuve doivent être établies séparément. Un bouton de parcours ou une fiche dans la vue Principes ne change pas ce statut.

Le paramètre facultatif `design_context` précise `task`, `message`, `medium`, `final_size`, `audience` et `cultural_context`. Ne renseigner que des informations fournies ou des hypothèses annoncées, dans le format accepté par le schéma effectivement disponible. Aucun autre paramètre décrit dans ce document n’est à supposer accepté par l’API.

## Consulter le référentiel au besoin

Utiliser `search_design_systems` avec `kind='principle'` pour chercher une fiche par identifiant, nom ou domaine. Pour une consultation locale, la copie distribuée est [design-principles.json](design-principles.json); le build la produit à l’identique depuis `python/data/design_principles.json`, source canonique du dépôt. Ne pas entretenir deux catalogues divergents. Les 150 fiches, 69 références et 14 domaines sont une cartographie étendue, sans prétention d’exhaustivité ni de revue systématique.

Pour chaque notion retenue, lire `definition`, `basis`, `application`, `limits` et `source_ids`. Vérifier ensuite ce que la source affirme dans `supports`, ainsi que son niveau de lecture s’il est renseigné. Une référence ou un résumé ne signifie pas que son texte intégral a été consulté. Une fiche élémentaire sans source doit rester une dérivation ou proposition explicitement identifiée.

| `basis` | Interprétation à conserver |
|---|---|
| `mathematical` | Relation exacte sous ses hypothèses; ne prouve pas une supériorité esthétique. |
| `physical` | Modèle d’un phénomène avec conditions, paramètres et simplifications. |
| `empirical` | Observation liée à des stimuli, tâches et populations; transfert au livrable à vérifier. |
| `heuristic` | Méthode de composition ou d’atelier proposée, avec exceptions possibles. |
| `historical_symbolic` | Construction ou usage culturel situé; attribuer la tradition sans pouvoir physique inventé. |
| `hypothesis` | Cadre explicatif ou proposition dont les limites doivent accompagner l’usage. |
| `standard` | Exigence dans un périmètre, une version et un niveau précis, avec exceptions. |

Choisir les notions nécessaires au problème. Ne pas charger tout le catalogue pour une correction simple. Aucun rapport φ, degré de symétrie, niveau de complexité fractale ou rayon d’arrondi ne remplace une évaluation adaptée au public. Une préférence moyenne n’est pas une prescription pour chaque personne.

## 1. Définir la tâche, le public, le message, le support et la taille finale.

Constituer un brief court : qui regarde, que doit-il pouvoir faire ou comprendre, quel message compte, où et à quelle taille le visuel paraîtra, quelles références culturelles sont pertinentes. Préserver les mots exacts, le nom, les contraintes de marque et les autorisations connues. Identifier les fichiers disponibles sans déduire leur contenu d’un nom ou d’un identifiant opaque.

**Résultat attendu :** contexte confirmé, hypothèses visibles et contraintes de sortie. Une taille, un public ou une préférence inconnus restent inconnus; ils ne deviennent pas des faits pour remplir le plan.

## 2. Déterminer ce que le visuel doit représenter correctement.

Établir ce qui appartient au même groupe, se compare, se succède ou dépend d’autre chose. Pour des données, préserver unités, valeurs, échelles, incertitudes et sources. Pour un symbole ou un logotype, distinguer les éléments indispensables à sa reconnaissance des détails décoratifs. Une ligne ne doit pas inventer une causalité ou une liaison.

**Résultat attendu :** liste des relations et informations à préserver. Les contrôles quantitatifs ne s’appliquent que lorsqu’il existe des quantités; ne pas fabriquer de données pour un emblème.

## 3. Appliquer les contraintes de reproduction et d’accessibilité pertinentes.

Déterminer les critères pertinents au support : texte, interfaces, informations graphiques, impression, matériau, résolution, mouvement ou version monochrome. Pour une norme, préciser version, niveau, périmètre et exceptions depuis sa source applicable. Distinguer un contraste calculé sur les couleurs réelles d’une impression visuelle de lisibilité.

**Résultat attendu :** critères applicables et moyens de les vérifier. Le serveur propose ces contrôles; il ne certifie pas leur réussite. Un logo lisible ne certifie pas toute l’interface; un rendu écran ne démontre pas sa reproduction sur un matériau. En l’absence des données ou outils requis, conserver le contrôle non testé ou indéterminé selon la preuve disponible.

## 4. Choisir les principes perceptifs qui clarifient la structure.

Sélectionner les mécanismes utiles : proximité, similarité, région commune, connexion, continuation, figure-fond ou hiérarchie attentionnelle. Dire quel groupement ou parcours chacun doit clarifier. Vérifier les conflits entre indices. L’attention dépend aussi de la tâche, des attentes et du sens; la surface colorée ne suffit pas à prédire la lecture.

**Résultat attendu :** quelques fiches identifiées et leur rôle dans le visuel. Présenter les regroupements proposés comme une traduction pratique des mécanismes, pas comme une compréhension déjà mesurée chez des utilisateurs.

## 5. Explorer plusieurs systèmes de proportion et de composition.

Comparer des armatures réellement différentes, à contenu constant lorsque la comparaison porte sur la forme : rapports simples, grilles, tiers, √2, φ, axes, répartitions radiales ou asymétrie. Employer les formules seulement avec leurs hypothèses et mesures disponibles. Distinguer centre de masse calculé, équilibre perçu, symétrie et préférence.

**Résultat attendu :** variantes accompagnées d’une raison de composition et de leurs compromis. Un calcul exact prouve son rapport, pas sa beauté. Si des données sont encodées, les dimensions doivent rester fidèles aux quantités; une proportion décorative ne doit pas les déformer.

## 6. Développer la direction artistique et les références symboliques.

Relier silhouette, couleur, matière, rythme, courbure et symboles à l’intention. Chercher des précédents avec `open_brand_atlas` puis `get_brand_case`, et comparer leurs mécanismes avec les outils existants. Attribuer les traditions pertinentes; ne pas imiter les silhouettes de tiers, inventer une filiation historique ou attribuer une énergie particulière à une géométrie.

Utiliser `generate_brand_directions` pour les trois routes prévues par l’outil. Ses prompts et son parcours ne sont pas des images rendues. Pour la création effective, suivre exclusivement le handoff natif **`@Créer une image`** décrit dans le SKILL, avec une véritable référence d’image si nécessaire. Aucun autre fournisseur ou ancien renderer ne sert de remplacement.

**Résultat attendu :** direction justifiée et brief de production, ou image réellement obtenue lorsque le host a exécuté son outil natif. Rapporter fidèlement lequel des deux existe.

## 7. Effectuer les corrections optiques et les déclinaisons.

Sur un tracé ou rendu accessible, inspecter espacements, contreformes, alignement apparent, lisibilité des lettres et détails qui fusionnent à petite taille. Préparer les variantes nécessaires : clair/sombre, monochrome, format large/mobile ou autres usages confirmés. Conserver la géométrie du mot-signe entre variantes, sauf correction optique documentée.

**Résultat attendu :** changements effectivement faits et fichiers réellement disponibles, avec leur cible de sortie. Une inspection matricielle ne prouve pas les dimensions vectorielles ou un procédé de fabrication. Si aucun outil de modification ou fichier cible n’est disponible, fournir les corrections proposées sans prétendre les avoir appliquées.

## 8. Évaluer séparément reconnaissance, compréhension et préférence.

Choisir des comparaisons adaptées, en maintenant constants les contenus et conditions pertinents. Identifier un signe ou un nom mesure la reconnaissance; restituer la bonne relation ou information mesure la compréhension; choisir ou apprécier une variante mesure la préférence. Aucune des trois ne remplace les autres.

**Résultat attendu :** observations réelles ou protocole d’essai clairement proposé. Pour un essai humain réalisé, préciser tâche, stimuli, taille de sortie, participants effectivement présents et réponses observées. Une inspection par l’assistant, une réponse de modèle ou un score heuristique ne constitue pas une étude d’utilisateurs. Ne pas inventer de taux de mémorisation, délai de lecture ou score global de beauté.

## Preuves et états des contrôles

Chaque contrôle porte sur une propriété explicite d’une version précise du livrable. Le compte rendu peut indiquer étape, cible, critère, méthode, état et preuve; ces éléments sont une structure de travail, pas de nouveaux paramètres MCP.

| Preuve | Ce qu’elle autorise à dire | Informations à conserver |
|---|---|---|
| `calcul` | Une valeur a été calculée à partir d’entrées réelles avec une méthode connue. | Entrées, unités, formule ou outil, résultat et conditions. |
| `inspection` | Une propriété visible ou une erreur a été observée sur le rendu consulté. | Fichier/version, taille et contexte d’affichage, observation précise. |
| `essai` | Une procédure a été exécutée et son résultat enregistré. | Procédure, conditions, participants s’il s’agit d’un essai humain, observations. |

Le type de preuve doit correspondre à l’affirmation. Un calcul ne prouve pas une préférence; une inspection ne certifie pas un contraste normatif; un essai technique ne mesure pas la compréhension d’un public.

| État | Usage |
|---|---|
| `non_testé` | Contrôle proposé, sans exécution ni résultat établi. C’est l’état initial du plan serveur. |
| `satisfait` | Le critère explicite est étayé par une preuve adaptée sur la cible actuelle. Cela ne valide pas tout le visuel. |
| `écart` | Une preuve adaptée montre que le critère explicite n’est pas atteint; décrire l’écart et sa conséquence. |
| `indéterminé` | Les éléments examinés ne permettent pas de conclure, par exemple en raison de mesure, version ou contexte insuffisants. |
| `non_applicable` | Le critère ne concerne pas ce support ou besoin; donner la raison. L’absence d’outil ne suffit pas. |

Ne pas requalifier le plan retourné par le serveur en validation. Ajouter séparément les preuves effectivement acquises. Une nouvelle version peut rendre une ancienne preuve insuffisante; rattacher l’observation à sa cible exacte. Les scores heuristiques existants ne remplacent pas ces états et ne sont pas à agréger en note de beauté.

## Récupération et restitution

En cas d’échec, identifier la couche en cause, vérifier l’état faisant autorité et les effets partiels, corriger le mécanisme, puis reprendre la vérification qui a échoué. Ne pas répéter une génération, installation ou publication réussie à cause d’une réponse interrompue. Un fichier absent, un outil indisponible ou un accès refusé reste une limite réelle, sans URL ou exécution inventée.

Restituer les décisions utiles, changements effectués, éléments à vérifier et limites restantes. Une demande de création ou correction appelle l’action disponible, pas seulement une liste de principes. Le protocole ne modifie pas les limites de publication, de coût, de domaine ou de projet du SKILL.
