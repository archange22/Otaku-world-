import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import { searchAnime, animeTitle, ANIME_GENRES } from "@/lib/anilist";
import { MediaCard, CardSkeleton, Chip, ErrorBox } from "@/components/kova";

export const Route = createFileRoute("/anime/")({
  head: () => ({
    meta: [
      { title: "Catalogue Anime — KOVA" },
      { name: "description", content: "Explore les animes par titre, genre, format, statut, popularité et note." },
      { property: "og:title", content: "Catalogue Anime — KOVA" },
      { property: "og:description", content: "Un catalogue anime interactif avec recherche et filtres." },
    ],
  }),
  component: AnimeCatalog,
});

const FORMATS = [["", "Tous les formats"], ["TV", "Série TV"], ["MOVIE", "Film"], ["OVA", "OVA"], ["ONA", "ONA"], ["SPECIAL", "Spécial"], ["TV_SHORT", "Épisode court"]];
const STATUSES = [["", "Tous les statuts"], ["RELEASING", "En cours"], ["FINISHED", "Terminé"], ["NOT_YET_RELEASED", "À venir"], ["HIATUS", "En pause"]];
const SORTS = [["POPULARITY_DESC", "Popularité"], ["SCORE_DESC", "Mieux notés"], ["TRENDING_DESC", "Tendances"], ["START_DATE_DESC", "Plus récents"], ["FAVOURITES_DESC", "Favoris"]];

export function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function AnimeCatalog() {
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("");
  const [genre, setGenre] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("POPULARITY_DESC");
  const [page, setPage] = useState(1);
  const s = useDebounced(search);
  useEffect(() => setPage(1), [s, format, genre, status, sort]);

  const q = useQuery({
    queryKey: ["anime-catalog", s, format, genre, status, sort, page],
    queryFn: () => searchAnime({
      search: s, format, genre, status,
      sort: s ? "SEARCH_MATCH" : sort,
      page, perPage: 30,
    }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    retry: 1,
  });

  const reset = () => {
    setSearch("");
    setFormat("");
    setGenre("");
    setStatus("");
    setSort("POPULARITY_DESC");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">Découverte KOVA</p>
          <h1 className="text-2xl font-extrabold md:text-4xl">Catalogue anime</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Trouve ta prochaine série avec les filtres, les notes et les tendances.</p>
        </div>
        <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">Catalogue public · AniList</span>
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-3 md:p-5">
        <Filters search={search} setSearch={setSearch} placeholder="Titre japonais, français ou anglais…">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><SlidersHorizontal className="h-4 w-4" /> Genres</div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip active={!genre} onClick={() => setGenre("")}>Tous les genres</Chip>
            {ANIME_GENRES.map((g) => <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Chip>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FilterSelect label="Format" value={format} onChange={setFormat} options={FORMATS} />
            <FilterSelect label="Statut" value={status} onChange={setStatus} options={STATUSES} />
            <FilterSelect label="Trier par" value={sort} onChange={setSort} options={SORTS} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Astuce : combine un genre et un statut pour affiner la recherche.</p>
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold hover:border-primary"><RotateCcw className="h-4 w-4" /> Réinitialiser</button>
          </div>
        </Filters>
      </div>

      {q.error && <div className="mt-5"><ErrorBox msg="Le catalogue est momentanément indisponible. Vérifie ta connexion puis réessaie." /><div className="px-4"><button type="button" onClick={() => void q.refetch()} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:border-primary">Réessayer</button></div></div>}

      <div className="mt-7 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{s ? `Résultats pour « ${s} »` : "À explorer"}</h2>
        <span className="text-xs text-muted-foreground">Page {page}</span>
      </div>
      <div className={`mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 md:gap-x-5 lg:grid-cols-6 ${q.isFetching && !q.isLoading ? "opacity-60" : ""} transition-opacity`}>
        {q.isLoading
          ? Array.from({ length: 18 }).map((_, i) => <CardSkeleton key={i} />)
          : q.data?.map((a) => (
              <MediaCard key={a.id} d={{
                id: String(a.id), title: animeTitle(a), cover: a.coverImage.large,
                score: a.averageScore,
                sub: [a.format, a.seasonYear, a.episodes && `${a.episodes} ép.`].filter(Boolean).join(" · "),
                kind: "anime",
              }} />
            ))}
      </div>
      {!q.isLoading && !q.error && q.data?.length === 0 && <div className="mt-12 rounded-2xl border border-dashed p-8 text-center"><p className="font-bold">Aucun anime trouvé</p><p className="mt-2 text-sm text-muted-foreground">Essaie un autre titre ou enlève un filtre.</p><button type="button" onClick={reset} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Effacer les filtres</button></div>}
      {!q.error && q.data && q.data.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1 || q.isFetching} onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">Précédent</button>
          <span className="min-w-20 text-center text-sm text-muted-foreground">Page {page}</span>
          <button type="button" disabled={q.data.length < 30 || q.isFetching} onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Suivant</button>
        </div>
      )}
      <p className="mt-8 text-center text-xs text-muted-foreground">Les fiches et notes sont fournies par AniList. Les informations peuvent varier selon la disponibilité des données.</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-semibold text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-3 text-foreground outline-none focus:border-primary">
        {options.map(([v, l]) => <option key={v} value={v ?? ""}>{l}</option>)}
      </select>
    </label>
  );
}

export function Filters({ search, setSearch, placeholder, children }: { search: string; setSearch: (s: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 focus-within:border-primary focus-within:shadow-neon">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} aria-label="Rechercher un anime" className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        {search && <button type="button" onClick={() => setSearch("")} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Effacer</button>}
      </label>
      {children}
    </div>
  );
}

export function SortSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return <FilterSelect label="Trier par" value={value} onChange={onChange} options={options} />;
}
