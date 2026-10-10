# Audit V0.1 — Otaku-World foundation

Date: 2026-10-10  
Scope: static review of the GitHub `main` branch. This is not a full runtime or security audit.

## Confirmed project structure
- React 19 + TypeScript + Vite/TanStack Start.
- Firebase Authentication is initialized in `src/lib/firebase.ts`.
- Anime metadata is accessed through AniList in `src/lib/anilist.ts`.
- Manga/chapter data is accessed through MangaDex in `src/lib/mangadex.ts`.
- User reading history and favorites are handled by `src/lib/library.ts`.
- Firebase Hosting deploy workflows exist for pull requests and pushes to `main`.

## Findings

### P0.1-01 — Offline helper referenced an undefined variable
File: `src/lib/reader-offline.ts`

`saveChapterOffline()` persisted a `meta` property without receiving or defining a `meta` variable. This is a TypeScript/build blocker. Fixed in this branch by adding an optional `meta?: SavedChapter["meta"]` parameter. Callers must pass metadata when they need downloads grouped by manga.

### P0.1-02 — Build and deployment are not yet verified
The package scripts provide `npm run build`, but no build/test result was available during this static review. The Hosting workflow publishes `.output/public` and rewrites routes to `/index.html`; confirm the generated output contains the expected files before relying on a production deploy.

### P0.1-03 — CI installation differs between preview and live workflows
The live workflow runs `npm install --legacy-peer-deps`, while the pull-request preview workflow runs `npm install`. This can make preview and production builds resolve dependencies differently. Standardize after confirming the intended dependency strategy.

### P0.1-04 — Privileged access needs a dedicated review
The inspected root route shows navigation and Firebase Auth integration, but this review did not establish a complete server-side role/permission enforcement path. Before adding Owner/Admin tools, verify every privileged action is enforced server-side and cannot be granted by changing client-side state.

### P0.1-05 — Privacy and content rights need release checks
Before wider distribution, document collected user data and its use, review Firebase rules and authorized domains, and confirm rights/terms for all media sources and downloadable content.

## Not verified yet
- Full TypeScript check, production build, and test suite.
- Firebase Realtime Database / Storage security rules and deployed configuration.
- All authentication flows and account recovery.
- Mobile accessibility/performance on real devices.
- Live deployment and Hosting output.

## Exit criteria for V0.1
1. Build and tests pass in CI.
2. Preview and live workflow dependency installation is consistent.
3. Firebase rules and privileged role enforcement are reviewed.
4. Core routes, auth, search, manga detail, reader, and library are smoke-tested.
5. No release is described as deployed until Hosting confirms it.
