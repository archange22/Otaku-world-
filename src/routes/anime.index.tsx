import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Star, CalendarDays, Tv, Film, Heart, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/anime/")({
  head: () => ({ meta: [
    { title: "Anime | KOVA" },
    { name: "description", content: "Explore les séries, films et nouveautés anime sur KOVA." },
  ] }),
  component: AnimeCatalog,
});

type Anime = {
  id: number; title: { romaji: string; english?: string | null; native?: string | null };
  description?: string | null; coverImage: { large: string; extraLarge?: string };
  averageScore?: number | null; episodes?: number | null; seasonYear?: number | null;
  format?: string | null; status?: string | null; genres: string[]; isAdult: boolean;
  siteUrl: string; startDate?: { year?: number | null; month?: number | null; day?: number | null };
};

const QUERY = `query ($page:Int,$perPage:Int,$search:String,$genre_in:[String],$format_in:[MediaFormat],$sort:[MediaSort]) {
  Page(page:$page,perPage:$perPage) {
    media(type:ANIME,search:$search,genre_in:$genre_in,format_in:$format_in,sort:$sort,isAdult:false) {
      id title { romaji english native } description(asHtml:false) coverImage { large extraLarge }
      averageScore episodes seasonYear format status genres isAdult siteUrl
      startDate { year month day }
    }
  }
}`;

function AnimeCatalog() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [format, setFormat] = useState("");
  const [sort, setSort] = useState("TRENDING_DESC");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("kova-anime-favorites") || "[]") as number[]; } catch { return []; }
  });
  const [loaded, setLoaded] = useState(false);

  const runSearch = async (nextPage = 1) => {
    setLoading(true); setError("");
    try {
      const variables: Record<string, unknown> = { page: nextPage, perPage: 24, sort: [sort] };
      if (search.trim()) variables.search = search.trim();
      if (genre) variables.genre_in = [genre];
      if (format) variables.format_in = [format];
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: QUERY, variables }),
      });
      if (!response.ok) throw new Error("Le catalogue est momentanément indisponible.");
      const json = await response.json();
      if (json.errors?.length) throw new Error("L'API anime a renvoyé une erreur.");
      const results = (json.data?.Page?.media || []) as Anime[];
      setItems(results.filter((item) => !item.isAdult));
      setPage(nextPage); setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger le catalogue.");
    } finally { setLoading(false); }
  };

  const genres = useMemo(() => ["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mystery","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"], []);
  const toggleFavorite = (id: number) => {
    const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem("kova-anime-favorites", JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
  };

  return <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
    <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-10">
      <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative">
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">KOVA · Anime</span>
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">Ton prochain anime commence ici.</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">Explore les séries et films, découvre les nouveautés et garde tes favoris. Les fiches proviennent d'AniList.</p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-2 rounded-full border px-3 py-2"><Tv className="h-4 w-4"/> Séries</span>
          <span className="flex items-center gap-2 rounded-full border px-3 py-2"><Film className="h-4 w-4"/> Films & spéciaux</span>
          <span className="flex items-center gap-2 rounded-full border px-3 py-2"><Heart className="h-4 w-4"/> {favorites.length} favoris</span>
        </div>
      </div>
    </section>

    <form className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]" onSubmit={(e) => { e.preventDefault(); void runSearch(1); }}>
      <label className="flex items-center gap-2 rounded-xl border px-3"><Search className="h-4 w-4 text-muted-foreground"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un anime..." className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/></label>
      <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-xl border bg-background px-3 py-3 text-sm"><option value="">Tous les genres</option>{genres.map((g) => <option key={g}>{g}</option>)}</select>
      <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-xl border bg-background px-3 py-3 text-sm"><option value="">Tous les formats</option><option value="TV">Série TV</option><option value="MOVIE">Film</option><option value="OVA">OVA</option><option value="ONA">ONA</option><option value="SPECIAL">Spécial</option></select>
      <select aria-label="Trier par" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border bg-background px-3 py-3 text-sm"><option value="TRENDING_DESC">Tendances</option><option value="POPULARITY_DESC">Popularité</option><option value="SCORE_DESC">Meilleures notes</option><option value="START_DATE_DESC">Plus récents</option><option value="TITLE_ROMAJI">Ordre alphabétique</option></select>
      <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"><SlidersHorizontal className="h-4 w-4"/>{loading ? "Chargement…" : "Rechercher"}</button>
    </form>

    {error && <div role="alert" className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"><p>{error}</p><button className="mt-2 font-bold underline" onClick={() => void runSearch(page)}>Réessayer</button></div>}
    {!loaded && !loading && <div className="mt-8 rounded-2xl border border-dashed p-8 text-center"><p className="font-semibold">Le catalogue t'attend.</p><p className="mt-2 text-sm text-muted-foreground">Lance une recherche pour charger les animes populaires et les nouveautés.</p><button onClick={() => void runSearch(1)} className="mt-4 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Découvrir les animes</button></div>}
    {loading && <div className="grid grid-cols-2 gap-4 py-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{Array.from({length:12},(_,i)=><div key={i} className="animate-pulse"><div className="aspect-[2/3] rounded-2xl bg-muted"/><div className="mt-3 h-4 rounded bg-muted"/><div className="mt-2 h-3 w-2/3 rounded bg-muted"/></div>)}</div>}
    {!loading && loaded && <>
      <div className="mt-8 flex items-end justify-between"><div><h2 className="text-xl font-extrabold md:text-2xl">Résultats du catalogue</h2><p className="mt-1 text-sm text-muted-foreground">{items.length} titres affichés · page {page}</p></div><button onClick={() => void runSearch(page + 1)} className="rounded-full border px-4 py-2 text-sm font-semibold">Page suivante →</button></div>
      {items.length === 0 ? <p className="py-12 text-center text-muted-foreground">Aucun résultat. Essaie un autre titre ou un autre filtre.</p> : <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{items.map((anime) => <article key={anime.id} className="group min-w-0 overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-1 hover:border-primary/60">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted"><img src={anime.coverImage.extraLarge || anime.coverImage.large} alt={anime.title.english || anime.title.romaji} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/><button aria-label={favorites.includes(anime.id) ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => toggleFavorite(anime.id)} className="absolute right-2 top-2 rounded-full border bg-background/90 p-2"><Heart className={`h-4 w-4 ${favorites.includes(anime.id) ? "fill-primary text-primary" : ""}`}/></button>{anime.averageScore && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-bold"><Star className="h-3 w-3 text-amber-400"/>{(anime.averageScore/10).toFixed(1)}</span>}</div>
        <div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-bold">{anime.title.english || anime.title.romaji}</h3><p className="mt-1 text-xs text-muted-foreground">{anime.format || "Anime"}{anime.seasonYear ? ` · ${anime.seasonYear}` : ""}{anime.episodes ? ` · ${anime.episodes} ép.` : ""}</p><div className="mt-3 flex flex-wrap gap-1">{anime.genres.slice(0,2).map((g)=><span key={g} className="rounded-full bg-secondary px-2 py-1 text-[10px]">{g}</span>)}</div><a href={anime.siteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Fiche détaillée <ExternalLink className="h-3 w-3"/></a></div>
      </article>)}</div>}
      <button onClick={() => void runSearch(page + 1)} className="mx-auto mt-8 flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold"><CalendarDays className="h-4 w-4"/> Charger la suite</button>
    </>}
    <p className="mt-8 text-center text-xs text-muted-foreground">Données de catalogue fournies par AniList. KOVA ne garantit pas la disponibilité des épisodes ni des doublages pour chaque titre.</p>
  </div>;
}
