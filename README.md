# Otaku-World v0.9

Plateforme catalogue multi-sources : Anime, Manga, Webtoon/Manhwa et Comics.
UI moderne sombre violette, navigation mobile-first, installable sur Android (PWA) et synchronisation cloud Firebase complète.

---

## Nouveautés de la v0.9 (Favoris, Historique & Suivi)
- **❤️ Système de favoris Cloud** :
  - Ajout/retrait instantané d'un média depuis sa fiche via le bouton cœur.
  - Onglet dédié "Mes Favoris" dans le profil avec compteur et synchronisation sous `users/{uid}/favorites` dans Firebase RTDB.
- **📊 Suivi de progression des épisodes et chapitres** :
  - Compteur interactif avec boutons `[-]`, `[+1 Avancer]` et `[✓ Terminé]`.
  - Barre de complétion en pourcentage (%) calculée selon le nombre total d'épisodes/chapitres.
  - Synchronisé en temps réel dans Firebase sous `users/{uid}/progress`.
- **🕒 Historique de consultation automatique** :
  - Chaque œuvre consultée est automatiquement ajoutée à l'historique de l'utilisateur avec date et heure.
  - Option pour vider l'historique en un clic.
- **📱 PWA & Mobile UX perfectionnées** :
  - Accès direct depuis le menu hamburger aux sections "Mes Favoris", "Suivi Progression", "Mon Historique".

---

## Guide de déploiement direct du site

Vous pouvez déployer Otaku-World gratuitement et en quelques minutes :

### Option A : Déploiement via GitHub Pages (Le plus rapide)
1. Rendez-vous sur votre dépôt GitHub : `https://github.com/archange22/Otaku-world-`
2. Cliquez sur l'onglet **Settings** (Paramètres).
3. Dans la colonne de gauche, cliquez sur **Pages**.
4. Sous la section **Build and deployment** :
   - Source : sélectionnez **Deploy from a branch**.
   - Branch : choisissez `main` et le dossier `/(root)`.
   - Cliquez sur **Save**.
5. Attendez 1 à 2 minutes. Votre site sera automatiquement en ligne à l'adresse :
   `https://archange22.github.io/Otaku-world-/`

### Option B : Déploiement via Vercel (Recommandé avec nom de domaine gratuit)
1. Allez sur [vercel.com](https://vercel.com) et connectez-vous avec votre compte GitHub.
2. Cliquez sur **Add New...** > **Project**.
3. Sélectionnez le dépôt `Otaku-world-` et cliquez sur **Import**.
4. Laissez les réglages par défaut et cliquez sur **Deploy**.
5. Vous obtiendrez instantanément une URL HTTPS rapide (ex: `otaku-world.vercel.app`).

### Option C : Hébergement du Backend MangaDex Proxy (sur Render ou Koyeb)
Comme le frontend appelle MangaDex et éventuellement AnimeSamaApi :
1. Créez un compte gratuit sur [render.com](https://render.com).
2. Cliquez sur **New Web Service** et sélectionnez votre dépôt `Otaku-world-`.
3. Commande de build : `npm install`
4. Commande de démarrage : `node server.js`
5. Récupérez l'URL fournie par Render (ex: `https://otaku-backend.onrender.com`).
6. Sur le site dans **Dashboard > Configuration des sources**, collez cette URL dans *URL de ton backend Otaku-World*.
