import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";
import { searchExternalCatalog, type CatalogKind, type ExternalTitle } from "@/lib/catalog-api-hub";
import { searchAnime, animeTitle } from "@/lib/anilist";
import { searchManga } from "@/lib/mangadex";
import { Filters, useDebounced } from "./anime.index";

export const Route = createFileRoute("/catalogue-apis/")({
  head: () => ({
    meta: [
      { title: "Catalogue multi-API — Otaku-world" },
      { name: "description", content: "Recherche multi-sources d'anime et de manga avec classifications adaptées à l'âge." },
    ],
  }),
  component: MultiApiCatalog,
});

type DisplayTitle = {
  key: string;
  title: string;
  cover: string | null;
  description: string | null;
  score: number | null;
  year: number | null;
  source: string;
  url: string | null;
  genres: string[];
};

function MultiApiCatalog() {
  const [kind, setKind] = useState<CatalogKind>("anime");
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<"all" | "16" | "18">("all");
  const s = useDebounced(search, 400);

  const external = useQuery({
    queryKey: ["api-hub", kind, s],
    queryFn: () => searchExternalCatalog(kind, s, 10),
    enabled: s.trim().length >= 2,
    staleTime: 60_000,
  });

  const localAnime = useQuery({
    queryKey: ["api-hub-anilist", s],
    queryFn: () => searchAnime({ search: s, perPage: 12 }),
    enabled: kind === "anime" && s.trim().length >= 2,
    staleTime: 60_000,
  });

  const localManga = useQuery({
    queryKey: ["api-hub-mangadex", s],
    queryFn: () => searchManga({ search: s, limit: 12 }),
    enabled: kind === "manga" && s.trim().length >= 2,
    staleTime: 60_000,
  });

  const extResults: DisplayTitle[] = (external.data?.results ?? []).map((item: ExternalTitle) => ({
    key: `${item.provider}:${item.id}`,
    title: item.title,
    cover: item.cover,
    description: item.synopsis,
    score: item.score,
    year: item.year,
    source: item.provider,
    url: item.url,
    genres: item.genres,
  }));

  const nativeResults: DisplayTitle[] = kind === "anime"
    ? (localAnime.data ?? []).map((item: any) => ({
        key: `anilist:${item.id}`,
        title: animeTitle(item),
        cover: item.coverImage?.large ?? item.coverImage?.medium ?? null,
        description: item.description ?? null,
        score: typeof item.averageScore === "number" ? item.averageScore / 10 : null,
        year: item.seasonYear ?? null,
        source: "AniList",
        url: item.siteUrl ?? null,
        genres: item.genres ?? [],
      }))
    : (localManga.data ?? []).map((item: any) => ({
        key: `mangadex:${item.id}`,
        title: item.title,
        cover: item.cover ?? null,
        description: null,
        score: null,
        year: null,
        source: "MangaDex",
        url: null,
        genres: [],
      }));

  const merged = [...nativeResults, ...extResults].filter((item, index, all) =>
    all.findIndex((candidate) => candidate.title.trim().toLocaleLowerCase() === item.title.trim().toLocaleLowerCase()) === index
  );

  const visible = merged.filter((item) => {
    const genreText = item.genres.join(" ").toLowerCase();
    const isEcchi = genreText.includes("ecchi");
    const adultTerms = ["hentai", "adult", "erotica", "explicit", "pornographic", "18+"];
    const isAdultOrExplicit = adultTerms.some((term) => genreText.includes(term));
    // Hide adult-labelled titles by default; keep Ecchi in its dedicated +16 filter.
    if (rating === "16") return isEcchi && !isAdultOrExplicit;
    if (rating === "18") return false;
    return !isAdultOrExplicit && !isEcchi;
  });

  const busy = external.isFetching || localAnime.isFetching || localManga.isFetching;
  const hasQuery = s.trim().length >= 2;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 md:px-8">
      <h1 className="text-2xl font-extrabold md:text-4xl">Catalogue <span className="text-neon">multi-API</span></h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Recherche combinée : AniList, MangaDex, Jikan, Kitsu et Shikimori. Les sources peuvent avoir des limites de débit ou être temporairement indisponibles.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setKind("anime")} className={`rounded-xl border px-4 py-2 ${kind === "anime" ? "border-primary bg-primary/10" : "bg-card"}`}>Anime</button>
        <button type="button" onClick={() => setKind("manga")} className={`rounded-xl border px-4 py-2 ${kind === "manga" ? "border-primary bg-primary/10" : "bg-card"}`}>Manga / Manhwa / Manhua</button>
      </div>

      <Filters search={search} setSearch={setSearch} placeholder={kind === "anime" ? "Rechercher un anime…" : "Rechercher un manga…"}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRating("all")} className={`rounded-full border px-3 py-1.5 text-sm ${rating === "all" ? "border-primary bg-primary/10" : ""}`}>Toutes catégories</button>
          <button type="button" onClick={() => setRating("16")} className={`rounded-full border px-3 py-1.5 text-sm ${rating === "16" ? "border-primary bg-primary/10" : ""}`}>Ecchi <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-600">+16</span></button>
          <button type="button" onClick={() => setRating("18")} className={`rounded-full border px-3 py-1.5 text-sm ${rating === "18" ? "border-primary bg-primary/10" : ""}`}>Hentai <span className="ml-1 rounded bg-red-500/15 px-1.5 py-0.5 text-red-600">+18</span></button>
        </div>
      </Filters>

      {rating === "18" && (
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4" role="status">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <h2 className="font-semibold">Catégorie +18 verrouillée</h2>
            <p className="mt-1 text-sm text-muted-foreground">Les résultats et aperçus adultes ne sont pas chargés dans cette interface. La classification seule ne remplace pas une vérification d'âge fiable ni les règles de sécurité de la plateforme.</p>
          </div>
        </section>
      )}

      {!hasQuery && (
        <div className="mt-8 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Saisis au moins 2 caractères pour lancer la recherche sur les différentes API.
        </div>
      )}

      {hasQuery && busy && <p className="mt-6 text-sm text-muted-foreground">Recherche dans les catalogues…</p>}
      {hasQuery && (external.data?.providerErrors.length ?? 0) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Certaines sources sont indisponibles : {external.data?.providerErrors.join(", ")}. Les autres résultats restent affichés.</p>
      )}

      {hasQuery && rating !== "18" && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((item) => (
            <article key={item.key} className="overflow-hidden rounded-2xl border bg-card">
              {item.cover ? <img src={item.cover} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" /> : <div className="flex aspect-[2/3] items-center justify-center bg-muted"><Sparkles className="h-8 w-8 text-muted-foreground" /></div>}
              <div className="p-3">
                <h2 className="line-clamp-2 text-sm font-semibold">{item.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{item.source}{item.year ? ` · ${item.year}` : ""}{item.score ? ` · ★ ${item.score.toFixed(1)}` : ""}</p>
                {item.genres.some((genre) => genre.toLowerCase().includes("ecchi")) && <span className="mt-2 inline-block rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-700">+16 · Ecchi</span>}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Voir la fiche source</a>}
              </div>
            </article>
          ))}
        </div>
      )}

      {hasQuery && rating !== "18" && !busy && visible.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">{rating === "16" ? "Aucun résultat identifié comme ecchi par les métadonnées reçues." : "Aucun résultat trouvé."}</p>}
    </main>
  );
}
