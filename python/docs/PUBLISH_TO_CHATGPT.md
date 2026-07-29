# Publier Infographic Artist dans ChatGPT

**État corrigé au 24 juillet 2026 — version 1.0.1 :** le code, le serveur MCP, le widget, les métadonnées, les captures, les politiques, les scénarios d’examen, le site public et la route de vérification de domaine sont prêts. Le produit n’est toutefois ni déployé, ni soumis, ni publié.

OpenAI publie une app MCP à l’intérieur d’un **plugin**. Pour ce projet, choisir **With MCP** dans le portail de soumission.

## 1. Déployer le serveur MCP

Le serveur doit rester disponible sur une origine HTTPS publique et stable. Le point d’entrée à fournir sera :

```text
https://VOTRE-DOMAINE/mcp
```

Routes publiques :

```text
https://VOTRE-DOMAINE/
https://VOTRE-DOMAINE/health
https://VOTRE-DOMAINE/privacy
https://VOTRE-DOMAINE/terms
https://VOTRE-DOMAINE/support
https://VOTRE-DOMAINE/.well-known/openai-apps-challenge
```

### Docker

```bash
docker build -t infographic-artist-chatgpt .

docker run --rm -p 8000:8000 \
  -e APP_BASE_URL=https://VOTRE-DOMAINE \
  -e MCP_ALLOWED_HOSTS=VOTRE-DOMAINE \
  -e MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://platform.openai.com \
  -e CORS_ALLOW_ORIGINS=https://chatgpt.com,https://platform.openai.com \
  -e OPENAI_API_KEY=<set-in-deployment-for-live-rendering> \
  -e IMAGE_GENERATION_PROVIDER=openai \
  -e IMAGE_GENERATION_MODEL=gpt-image-2 \
  -e GENERATED_ASSET_DIR=generated_assets \
  -e GENERATED_ASSET_RETENTION_HOURS=168 \
  infographic-artist-chatgpt
```

`APP_BASE_URL` reçoit seulement l’origine HTTPS, sans `/mcp`, chemin, requête ou fragment. `MCP_ALLOWED_HOSTS` reçoit seulement le nom d’hôte. `OPENAI_API_KEY` est requis pour le rendu réel lorsque `IMAGE_GENERATION_PROVIDER=openai`; utiliser `IMAGE_GENERATION_PROVIDER=mock` seulement pour la validation locale ou hors production.

Le paquet contient aussi `render.yaml`, `Procfile` et `Dockerfile`. Le fournisseur doit préserver les requêtes POST vers `/mcp`, les réponses JSON MCP et les en-têtes de transport.

## 2. Vérifier le déploiement initial

Dans le projet :

```bash
pytest
python scripts/validate_submission.py
python scripts/check_widget_js.py
python scripts/smoke_mcp.py --output validation/runtime-smoke.json
```

Sur le serveur public, confirmer :

- `GET /`, `/health`, `/privacy`, `/terms` et `/support` retournent HTTP 200;
- MCP `initialize` réussit;
- `tools/list` expose exactement douze outils;
- chaque outil possède `inputSchema`, `outputSchema` et les annotations exigées;
- `resources/read` retourne `text/html;profile=mcp-app`;
- le runtime de production affiche `official-mcp-sdk` dans `/health`.

## 3. Tester dans ChatGPT Developer Mode

1. Activer Developer Mode.
2. Créer un plugin de développement pointant vers `https://VOTRE-DOMAINE/mcp`.
3. Actualiser après chaque modification des outils, schémas, annotations, instructions, CSP ou ressource UI.
4. Exécuter les scénarios positifs et négatifs de `chatgpt-app-submission.json`, y compris le démarrage d’un rendu, le workflow complet et `get_render_job`.
5. Tester les fichiers joints avec `critique_brand_image` et `compare_brand_images`.
6. Vérifier le widget en vue compacte et agrandie.

## 4. Préparer l’organisation OpenAI

Avant de créer la soumission :

- utiliser l’organisation qui possédera réellement le plugin;
- compléter la vérification individuelle ou d’entreprise sous le nom de publication;
- confirmer la permission **Apps Management: Write** — équivalente à `api.apps.write` — et la permission de lecture du statut;
- utiliser le même projet et la même organisation que l’identité vérifiée;
- utiliser un projet à **résidence globale des données**; les projets à résidence UE ne peuvent actuellement pas soumettre un plugin MCP;
- faire correspondre le nom du publisher, le site, le soutien et les politiques.

## 5. Créer la fiche « With MCP »

Fichier d’import :

```text
chatgpt-app-submission.json
```

Actifs :

```text
assets/app-icon-512.png
assets/app-icon-64.png
assets/submission-atlas.png
assets/submission-directions.png
assets/submission-critique.png
```

Champs préparés :

- nom : `Infographic Artist`;
- sous-titre : `Brand research & critique`;
- catégorie : `DESIGN`;
- authentification : aucune;
- commerce : aucun;
- site : `https://VOTRE-DOMAINE/`;
- endpoint MCP : `https://VOTRE-DOMAINE/mcp`;
- confidentialité : `https://VOTRE-DOMAINE/privacy`;
- conditions : `https://VOTRE-DOMAINE/terms`;
- assistance : `https://VOTRE-DOMAINE/support`.

Choisir aussi les pays ou régions de disponibilité. Recommandation prudente pour le lancement initial : **Canada**, puis élargir lorsque le soutien et les conditions juridiques sont prêts pour les autres marchés.

## 6. Répondre à la vérification de domaine

Quand le portail affiche **Domain not verified**, il fournit un jeton. Le copier exactement dans la variable du service :

```text
OPENAI_APPS_CHALLENGE_TOKEN=JETON_EXACT_DU_PORTAIL
```

Redémarrer ou redéployer, puis vérifier :

```bash
curl -fsS https://VOTRE-DOMAINE/.well-known/openai-apps-challenge
```

La réponse doit contenir uniquement le jeton, sans JSON, guillemets, tableau, préfixe ni saut de ligne ajouté. La route de la version 1.0.1 respecte ce contrat.

## 7. Scanner et soumettre

1. Lancer **Scan Tools**.
2. Vérifier les douze outils, les schémas, les annotations, les security schemes, les `_meta`, la ressource UI, la CSP et les instructions.
3. Corriger toute divergence sur le serveur, redéployer et rescanner.
4. Importer ou recopier les cas positifs et négatifs.
5. Ajouter les starter prompts, les captures, les notes de version et les attestations.
6. Confirmer la disponibilité géographique.
7. Déclencher **Submit for Review** depuis l’organisation propriétaire.

## 8. Publier après approbation

L’approbation ne rend pas automatiquement le plugin public. Après acceptation, ouvrir la version approuvée dans le portail et déclencher explicitement **Publish**.

## Frontière de responsabilité restante

Le paquet automatise le serveur et la route de vérification, mais il ne peut pas effectuer seul les opérations liées au compte :

1. choisir et posséder l’origine HTTPS publique;
2. déployer le service dans le compte d’hébergement;
3. sélectionner et vérifier l’identité de publication;
4. choisir la disponibilité géographique;
5. coller le jeton généré par le portail dans l’environnement de production;
6. signer **Submit for Review**, puis **Publish**.
