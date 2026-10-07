import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchAnime, animeTitle, ANIME_GENRES } from "@/lib/anilist";
import { MediaCard, CardSkeleton, Chip, ErrorBox } from "@/components/kova";

export const Route = createFileRoute("/anime/")({
  head: () => ({
    meta: [
      { title: "Catalogue Anime — KOVA" },
      { name: "description", content: "Recherche et filtre des milliers d'animes : séries TV, films, genres, notes." },
      { property: "og:title", content: "Catalogue Anime — KOVA" },
      { property: "og:description", content: "Tous les animes, en direct depuis AniList." },
    ],
  }),
  component: AnimeCatalog,
});

const FORMATS = [["", "Tous"], ["TV", "TV"], ["MOVIE", "Film"], ["OVA", "OVA"], ["ONA", "ONA"]];
const SORTS = [["POPULARITY_DESC", "Popularité"], ["SCORE_DESC", "Note"], ["TRENDING_DESC", "Tendance"], ["START_DATE_DESC", "Récents"]];

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
  const [sort, setSort] = useState("POPULARITY_DESC");
  const s = useDebounced(search);
  const q = useQuery({
    queryKey: ["anime", s, format, genre, sort],
    queryFn: () => searchAnime({ search: s, format, genre, sort: s ? "SEARCH_MATCH" : sort, perPage: 30 }),
    placeholderData: (p) => p,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
      <h1 className="text-2xl font-extrabold md:text-4xl">Anime</h1>
      <Filters search={search} setSearch={setSearch} placeholder="Rechercher un anime…">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">{FORMATS.map(([v, l]) => <Chip key={v} active={format === v} onClick={() => setFormat(v ?? "")}>{l}</Chip>)}</div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip active={!genre} onClick={() => setGenre("")}>Tous genres</Chip>
          {ANIME_GENRES.map((g) => <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Chip>)}
        </div>
        <SortSelect value={sort} onChange={setSort} options={SORTS} />
      </Filters>
      {q.error && <ErrorBox msg="Impossible de charger les animes." />}
      <div className={`mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-5 lg:grid-cols-6 ${q.isFetching ? "opacity-60" : ""} transition-opacity`}>
        {q.isLoading
          ? Array.from({ length: 18 }).map((_, i) => <CardSkeleton key={i} />)
          : q.data?.map((a) => (
              <MediaCard key={a.id} d={{ id: String(a.id), title: animeTitle(a), cover: a.coverImage.large, score: a.averageScore, sub: [a.format, a.episodes && `${a.episodes} ép.`].filter(Boolean).join(" · "), kind: "anime" }} />
            ))}
      </div>
      {q.data?.length === 0 && <p className="mt-10 text-center text-muted-foreground">Aucun résultat.</p>}
    </div>
  );
}

export function Filters({ search, setSearch, placeholder, children }: { search: string; setSearch: (s: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 space-y-3">
      <label className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 focus-within:border-primary focus-within:shadow-neon">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground" />
      </label>
      {children}
    </div>
  );
}

export function SortSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      Trier par
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border bg-card px-3 py-1.5 text-foreground outline-none focus:border-primary">
        {options.map(([v, l]) => <option key={v} value={v ?? ""}>{l}</option>)}
      </select>
    </div>
  );
}
