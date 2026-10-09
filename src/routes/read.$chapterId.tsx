import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Gauge, Loader2, RotateCw, Download, WifiOff, Trash2 } from "lucide-react";
import { getChapterInfo, getChapters, getPages, chapterLabel } from "@/lib/mangadex";
import { lib } from "@/lib/library";
import { getSavedChapter, getSavedPageUrls, saveChapterOffline, removeSavedChapter, getOfflineSummary } from "@/lib/reader-offline";

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

type ReaderMode = "eco-plus" | "eco" | "super" | "super-plus";

function Page({ src, index, eager, retryKey }: { src: string; index: number; eager: boolean; retryKey: number }) {
  const [state, setState] = useState<"load" | "ok" | "err">("load");
  const [attempt, setAttempt] = useState(0);
  return (
    <div data-page={index} className="relative w-full" style={{ minHeight: state === "ok" ? undefined : "50vh" }}>
      {state !== "ok" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          {state === "load" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : (
            <button onClick={() => { setState("load"); setAttempt((value) => value + 1); }} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
              <RotateCw className="h-4 w-4" /> Réessayer l’image
            </button>
          )}
          <span className="text-xs">Page {index + 1}</span>
        </div>
      )}
      <img
        key={src + ":" + retryKey + ":" + attempt}
        src={src}
        alt={"Page " + (index + 1)}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setState("ok")}
        onError={() => setState("err")}
        className={"mx-auto block w-full select-none transition-opacity duration-300 " + (state === "ok" ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

function Reader() {
  const { chapterId } = Route.useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<ReaderMode>("eco");
  const saver = mode === "eco-plus";
  const [offlineProgress, setOfflineProgress] = useState<{ done: number; total: number } | null>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [page, setPage] = useState(0);
  const [ui, setUi] = useState(true);
  const restored = useRef(false);
  const lastY = useRef(0);

  useEffect(() => {
    void getOfflineSummary().then((summary) => setSavedCount(summary.count)).catch(() => setSavedCount(0));
    try {
      const stored = localStorage.getItem("kova:reader-mode");
      if (stored === "eco-plus" || stored === "eco" || stored === "super" || stored === "super-plus") setMode(stored);
      else if (localStorage.getItem("kova:saver") === "1") setMode("eco-plus");
    } catch {
      // Storage may be disabled in private browsing.
    }
  }, []);

  const info = useQuery({ queryKey: ["chapter-info", chapterId], queryFn: () => getChapterInfo(chapterId) });
  const mangaId = info.data?.mangaId;
  const chapters = useQuery({ queryKey: ["chapters", mangaId], queryFn: () => getChapters(mangaId!), enabled: !!mangaId });
  const pages = useQuery({
    queryKey: ["pages", chapterId, saver],
    queryFn: async () => (await getSavedPageUrls(chapterId)) ?? getPages(chapterId, saver),
    enabled: !!info.data && !info.error,
    staleTime: 10 * 60_000,
  });

  const sameLang = useMemo(() => (chapters.data ?? []).filter((c) => c.lang === info.data?.lang), [chapters.data, info.data]);
  const idx = sameLang.findIndex((c) => c.id === chapterId);
  const current = sameLang[idx];
  const prev = idx > 0 ? sameLang[idx - 1] : undefined;
  const next = idx >= 0 ? sameLang[idx + 1] : undefined;
  const total = pages.data?.length ?? 0;

  useEffect(() => {
    restored.current = false;
    setPage(0);
    window.scrollTo(0, 0);
  }, [chapterId]);

  useEffect(() => {
    if (!pages.data || restored.current) return;
    restored.current = true;
    const saved = lib.getProgress(chapterId);
    if (saved > 0) requestAnimationFrame(() => document.querySelector('[data-page="' + saved + '"]')?.scrollIntoView());
  }, [pages.data, chapterId]);

  useEffect(() => {
    if (!pages.data) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setPage(Number((entry.target as HTMLElement).dataset["page"]));
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll("[data-page]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pages.data]);

  useEffect(() => {
    const ahead = mode === "eco-plus" ? 0 : mode === "eco" ? 1 : 3;
    pages.data?.slice(page + 1, page + 1 + ahead).forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, [page, pages.data, mode]);

  useEffect(() => {
    if (!pages.data || !mangaId || !restored.current) return;
    const meta = lib.getMeta(mangaId);
    lib.saveProgress({
      mangaId,
      title: meta?.title ?? info.data?.mangaTitle ?? "Manga",
      cover: meta?.cover ?? null,
      chapterId,
      chapterLabel: current ? chapterLabel(current) : info.data?.chapter ? "Ch. " + info.data.chapter : "Chapitre",
      page,
      total: pages.data.length,
    });
  }, [page, pages.data, mangaId, chapterId, current, info.data]);

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

  const go = (id?: string) => {
    if (id) void navigate({ to: "/read/$chapterId", params: { chapterId: id } });
  };

  const changeMode = (value: ReaderMode) => {
    setMode(value);
    try {
      localStorage.setItem("kova:reader-mode", value);
      localStorage.setItem("kova:saver", value === "eco-plus" ? "1" : "0");
    } catch {
      // Keep the current session usable even when storage is disabled.
    }
  };

  const downloadChapter = async (id: string) => {
    setOfflineError(null);
    try {
      const urls = await getPages(id, mode === "eco-plus");
      await saveChapterOffline(id, urls, (done, count) => setOfflineProgress({ done, total: count }), info.data ? { mangaId: info.data.mangaId, mangaTitle: info.data.mangaTitle, lang: info.data.lang, chapter: info.data.chapter } : undefined);
      const summary = await getOfflineSummary();
      setSavedCount(summary.count);
    } catch (error) {
      setOfflineError(error instanceof Error ? error.message : "Téléchargement hors ligne impossible.");
    } finally {
      setOfflineProgress(null);
    }
  };

  const downloadAllChapters = async () => {
    setOfflineError(null);
    if (!sameLang.length) {
      setOfflineError("La liste des chapitres n’est pas encore chargée.");
      return;
    }
    let done = 0;
    setOfflineProgress({ done, total: sameLang.length });
    try {
      for (const chapter of sameLang) {
        if (!await getSavedChapter(chapter.id)) {
          const urls = await getPages(chapter.id, true);
          await saveChapterOffline(chapter.id, urls, undefined, { mangaId: mangaId!, mangaTitle: info.data?.mangaTitle ?? "Manga", lang: chapter.lang, chapter: chapter.chapter });
        }
        done += 1;
        setOfflineProgress({ done, total: sameLang.length });
        const summary = await getOfflineSummary();
        setSavedCount(summary.count);
      }
    } catch (error) {
      setOfflineError(error instanceof Error ? error.message : "Le téléchargement groupé s’est arrêté.");
    } finally {
      setOfflineProgress(null);
    }
  };

  const deleteChapterOffline = async () => {
    try {
      await removeSavedChapter(chapterId);
      setSavedCount((count) => Math.max(0, count - 1));
      setRetryKey((key) => key + 1);
      void pages.refetch();
    } catch {
      setOfflineError("Impossible de supprimer ce téléchargement.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className={"fixed inset-x-0 top-0 z-50 border-b bg-background/85 backdrop-blur-xl transition-transform duration-300 " + (ui ? "" : "-translate-y-full")}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-3">
          {mangaId ? (
            <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full p-2 hover:bg-secondary" aria-label="Retour"><ArrowLeft className="h-5 w-5" /></Link>
          ) : <Link to="/manga" className="rounded-full p-2" aria-label="Retour"><ArrowLeft className="h-5 w-5" /></Link>}
          <select value={chapterId} onChange={(event) => go(event.target.value)} className="min-w-0 flex-1 truncate rounded-lg border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary" aria-label="Choisir un chapitre">
            {!current && <option value={chapterId}>{info.data?.chapter ? "Ch. " + info.data.chapter : "Chargement…"}</option>}
            {sameLang.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapterLabel(chapter)}</option>)}
          </select>
          <select aria-label="Mode de lecture" value={mode} onChange={(event) => changeMode(event.target.value as ReaderMode)} className="max-w-[7.5rem] rounded-lg border bg-card px-2 py-2 text-xs font-bold outline-none focus:border-primary">
            <option value="eco-plus">Éco+</option>
            <option value="eco">Éco</option>
            <option value="super">Super</option>
            <option value="super-plus">Super+</option>
          </select>
          <button onClick={() => void downloadChapter(chapterId)} disabled={!!offlineProgress} className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2.5 py-2 text-xs font-bold text-primary disabled:opacity-50" title="Télécharger ce chapitre pour le lire hors connexion">
            <Download className="h-4 w-4" /> {offlineProgress ? offlineProgress.done + "/" + offlineProgress.total : "Hors ligne"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl pt-14">
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
          <Gauge className="h-4 w-4 text-primary" />
          <span>{mode === "eco-plus" ? "Une page à la fois, qualité légère" : mode === "eco" ? "Précharge la page suivante" : mode === "super" ? "Précharge 3 pages" : "Téléchargement hors ligne disponible"}</span>
          <span className="ml-auto inline-flex items-center gap-1"><WifiOff className="h-3.5 w-3.5" /> {savedCount} chap. hors ligne</span>
          {mode === "super-plus" && <button onClick={() => void downloadAllChapters()} disabled={!!offlineProgress || chapters.isLoading} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 font-bold text-primary disabled:opacity-50"><Download className="h-3.5 w-3.5" /> {offlineProgress ? "Téléchargement " + offlineProgress.done + "/" + offlineProgress.total : "Télécharger tous les chapitres"}</button>}
        </div>
        {offlineError && <div role="alert" className="mx-3 mt-2 rounded-xl border border-destructive/30 bg-card p-3 text-xs text-muted-foreground">{offlineError}</div>}
        {info.isError && <div role="alert" className="m-4 rounded-2xl border border-destructive/30 bg-card p-6 text-center"><p className="font-semibold">Ce chapitre ne peut pas être ouvert.</p><p className="mt-2 text-sm text-muted-foreground">Il est peut-être indisponible ou bloqué par le filtre de sécurité.</p><button onClick={() => void info.refetch()} className="mt-4 rounded-full border px-4 py-2 text-sm font-bold hover:border-primary">Réessayer</button></div>}
        {pages.isLoading && info.data && <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
        {pages.error && <div role="alert" className="p-8 text-center text-muted-foreground"><p>Impossible de récupérer les planches de ce chapitre.</p><button onClick={() => void pages.refetch()} className="mt-3 rounded-full border px-4 py-2 text-sm font-bold hover:border-primary">Réessayer</button></div>}
        {pages.data?.map((src, index) => <Page key={src + ":" + retryKey} src={src} index={index} eager={index === page || (mode !== "eco-plus" && index <= page + (mode === "eco" ? 1 : 3))} retryKey={retryKey} />)}
        {pages.data && (
          <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">Fin du chapitre</p>
            <button onClick={() => void downloadChapter(chapterId)} disabled={!!offlineProgress} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50"><Download className="h-4 w-4" /> Télécharger ce chapitre</button>
            <button onClick={() => void deleteChapterOffline()} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"><Trash2 className="h-3.5 w-3.5" /> Supprimer le téléchargement</button>
            {next ? (
              <button onClick={() => go(next.id)} className="bg-neon shadow-neon rounded-full px-6 py-3 text-sm font-bold text-primary-foreground">Chapitre suivant · {chapterLabel(next)}</button>
            ) : mangaId && <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full border px-6 py-3 text-sm font-bold">Retour à la fiche</Link>}
          </div>
        )}
      </div>

      <footer className={"fixed inset-x-0 bottom-0 z-50 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-transform duration-300 " + (ui ? "" : "translate-y-full")}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-3">
          <button disabled={!prev} onClick={() => go(prev?.id)} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Préc.</button>
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="bg-neon h-full transition-all" style={{ width: total ? ((page + 1) / total * 100) + "%" : "0%" }} /></div>
            <p className="mt-1 text-center text-xs font-semibold tabular-nums text-muted-foreground">{total ? (page + 1) + " / " + total : "—"}</p>
          </div>
          <button disabled={!next} onClick={() => go(next?.id)} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-30">Suiv. <ChevronRight className="h-4 w-4" /></button>
        </div>
      </footer>
    </div>
  );
}
