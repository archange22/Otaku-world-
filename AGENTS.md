<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- MangaDex API calls go through the /api/public/md proxy route (browser CORS/UA limits); MangaDex images load directly with referrerPolicy no-referrer (server-side image fetches get 403).
- Favorites, history and reading progress live in localStorage via src/lib/library.ts (not yet synced to accounts).
- Auth uses the user's Firebase project via src/lib/firebase.ts (lazy, browser-only init so SSR never touches Firebase); useAuth hook + /auth page.
