import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Search, RotateCw, Clapperboard, Star, CalendarDays, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/anime")({
  head: () => ({
    meta: [
      { title: "Catalogue Anime — KOVA" },
      { name: "description", content: "Recherche des anime, films et séries animées avec les données publiques AniList." },
    ],
  }),
  component: AnimeCatalog,
});

type AnimeItem = {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string };
  averageScore?: number | null;
  episodes?: number | null;
  format?: string | null;
  status?: string | null;
  seasonYear?: number | null;
  genres?: string[];
  description?: string | null;
  trailer?: { id?: string; site?: string } | null;
};

const QUERY = `query KovaAnimeSearch($search: String, $page: Int, $type: MediaType, $format: MediaFormat) {
  Page(page: $page, perPage: 24) {
    pageInfo { currentPage hasNextPage }
    media(search: $search, type: $type, format: $format, sort: POPULARITY_DESC, isAdult: false) {
      id title { romaji english native } coverImage { large extraLarge }
      averageScore episodes format status seasonYear genres description(asHtml: false)
      trailer { id site }
    }
  }
}`;

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function searchAnime(search: string, page: number, format: string) {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        search: search.trim() || undefined,
        page,
        type: "ANIME",
        format: format || undefined,
      },
    }),
  });
  if (!response.ok) throw new Error(`AniList répond avec le code ${response.status}.`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error("AniList ne peut pas répondre à cette recherche.");
  return payload.data.Page as { pageInfo: { currentPage: number; hasNextPage: boolean }; media: AnimeItem[] };
}

function AnimeCatalog() {
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebounced(search);
  const result = useQuery({
    queryKey: ["kova-anime", term, format, page],
    queryFn: () => searchAnime(term, page, format),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => { setPage(1); }, [term, format]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><Clapperboard className="h-7 w-7" /></div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">KOVA · ANIME</p>
            <h1 className="mt-1 text-2xl font-extrabold md:text-4xl">Catalogue anime</h1>
            <p className="mt-2 text-sm text-muted-foreground">Recherche les séries et films grâce aux données publiques d’AniList.</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border bg-card px-4 focus-within:border-primary">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input aria-label="Rechercher un anime" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titre japonais, français ou anglais…" className="w-full bg-transparent outline-none" />
          {search && <button type="button" onClick={() => setSearch("")} className="text-xs text-muted-foreground hover:text-foreground">Effacer</button>}
        </label>
        <select aria-label="Filtrer par format" value={format} onChange={(event) => setFormat(event.target.value)} className="min-h-12 rounded-2xl border bg-card px-4 text-sm font-semibold outline-none focus:border-primary">
          <option value="">Tous les formats</option>
          <option value="TV">Série TV</option>
          <option value="MOVIE">Film</option>
          <option value="OVA">OVA</option>
          <option value="ONA">ONA / Web</option>
          <option value="SPECIAL">Spécial</option>
        </select>
      </div>

      {result.isLoading && <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="animate-pulse"><div className="aspect-[2/3] rounded-2xl bg-muted" /><div className="mt-3 h-4 rounded bg-muted" /><div className="mt-2 h-3 w-2/3 rounded bg-muted" /></div>)}</div>}
      {result.error && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><span>{result.error instanceof Error ? result.error.message : "Impossible de charger le catalogue."} Vérifie ta connexion puis réessaie.</span><button onClick={() => void result.refetch()} disabled={result.isFetching} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-semibold disabled:opacity-60"><RotateCw className={`h-4 w-4 ${result.isFetching ? "animate-spin" : ""}`} /> Réessayer</button></div>}

      {result.data && (
        <>
          <div className="mb-4 mt-7 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{result.data.media.length} résultats · page {result.data.pageInfo.currentPage}</p><p className="hidden text-xs text-muted-foreground sm:block">Les contenus adultes sont exclus de cette recherche.</p></div>
          {result.data.media.length === 0 ? <div className="rounded-2xl border bg-card p-10 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-bold">Aucun résultat</h2><p className="mt-1 text-sm text-muted-foreground">Essaie un autre titre ou retire un filtre.</p></div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {result.data.media.map((anime) => {
              const title = anime.title.english || anime.title.romaji || anime.title.native || "Anime sans titre";
              const trailerUrl = anime.trailer?.site === "youtube" && anime.trailer.id ? `https://www.youtube.com/watch?v=${encodeURIComponent(anime.trailer.id)}` : null;
              return <article key={anime.id} className="group min-w-0 overflow-hidden rounded-2xl border bg-card transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-neon">
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  {anime.coverImage?.extraLarge || anime.coverImage?.large ? <img src={anime.coverImage.extraLarge || anime.coverImage.large} alt={title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-muted-foreground"><Clapperboard className="h-8 w-8" /></div>}
                  {anime.averageScore != null && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-bold"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{(anime.averageScore / 10).toFixed(1)}</span>}
                  {trailerUrl && <a href={trailerUrl} target="_blank" rel="noreferrer" aria-label={`Bande-annonce de ${title}`} className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-primary opacity-100 transition hover:bg-primary hover:text-primary-foreground sm:opacity-0 sm:group-hover:opacity-100"><PlayCircle className="h-5 w-5" /></a>}
                </div>
                <div className="p-3">
                  <h2 title={title} className="line-clamp-2 min-h-10 text-sm font-extrabold">{title}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{anime.format || "Format inconnu"}{anime.episodes ? ` · ${anime.episodes} épisodes` : ""}</p>
                  {anime.seasonYear && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" />{anime.seasonYear}</p>}
                  {anime.genres?.length ? <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{anime.genres.slice(0, 3).join(" · ")}</p> : null}
                  <a href={`https://anilist.co/anime/${anime.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-full border px-3 text-xs font-bold transition hover:border-primary hover:text-primary">Fiche AniList</a>
                </div>
              </article>;
            })}
          </div>}
          <div className="mt-8 flex items-center justify-center gap-3">
            <button disabled={page <= 1 || result.isFetching} onClick={() => { setPage((n) => Math.max(1, n - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-h-11 rounded-full border px-5 text-sm font-bold disabled:opacity-40">Précédent</button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <button disabled={!result.data.pageInfo.hasNextPage || result.isFetching} onClick={() => { setPage((n) => n + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">Suivant</button>
          </div>
        </>
      )}
      <p className="mt-8 text-center text-xs text-muted-foreground">Données anime fournies par AniList. KOVA ne diffuse pas les épisodes et renvoie vers les fiches officielles.</p>
    </main>
  );
}
