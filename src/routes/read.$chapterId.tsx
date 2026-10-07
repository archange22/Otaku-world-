import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Gauge, Loader2, RotateCw } from "lucide-react";
import { getChapterInfo, getChapters, getPages, chapterLabel } from "@/lib/mangadex";
import { lib } from "@/lib/library";

export const Route = createFileRoute("/read/$chapterId")({
  head: () => ({
    meta: [
      { title: "Lecture — KOVA" },
      { name: "description", content: "Lecteur vertical fluide pour mangas, manhwas et manhuas." },
      { property: "og:title", content: "Lecture — KOVA" },
      { property: "og:description", content: "Lecteur vertical intégré KOVA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reader,
});

function Page({ src, index, eager }: { src: string; index: number; eager: boolean }) {
  const [state, setState] = useState<"load" | "ok" | "err">("load");
  const [key, setKey] = useState(0);
  return (
    <div data-page={index} className="relative w-full" style={{ minHeight: state === "ok" ? undefined : "70vh" }}>
      {state !== "ok" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          {state === "load" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : (
            <button onClick={() => { setState("load"); setKey((k) => k + 1); }} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><RotateCw className="h-4 w-4" /> Recharger</button>
          )}
          <span className="text-xs">Page {index + 1}</span>
        </div>
      )}
      <img
        key={key}
        src={src}
        alt={`Page ${index + 1}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setState("ok")}
        onError={() => setState("err")}
        className={`mx-auto block w-full select-none transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function Reader() {
  const { chapterId } = Route.useParams();
  const navigate = useNavigate();
  const [saver, setSaver] = useState(false);
  const [page, setPage] = useState(0);
  const [ui, setUi] = useState(true);
  const restored = useRef(false);
  const lastY = useRef(0);

  useEffect(() => {
    setSaver(localStorage.getItem("kova:saver") === "1");
  }, []);

  const info = useQuery({ queryKey: ["chapter-info", chapterId], queryFn: () => getChapterInfo(chapterId) });
  const mangaId = info.data?.mangaId;
  const chapters = useQuery({ queryKey: ["chapters", mangaId], queryFn: () => getChapters(mangaId!), enabled: !!mangaId });
  const pages = useQuery({ queryKey: ["pages", chapterId, saver], queryFn: () => getPages(chapterId, saver), staleTime: 10 * 60_000 });

  const sameLang = useMemo(() => (chapters.data ?? []).filter((c) => c.lang === info.data?.lang), [chapters.data, info.data]);
  const idx = sameLang.findIndex((c) => c.id === chapterId);
  const current = sameLang[idx];
  const prev = idx > 0 ? sameLang[idx - 1] : undefined;
  const next = idx >= 0 ? sameLang[idx + 1] : undefined;
  const total = pages.data?.length ?? 0;

  // Reset on chapter change
  useEffect(() => {
    restored.current = false;
    setPage(0);
    window.scrollTo(0, 0);
  }, [chapterId]);

  // Restore saved page
  useEffect(() => {
    if (!pages.data || restored.current) return;
    restored.current = true;
    const saved = lib.getProgress(chapterId);
    if (saved > 0) {
      requestAnimationFrame(() => document.querySelector(`[data-page="${saved}"]`)?.scrollIntoView());
    }
  }, [pages.data, chapterId]);

  // Page tracking
  useEffect(() => {
    if (!pages.data) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setPage(Number((e.target as HTMLElement).dataset["page"]));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    document.querySelectorAll("[data-page]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pages.data]);

  // Preload next pages
  useEffect(() => {
    pages.data?.slice(page + 1, page + 4).forEach((src) => {
      const i = new Image();
      i.src = src;
    });
  }, [page, pages.data]);

  // Save progress
  useEffect(() => {
    if (!pages.data || !mangaId || !restored.current) return;
    const meta = lib.getMeta(mangaId);
    lib.saveProgress({
      mangaId,
      title: meta?.title ?? info.data?.mangaTitle ?? "Manga",
      cover: meta?.cover ?? null,
      chapterId,
      chapterLabel: current ? chapterLabel(current) : info.data?.chapter ? `Ch. ${info.data.chapter}` : "Chapitre",
      page,
      total: pages.data.length,
    });
  }, [page, pages.data, mangaId, chapterId, current, info.data]);

  // Hide UI on scroll down
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) > 30) {
        setUi(y < lastY.current || y < 80);
        lastY.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id?: string) => id && navigate({ to: "/read/$chapterId", params: { chapterId: id } });
  const toggleSaver = () => {
    localStorage.setItem("kova:saver", saver ? "0" : "1");
    setSaver(!saver);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className={`fixed inset-x-0 top-0 z-50 border-b bg-background/85 backdrop-blur-xl transition-transform duration-300 ${ui ? "" : "-translate-y-full"}`}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-3">
          {mangaId ? (
            <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full p-2 hover:bg-secondary" aria-label="Retour"><ArrowLeft className="h-5 w-5" /></Link>
          ) : <Link to="/manga" className="rounded-full p-2"><ArrowLeft className="h-5 w-5" /></Link>}
          <select
            value={chapterId}
            onChange={(e) => go(e.target.value)}
            className="min-w-0 flex-1 truncate rounded-lg border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            {!current && <option value={chapterId}>{info.data?.chapter ? `Ch. ${info.data.chapter}` : "Chargement…"}</option>}
            {sameLang.map((c) => <option key={c.id} value={c.id}>{chapterLabel(c)}</option>)}
          </select>
          <button
            onClick={toggleSaver}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${saver ? "border-accent text-accent" : "border-primary text-primary"}`}
            title="Qualité"
          >
            <Gauge className="h-4 w-4" /> {saver ? "ÉCO" : "HQ"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl pt-14">
        {pages.isLoading && <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
        {pages.error && <div className="p-8 text-center text-muted-foreground">Impossible de récupérer les planches de ce chapitre.</div>}
        {pages.data?.map((src, i) => <Page key={src} src={src} index={i} eager={i < 3} />)}
        {pages.data && (
          <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">Fin du chapitre</p>
            {next ? (
              <button onClick={() => go(next.id)} className="bg-neon shadow-neon rounded-full px-6 py-3 text-sm font-bold text-primary-foreground">Chapitre suivant · {chapterLabel(next)}</button>
            ) : mangaId && <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full border px-6 py-3 text-sm font-bold">Retour à la fiche</Link>}
          </div>
        )}
      </div>

      <footer className={`fixed inset-x-0 bottom-0 z-50 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-transform duration-300 ${ui ? "" : "translate-y-full"}`}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-3">
          <button disabled={!prev} onClick={() => go(prev?.id)} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Préc.</button>
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="bg-neon h-full transition-all" style={{ width: total ? `${((page + 1) / total) * 100}%` : "0%" }} />
            </div>
            <p className="mt-1 text-center text-xs font-semibold tabular-nums text-muted-foreground">{total ? `${page + 1} / ${total}` : "—"}</p>
          </div>
          <button disabled={!next} onClick={() => go(next?.id)} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-30">Suiv. <ChevronRight className="h-4 w-4" /></button>
        </div>
      </footer>
    </div>
  );
}
