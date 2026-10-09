import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchManga, getTags, type MangaQuery } from "@/lib/mangadex";
import { MediaCard, CardSkeleton, Chip, ErrorBox } from "@/components/kova";
import { Filters, SortSelect, useDebounced } from "./anime.index";
import { ContentSafetyNotice } from "@/components/content-safety-notice";

export const Route = createFileRoute("/manga/")({
  head: () => ({
    meta: [
      { title: "Mangas, Manhwas & Manhuas — KOVA" },
      { name: "description", content: "Trouve et lis tes mangas, manhwas et manhuas en français et en anglais." },
      { property: "og:title", content: "Mangas, Manhwas & Manhuas — KOVA" },
      { property: "og:description", content: "Catalogue MangaDex avec lecteur intégré." },
    ],
  }),
  component: MangaCatalog,
});

const KINDS = ["", "Manga", "Manhwa", "Manhua"];
const SORTS = [["followedCount", "Popularité"], ["rating", "Note"], ["latestUploadedChapter", "Nouveautés"]];

function MangaCatalog() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<MangaQuery["sort"]>("followedCount");
  const s = useDebounced(search);
  const tags = useQuery({ queryKey: ["md-tags"], queryFn: getTags, staleTime: Infinity });
  const q = useQuery({
    queryKey: ["manga", s, kind, tag, sort],
    queryFn: () => searchManga({ search: s, kind, tag, sort: s ? undefined : sort, limit: 30 }),
    placeholderData: (p) => p,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
      <h1 className="text-2xl font-extrabold md:text-4xl">Manga <span className="text-neon">&</span> Manhwa</h1>
      <ContentSafetyNotice />
      <Filters search={search} setSearch={setSearch} placeholder="Rechercher un titre…">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">{KINDS.map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{k || "Tous"}</Chip>)}</div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip active={!tag} onClick={() => setTag("")}>Tous genres</Chip>
          {tags.data?.map((t) => <Chip key={t.id} active={tag === t.id} onClick={() => setTag(t.id)}>{t.name}</Chip>)}
        </div>
        <SortSelect value={sort ?? "followedCount"} onChange={(v) => setSort(v as MangaQuery["sort"])} options={SORTS} />
      </Filters>
      {tags.error && <ErrorBox msg="Les genres MangaDex sont indisponibles." onRetry={() => void tags.refetch()} />}
      {q.error && <ErrorBox msg="Impossible de joindre MangaDex pour le moment." onRetry={() => void q.refetch()} />}
      <div className={`mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-5 lg:grid-cols-6 ${q.isFetching ? "opacity-60" : ""} transition-opacity`}>
        {q.isLoading
          ? Array.from({ length: 18 }).map((_, i) => <CardSkeleton key={i} />)
          : q.data?.map((m) => <MediaCard key={m.id} d={{ id: m.id, title: m.title, cover: m.cover, sub: `${m.kind} · ${m.status}`, kind: "manga" }} />)}
      </div>
      {q.data?.length === 0 && <p className="mt-10 text-center text-muted-foreground">Aucun résultat.</p>}
    </div>
  );
}
