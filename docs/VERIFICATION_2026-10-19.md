# Infographic Artist 1.1.0 — vérification de consolidation

La cible est le plugin dans ChatGPT et Codex. Le catalogue Vercel demeure une recherche complémentaire, pas le produit.

## Résultat vérifié

- Le serveur public Hatchable, déploiement 23, expose neuf outils en version `1.1.0-hatchable.1`.
- Endpoint unique : `https://infographic-artist-1w7v.hatchable.site/api/chatgpt-mcp`.
- Les 38 tests Python et 11 tests Node ont été réexécutés avec succès, avec contrôle de génération des sources, syntaxe JavaScript et `git diff --check`.
- Les sept outils textuels répondent réellement par HTTP. Le JSON textuel correspond au résultat structuré. Une recherche sans correspondance renvoie zéro résultat et une limite invalide est rejetée.
- Dans la conversation ChatGPT, les deux outils d’image ont reçu de vrais fichiers et renvoyé leurs résultats. Les directions de création renvoient trois briefs avec un relais explicite à la génération native de l’hôte.
- Le widget public est identique au fichier maître, empreinte vérifiée. Son banc Playwright précédent couvre 1440 × 1000 et 390 × 844; il simule le pont de l’hôte, ce qui ne vaut pas validation visuelle dans tous les clients ChatGPT.
- Codex 0.163.0 voit `infographic-artist@27pm-plugins`, installé et activé. Ses neuf fichiers de paquet sont identiques aux sources.
- La preuve antérieure du modèle Codex a été relue : deux appels MCP effectivement sélectionnés et terminés, `open_brand_atlas` puis `get_brand_case`, dans un diagnostic isolé. Ce diagnostic n’a pas été relancé pendant cette continuation.
- Les pages publiques, la signature MP4 et le format du challenge répondent comme attendu. Cela ne certifie ni la valeur du challenge dans le portail ni le contenu d’une démo à jour.

## Corrections livrées

La recherche ne remplace plus une absence de résultat par des cas sans correspondance. Les arguments hors schéma sont rejetés. Les clients sans widget reçoivent le résultat complet en texte JSON. Le widget privilégie le pont réellement disponible. Le serveur public n’annonce plus de rendu payant non configuré ou de faux job; il transmet des briefs à l’outil d’image disponible dans la conversation. Le renderer expérimental demeure hors du profil public.

## Source, paquet et production

Le code applicatif testé et déployé correspond au commit `6cc4282187624f520afaca2cbfabaf03e4711297`; les commits de preuve ultérieurs ne modifient pas son empreinte de source.

Le paquet est `distribution/infographic-artist-1.1.0.zip`, avec son fichier SHA-256. Il comprend le manifeste portable, la compatibilité Codex, la configuration MCP, le skill, les icônes et 70 références annotées. Les 70 références ne sont pas additionnées aux 934 entrées comme des marques inédites.

Les mesures détaillées sont dans [la preuve JSON](evidence/2026-10-19-plugin-verification.json). Le dossier de travail initial et ses neuf fichiers non suivis sont préservés. Aucun nouveau déploiement, changement de domaine ou de secret n’était nécessaire pour cette continuation. Aucun workflow GitHub Actions ajouté ou lancé.

## Limite de publication

Le plugin est utilisable dans les connexions testées. La publication universelle OpenAI n’est pas attestée : il reste à vérifier le brouillon du portail, ses attestations, sa démo du parcours actuel et sa décision de revue. L’outil Browser de cette conversation n’a pas de contexte de navigateur permettant de lire ce portail. Une absence de résultat dans la recherche de plugins n’est pas une preuve d’absence du plugin.

Le ZIP ne remplace pas l’approbation et la publication du portail. La PR de consolidation reste en brouillon; aucune fusion automatique.
