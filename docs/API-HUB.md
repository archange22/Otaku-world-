# Otaku-world API Hub

## API intégrées / prévues

### Actuellement présentes dans le dépôt
- **AniList GraphQL**: recherche, fiches anime, genres, studios, bandes-annonces et métadonnées. Client: `src/lib/anilist.ts`.
- **MangaDex API**: catalogue manga/manhwa/manhua, couvertures, chapitres et pages disponibles via l'API. Client: `src/lib/mangadex.ts`.
- **Firebase Authentication**: comptes et connexion.
- **Firebase Hosting**: hébergement et déploiement du site.

### Ajouts de cette branche
- **Jikan API v4**: source publique de métadonnées anime et manga provenant de MyAnimeList. Pas de clé API requise pour les recherches publiques, avec limitation de débit.
- **Kitsu API**: recherche publique de fiches anime et manga en JSON:API.
- **API Hub**: recherches Jikan + Kitsu en parallèle, résultats normalisés, erreurs isolées par fournisseur et identification de la source.

Client ajouté: `src/lib/catalog-api-hub.ts`.

Exemple:
```ts
import { searchExternalCatalog } from "@/lib/catalog-api-hub";

const { results, providerErrors } = await searchExternalCatalog("anime", "Frieren");
```

## Autres intégrations possibles, à activer seulement si nécessaires
- **AniDB**: métadonnées avancées, conditions d'accès à vérifier.
- **TheTVDB**: données TV, clé/compte selon l'offre.
- **TMDB**: fiches, images et informations de films/séries, clé API nécessaire et règles d'attribution.
- **Google Books / Open Library**: livres et éditions pour un futur catalogue de light novels.
- **YouTube Data API**: recherche de bandes-annonces officielles, clé et quotas.
- **Firebase Cloud Functions**: logique serveur pour XP, rôles et opérations privilégiées.
- **Firebase Realtime Database / Firestore**: profils, favoris, historique, commentaires et listes, selon le modèle de données retenu.
- **Firebase App Check**: protection contre les requêtes abusives.
- **Sentry**: remontée d'erreurs, nécessite un DSN et une configuration.
- **Cloudinary**: gestion d'images téléversées, si le stockage actuel ne suffit pas.

## Règles d'intégration
1. Ne jamais exposer une clé privée dans le frontend ou dans Git. Utiliser des secrets et, si nécessaire, un proxy serveur.
2. Vérifier les quotas, licences, attribution, CORS et conditions d'utilisation de chaque fournisseur.
3. Les API de métadonnées ne donnent pas automatiquement le droit de diffuser un épisode ou un scan. Otaku-world doit utiliser uniquement des lecteurs et contenus que l'on est autorisé à intégrer.
4. Un fournisseur qui échoue ne doit pas rendre tout le catalogue indisponible.
5. Dédupliquer uniquement avec une correspondance vérifiée (titre normalisé + année/type), pas avec les identifiants de fournisseurs différents.
6. Ajouter des tests et un contrôle de build avant de fusionner cette branche.

## Limites connues
- Cette branche ajoute les clients et la documentation, mais ne remplace pas encore les écrans du catalogue par une recherche multi-source.
- Les genres Kitsu ne sont pas chargés dans cette première version.
- Les intégrations avec clé, les fonctions Firebase et les services de diffusion légale demandent une configuration distincte.
