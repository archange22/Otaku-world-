# Otaku-World v0.8

Plateforme catalogue multi-sources : Anime, Manga, Webtoon/Manhwa et Comics.
UI moderne, responsive mobile-first et installable sur Android (PWA).

## Nouveautés de la v0.8 (Catalogue & Navigation)
- **Navigation mobile-first** : Bottom navigation bar dédiée sur Android / mobile + drawer hamburger fluide avec animations.
- **PWA installable** : Ajout du `manifest.webmanifest`, service worker (`sw.js`) pour la mise en cache et intégration Android.
- **Recherche & Catalogue enrichis** :
  - Support de filtres par genre (Action, Aventure, Comédie, Fantasy, Drame, Romance, etc.).
  - Tri dynamique (Tendances, Popularité, Mieux notés, Récents).
  - Onglets multi-sources : 🎬 Anime, 📚 Manga, 📱 Webtoon & Manhwa, 🦸 Comics (Open Library).
- **Fiches détaillées immersives** :
  - Intégration des bandes-annonces officielles YouTube (via AniList API).
  - Affichage des scores, métadonnées, studios, statuts et correspondance Anime-Sama.
- **Backend v0.8** : Proxy MangaDex sécurisé dans `server.js` avec User-Agent officiel et gestion propre des erreurs.
- **Sécurité contenu & légalité** :
  - Mode sûr activé en continu (`isAdult: false`, `contentRating: [safe, suggestive]`).
  - Aucun flux protégé n'est contourné.

## Fonctionnalités préservées
- Firebase Auth (Connexion, Inscription, Session).
- Profils complets (XP, Niveaux, Badges, Statistiques).
- Téléversement d'avatar sur Firebase Storage.
- Rôles : Owner, Admin, Modérateur, Membre.
- Dashboard Owner/Admin avec statistiques en direct et configuration des APIs.

## Démarrage rapide du backend
1. `npm install`
2. `npm start`
