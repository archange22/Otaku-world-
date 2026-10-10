import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { searchManga, getTags, type MangaQuery, type Manga } from "@/lib/mangadex";
import { AdultContentBadge } from "@/components/AdultContentBadge";
import { useAuth } from "@/hooks/useAuth";
import { MediaCard, CardSkeleton, Chip, ErrorBox, EmptyState, Filters, SortSelect, warningFor } from "@/components/kova";

export const Route = createFileRoute("/manga/")({
  head: () => ({
    meta: [
      { title: "Mangas, Manhwas & Manhuas — KOVA" },
      { name: "description", content: "Trouve des mangas, manhwas et manhuas en français et en anglais." },
      { property: "og:title", content: "Mangas, Manhwas & Manhuas — KOVA" },
      { property: "og:description", content: "Catalogue manga KOVA avec filtres et protection des contenus sensibles." },
    ],
  }),
  component: MangaCatalog,
});

const KINDS = ["", "Manga", "Manhwa", "Manhua"];
const SORTS = [["followedCount", "Popularité"], ["rating", "Note"], ["latestUploadedChapter", "Nouveautés"], ["__ecchi", "Ecchi · +18 verrouillé"], ["__hentai", "Hentai · +18 verrouillé"]];
type SensitiveCategory = "Ecchi" | "Hentai";

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const mangaToCard = (m: Manga) => ({
  id: m.id, title: m.title, cover: m.cover, sub: `${m.kind} · ${m.status}`, kind: "manga" as const, warning: warningFor(m.tags, m.adult),
});

function MangaCatalog() {
  const { isOwner } = useAuth();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<MangaQuery["sort"]>("followedCount");
  const [sensitiveCategory, setSensitiveCategory] = useState<SensitiveCategory | null>(null);
  const s = useDebounced(search);
  const tags = useQuery({ queryKey: ["md-tags"], queryFn: getTags, staleTime: Infinity });
  const q = useQuery({
    queryKey: ["manga", s, kind, tag, sort, sensitiveCategory, isOwner],
    queryFn: () => searchManga({ search: s, kind, tag, sort: s ? undefined : sort, limit: 30 }),
    enabled: !sensitiveCategory,
    placeholderData: (p) => p,
  });

  const selectSensitive = (category: SensitiveCategory) => {
    setSensitiveCategory(category);
    setTag("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
      <h1 className="text-2xl font-extrabold md:text-4xl">Manga <span className="text-neon">&</span> Manhwa</h1>
      <p className="mt-2 text-sm text-muted-foreground">Explore le catalogue KOVA par format et par genre.</p>

      <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Catégories sensibles</span>
          <AdultContentBadge />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Ces catégories sont affichées pour signaler leur classement, mais leur catalogue et leur lecture restent verrouillés sur KOVA.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active={sensitiveCategory === "Ecchi"} onClick={() => selectSensitive("Ecchi")}>Ecchi · verrouillé</Chip>
          <Chip active={sensitiveCategory === "Hentai"} onClick={() => selectSensitive("Hentai")}>Hentai · verrouillé</Chip>
          {sensitiveCategory && <Chip active={false} onClick={() => setSensitiveCategory(null)}>Retour au catalogue</Chip>}
        </div>
      </div>

      {sensitiveCategory ? (
        <section className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-6" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold">{sensitiveCategory}</h2>
            <AdultContentBadge />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Cette catégorie est réservée aux adultes. KOVA ne charge ni ne recommande ses titres et bloque leur lecture. Les recommandations sensibles restent désactivées par défaut.</p>
          <button type="button" onClick={() => setSensitiveCategory(null)} className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-white/5">Revenir au catalogue général</button>
        </section>
      ) : (
        <>
          <Filters search={search} setSearch={setSearch} placeholder="Rechercher un titre…">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">{KINDS.map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{k || "Tous"}</Chip>)}</div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <Chip active={!tag} onClick={() => setTag("")}>Tous genres</Chip>
              {tags.data?.filter((t) => !/hentai|ecchi/i.test(t.name)).map((t) => <Chip key={t.id} active={tag === t.id} onClick={() => setTag(t.id)}>{t.name}</Chip>)}
            </div>
            <SortSelect value={sort ?? "followedCount"} onChange={(v) => { if (v === "__ecchi") selectSensitive("Ecchi"); else if (v === "__hentai") selectSensitive("Hentai"); else setSort(v as MangaQuery["sort"]); }} options={SORTS} />
          </Filters>
          {q.error && <ErrorBox msg="Impossible de joindre MangaDex pour le moment." onRetry={() => void q.refetch()} retrying={q.isFetching} />}
          <div aria-busy={q.isFetching} className={`mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-5 lg:grid-cols-6 ${q.isFetching ? "opacity-60" : ""} transition-opacity`}>
            {q.isLoading
              ? Array.from({ length: 18 }).map((_, i) => <CardSkeleton key={i} />)
              : q.data?.map((m) => <MediaCard key={m.id} d={mangaToCard(m)} />)}
          </div>
          {q.data?.length === 0 && <EmptyState text="Aucun résultat. Essaie un autre mot-clé ou retire un filtre." />}
        </>
      )}
    </div>
  );
}
