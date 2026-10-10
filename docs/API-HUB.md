# Otaku-world API Hub

## API présentes dans le dépôt
- **AniList GraphQL** (src/lib/anilist.ts): recherche et métadonnées anime.
- **MangaDex API** (src/lib/mangadex.ts): métadonnées manga/manhwa/manhua et chapitres disponibles via l'API.
- **Jikan API v4**: métadonnées publiques issues de MyAnimeList.
- **Kitsu API**: fiches anime et manga via JSON:API.
- **Shikimori API**: fiches anime et manga.
- **Firebase Authentication / Hosting**: comptes et hébergement.

## Recherche multi-source
La fonction searchExternalCatalog(kind, query) interroge Jikan, Kitsu et Shikimori en parallèle. Elle normalise les résultats et isole les erreurs d'un fournisseur.
Le nouvel écran src/routes/catalogue-apis.index.tsx combine la recherche native AniList/MangaDex avec ces trois sources externes, indique la source des fiches et retire les doublons évidents par titre normalisé.

URL de l'écran : /catalogue-apis.

## Classification et sécurité
- Le filtre Ecchi +16 n'affiche que les fiches dont les métadonnées déclarent un genre ecchi. Les données de genre sont incomplètes selon les fournisseurs, donc cette classification n'est pas garantie exhaustive.
- Le filtre Hentai +18 affiche un écran verrouillé et ne lance pas de recherche ni de chargement de fiches adultes dans cette interface. Une simple étiquette n'est pas une vérification d'âge fiable. Toute éventuelle fonctionnalité adulte devrait nécessiter une validation d'âge robuste côté serveur et être conforme à la loi et aux règles de la plateforme.
- Les classifications fournies par les API peuvent être inexactes ou absentes. Prévoir une modération et une classification éditoriale avant d'exposer des contenus.
- Les clés privées ne doivent jamais être exposées dans le frontend ou commitées dans Git.

## Autres intégrations à évaluer
- **AniDB**: métadonnées avancées, conditions d'accès à vérifier.
- **MyAnimeList API officielle**: accès OAuth/client ID et limites à vérifier; Jikan n'est pas l'API officielle.
- **TMDB / TheTVDB**: adaptations, films et séries; clés et attribution possibles.
- **YouTube Data API**: bandes-annonces officielles, clé et quotas.
- **Google Books / Open Library**: light novels et éditions.
- **Firestore / Cloud Functions / App Check**: données utilisateur, logique serveur et protection anti-abus.
- **Sentry / Cloudinary**: suivi d'erreurs et médias téléversés, selon les besoins.

## Limites et vérifications nécessaires
Les API de métadonnées ne confèrent pas de droits de diffusion pour les épisodes ou scans. Les API publiques peuvent imposer quotas, attribution, restrictions CORS ou conditions d'utilisation. Les résultats multi-sources, l'API Shikimori et la génération de routes doivent encore passer le build, le lint et des tests réels avant fusion. Cette modification n'a pas été déployée.
