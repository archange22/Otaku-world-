# Otaku Realm

Créer l'application web KOVA (Otaku-World) : une plateforme moderne, ultra-fluide et responsive (mobile-first et PC) pour explorer les animes et lire les mangas/manhwas/manhuas.

Fonctionnalités requises :
1. Catalogue et Accueil complets :
   - Onglet Anime connecté en direct à l'API GraphQL AniList (titres, affiches, score, format, épisodes).
   - Onglet Manga & Manhwa connecté en direct à l'API MangaDex (titres en français/anglais, couvertures haute qualité, genres, statut).
   - Barre de recherche instantanée, filtres par format (Manga, Manhwa, Manhua, TV, Film), genres et tri par popularité ou note.
   - Accueil avec hero immersif, carrousels tendances et nouveautés.

2. Fiches détaillées :
   - Fiche Anime : grand poster/bannière, synopsis complet, métadonnées (statut, épisodes, score), lecteur de bande-annonce YouTube officielle.
   - Fiche Manga : synopsis, genres, score et liste des chapitres disponibles en français et en anglais avec le nombre de pages.

3. Lecteur MangaDex vertical intégré :
   - Récupération des planches via les serveurs MangaDex At-Home (/at-home/server/{chapterId}).
   - Filtrage strict pour ne charger que les chapitres disposant de véritables pages d'images (exclusion des liens externes sans planches).
   - Défilement vertical fluide, préchargement des pages, indicateur de chargement par planche.
   - Contrôles de lecture : sélecteur de chapitre, boutons chapitre précédent/suivant, bascule mode haute qualité / économie de données (data-saver), compteur de page en temps réel.
   - Reprise de lecture automatique (sauvegarde locale de la progression par chapitre et page).

4. Espace Bibliothèque et Profil :
   - Gestion des Favoris et de l'Historique de lecture.
   - Design moderne sombre (palette noir profond, violet néon et accents lumineux), transitions douces et navigation ergonomique mobile et desktop.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/39ea9153-85f3-41a2-92dc-5ec8d11d3bcf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
