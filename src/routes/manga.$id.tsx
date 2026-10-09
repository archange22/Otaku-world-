import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Heart, Star, BookOpen, ArrowDownUp } from "lucide-react";
import { getManga, getChapters, chapterLabel } from "@/lib/mangadex";
import { lib, useLibrary } from "@/lib/library";
import { ErrorBox, Chip } from "@/components/kova";
import { MangaDownloadManager } from "@/components/manga-download-manager";

export const Route = createFileRoute("/manga/$id")({
  head: () => ({
    meta: [
      { title: "Fiche manga — KOVA" },
      { name: "description", content: "Synopsis, genres, note et chapitres en français et en anglais." },
      { property: "og:title", content: "Fiche manga — KOVA" },
      { property: "og:description", content: "Synopsis, genres, note et chapitres à lire." },
    ],
  }),
  component: MangaDetail,
});

function MangaDetail() {
  const { id } = Route.useParams();
  const m = useQuery({ queryKey: ["manga-detail", id], queryFn: () => getManga(id) });
  const ch = useQuery({ queryKey: ["chapters", id], queryFn: () => getChapters(id) });
  const { favs, progress, history } = useLibrary();
  const [lang, setLang] = useState<"all" | "fr" | "en">("all");
  const [desc, setDesc] = useState(false);

  useEffect(() => {
    if (m.data) lib.setMeta(id, m.data.title, m.data.cover);
  }, [m.data, id]);

  const list = useMemo(() => {
    const l = (ch.data ?? []).filter((c) => lang === "all" || c.lang === lang);
    return desc ? [...l].reverse() : l;
  }, [ch.data, lang, desc]);

  if (m.error) return <ErrorBox msg="Manga introuvable." />;
  if (m.isLoading || !m.data) return <div className="h-[50vh] animate-pulse bg-muted" />;
  const d = m.data;
  const isFav = favs.some((f) => f.kind === "manga" && f.id === id);
  const resume = history.find((h) => h.mangaId === id);
  const first = ch.data?.find((c) => c.lang === "fr") ?? ch.data?.[0];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="relative h-56 overflow-hidden md:h-80">
        {d.cover && <img referrerPolicy="no-referrer" src={d.cover} alt="" className="h-full w-full scale-110 object-cover opacity-50 blur-2xl" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="mx-auto -mt-36 max-w-6xl px-4 md:-mt-48 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {d.coverHq && <img referrerPolicy="no-referrer" src={d.cover!} alt={d.title} className="relative w-36 shrink-0 rounded-2xl shadow-neon ring-1 ring-border md:w-60" />}
          <div className="relative flex-1 md:pt-28">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{d.kind} · {d.status}{d.year ? ` · ${d.year}` : ""}</span>
            <h1 className="mt-1 text-2xl font-extrabold md:text-4xl">{d.title}</h1>
            {d.author && <p className="mt-1 text-sm text-muted-foreground">{d.author}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {d.score && <span className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-sm font-bold text-accent"><Star className="h-4 w-4 fill-current" />{d.score.toFixed(2)}</span>}
              {d.tags.map((g) => <span key={g} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{g}</span>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {(resume || first) && (
                <Link to="/read/$chapterId" preload="intent" params={{ chapterId: resume?.chapterId ?? first!.id }} className="bg-neon shadow-neon inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground">
                  <BookOpen className="h-4 w-4" /> {resume ? `Reprendre · ${resume.chapterLabel.split(" — ")[0]}` : "Commencer"}
                </Link>
              )}
              <button
                onClick={() => lib.toggleFav({ kind: "manga", id, title: d.title, cover: d.cover })}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${isFav ? "bg-secondary text-primary ring-1 ring-primary" : "border bg-secondary hover:border-primary"}`}
              >
                <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} /> {isFav ? "Favori" : "Favoris"}
              </button>
            </div>
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-lg font-bold">Synopsis</h2>
        <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{d.description.split(/\n-{3,}/)[0]!.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim() || "Pas de synopsis."}</p>

        <MangaDownloadManager mangaId={id} mangaTitle={d.title} chapters={list} />

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Chapitres {ch.data && <span className="text-muted-foreground">({list.length})</span>}</h2>
          <div className="flex items-center gap-2">
            <Chip active={lang === "all"} onClick={() => setLang("all")}>Tous</Chip>
            <Chip active={lang === "fr"} onClick={() => setLang("fr")}>FR</Chip>
            <Chip active={lang === "en"} onClick={() => setLang("en")}>EN</Chip>
            <button onClick={() => setDesc(!desc)} className="rounded-full border p-2 hover:border-primary" aria-label="Inverser l'ordre"><ArrowDownUp className="h-4 w-4" /></button>
          </div>
        </div>
        {ch.isLoading && <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>}
        {ch.error && <ErrorBox msg="Impossible de charger les chapitres." onRetry={() => void ch.refetch()} />}
        {ch.data && list.length === 0 && <p className="mt-6 text-muted-foreground">Aucun chapitre lisible disponible dans cette langue.</p>}
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {list.map((c) => {
            const read = progress[c.id] !== undefined;
            return (
              <li key={c.id}>
                <Link to="/read/$chapterId" preload="intent" params={{ chapterId: c.id }} className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition hover:border-primary ${read ? "opacity-60" : ""}`}>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${c.lang === "fr" ? "bg-primary/20 text-primary" : "bg-accent/15 text-accent"}`}>{c.lang}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{chapterLabel(c)}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.group ?? "—"} · {new Date(c.publishAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.pages} p.</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
