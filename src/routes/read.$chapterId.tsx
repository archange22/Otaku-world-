import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  RotateCw,
  BookOpen,
  Sun,
  Palette,
  Maximize2,
  Sliders,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getChapterInfo, getChapters, getPages, chapterLabel } from "@/lib/mangadex";
import { lib } from "@/lib/library";

export const Route = createFileRoute("/read/$chapterId")({
  head: () => ({
    meta: [
      { title: "Lecture — KOVA" },
      { name: "description", content: "Lecteur universel haute performance avec zoom tactile, reprise de lecture et réglages visuels." },
      { property: "og:title", content: "Lecture — KOVA" },
      { property: "og:description", content: "Lecteur 5 modes avec zoom par pincement, luminosité, thèmes et reprise automatique." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reader,
});

export type ReaderMode =
  | "webtoon"
  | "horizontal_rtl"
  | "horizontal_ltr"
  | "double_page"
  | "vertical_paged";

export type ReaderFit = "width" | "height" | "original";
export type ReaderBg = "pure-black" | "dark" | "sepia" | "light";

const READER_MODES: { id: ReaderMode; label: string; desc: string }[] = [
  { id: "webtoon", label: "Webtoon (Cascade)", desc: "Défilement vertical continu" },
  { id: "horizontal_rtl", label: "Manga (RTL)", desc: "De droite à gauche" },
  { id: "horizontal_ltr", label: "Comics/BD (LTR)", desc: "De gauche à droite" },
  { id: "double_page", label: "Double page", desc: "Format livre ouvert" },
  { id: "vertical_paged", label: "Vertical unitaire", desc: "Page par page vertical" },
];

const BG_STYLES: Record<ReaderBg, { bg: string; text: string; label: string }> = {
  "pure-black": { bg: "#000000", text: "#e5e5e5", label: "Noir pur (OLED)" },
  dark: { bg: "#121214", text: "#f3f4f6", label: "Sombre" },
  sepia: { bg: "#f4ecd8", text: "#3e2723", label: "Sépia reposant" },
  light: { bg: "#ffffff", text: "#18181b", label: "Clair" },
};

function ReaderPage({ src, alt, className, loading = "lazy" }: { src: string; alt: string; className?: string; loading?: "eager" | "lazy" }) {
  const [source, setSource] = useState(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSource(src); setFailed(false); }, [src]);
  if (failed) return <div role="alert" className="flex min-h-32 flex-col items-center justify-center gap-3 border border-white/10 p-4 text-center text-sm"><span>Planche indisponible.</span><button type="button" onClick={() => { setSource(src); setFailed(false); }} className="min-h-10 rounded-full border px-4">Réessayer</button></div>;
  return <img src={source} alt={alt} loading={loading} decoding="async" draggable={false} className={className} onError={() => { if (source.includes("/data/")) setSource(source.replace("/data/", "/data-saver/")); else setFailed(true); }} />;
}

function Reader() {
  const { chapterId } = Route.useParams();
  const navigate = useNavigate();

  // Settings states
  const [saver, setSaver] = useState(false);
  const [mode, setMode] = useState<ReaderMode>("webtoon");
  const [fit, setFit] = useState<ReaderFit>("width");
  const [bg, setBg] = useState<ReaderBg>("pure-black");
  const [brightness, setBrightness] = useState<number>(100); // 30% to 100%

  // Dialogs
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Reader navigation & zoom state
  const [page, setPage] = useState(0);
  const [ui, setUi] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const restored = useRef(false);
  const lastY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture refs for pinch-to-zoom & pan
  const touchStartDist = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const initialPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load preferences from localStorage
  useEffect(() => {
    setSaver(localStorage.getItem("kova:saver") === "1");
    const m = localStorage.getItem("kova:reader_mode") as ReaderMode;
    if (m && READER_MODES.some((x) => x.id === m)) setMode(m);
    const f = localStorage.getItem("kova:reader_fit") as ReaderFit;
    if (f) setFit(f);
    const b = localStorage.getItem("kova:reader_bg") as ReaderBg;
    if (b && BG_STYLES[b]) setBg(b);
    const br = localStorage.getItem("kova:reader_brightness");
    if (br) setBrightness(Number(br));
  }, []);

  const info = useQuery({ queryKey: ["chapter-info", chapterId], queryFn: () => getChapterInfo(chapterId) });
  const mangaId = info.data?.mangaId;
  const chapters = useQuery({ queryKey: ["chapters", mangaId], queryFn: () => getChapters(mangaId!), enabled: !!mangaId });
  const pages = useQuery({ queryKey: ["pages", chapterId, saver], queryFn: () => getPages(chapterId, saver), enabled: !!info.data, staleTime: 10 * 60_000 });

  const sameLang = useMemo(() => (chapters.data ?? []).filter((c) => c.lang === info.data?.lang), [chapters.data, info.data]);
  const idx = sameLang.findIndex((c) => c.id === chapterId);
  const current = sameLang[idx];
  const prev = idx > 0 ? sameLang[idx - 1] : undefined;
  const next = idx >= 0 ? sameLang[idx + 1] : undefined;
  const total = pages.data?.length ?? 0;

  // Chapter change reset & memory restore
  useEffect(() => {
    restored.current = false;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    window.scrollTo(0, 0);

    // Precise page memory restore
    const saved = lib.getProgress(chapterId);
    if (saved >= 0) {
      setPage(saved);
    } else {
      setPage(0);
    }
  }, [chapterId]);

  // Precise resume when pages are loaded
  useEffect(() => {
    if (!pages.data || restored.current) return;
    restored.current = true;
    const saved = lib.getProgress(chapterId);
    if (saved > 0 && saved < pages.data.length) {
      setPage(saved);
      if (mode === "webtoon") {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-page="${saved}"]`);
          el?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
        });
      }
    }
  }, [pages.data, chapterId, mode]);

  // Webtoon scroll tracking
  useEffect(() => {
    if (!pages.data || mode !== "webtoon") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setPage(Number((e.target as HTMLElement).dataset["page"]));
          }
        }
      },
      { rootMargin: "-30% 0px -30% 0px" },
    );
    document.querySelectorAll("[data-page]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pages.data, mode]);

  // Automatic progress save (manga, chapter, page, timestamp)
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

  // Pinch-to-zoom & Pan gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY
      );
      touchStartDist.current = dist;
      initialZoom.current = zoom;
    } else if (e.touches.length === 1 && zoom > 1) {
      panStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      initialPan.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY
      );
      const scale = dist / touchStartDist.current;
      const nextZoom = Math.min(Math.max(initialZoom.current * scale, 1), 4);
      setZoom(nextZoom);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && panStart.current && zoom > 1) {
      const dx = e.touches[0]!.clientX - panStart.current.x;
      const dy = e.touches[0]!.clientY - panStart.current.y;
      setPan({
        x: initialPan.current.x + dx,
        y: initialPan.current.y + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
    panStart.current = null;
    if (zoom <= 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Mouse wheel zoom + drag for desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.005;
      const nextZoom = Math.min(Math.max(zoom + delta, 1), 4);
      setZoom(nextZoom);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
    }
  };

  const isMouseDown = useRef(false);
  const mouseStart = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      isMouseDown.current = true;
      mouseStart.current = { x: e.clientX, y: e.clientY };
      initialPan.current = { ...pan };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMouseDown.current && mouseStart.current && zoom > 1) {
      const dx = e.clientX - mouseStart.current.x;
      const dy = e.clientY - mouseStart.current.y;
      setPan({
        x: initialPan.current.x + dx,
        y: initialPan.current.y + dy,
      });
    }
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    mouseStart.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (mode === "horizontal_rtl") prevPage();
        else nextPage();
      } else if (e.key === "ArrowLeft") {
        if (mode === "horizontal_rtl") nextPage();
        else prevPage();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        nextPage();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        prevPage();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === "-") {
        setZoom((z) => {
          const nextZ = Math.max(z - 0.25, 1);
          if (nextZ === 1) setPan({ x: 0, y: 0 });
          return nextZ;
        });
      } else if (e.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [page, total, mode]);

  // Hide UI on scroll (Webtoon mode only)
  useEffect(() => {
    if (mode !== "webtoon") {
      setUi(true);
      return;
    }
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) > 30) {
        setUi(y < lastY.current || y < 80);
        lastY.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  const go = (id?: string) => id && navigate({ to: "/read/$chapterId", params: { chapterId: id } });

  const nextPage = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (mode === "double_page") {
      if (page + 2 < total) setPage(page + 2);
      else if (next) go(next.id);
    } else {
      if (page + 1 < total) setPage(page + 1);
      else if (next) go(next.id);
    }
  };

  const prevPage = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (mode === "double_page") {
      if (page - 2 >= 0) setPage(page - 2);
      else if (prev) go(prev.id);
    } else {
      if (page - 1 >= 0) setPage(page - 1);
      else if (prev) go(prev.id);
    }
  };

  const currentTheme = BG_STYLES[bg];

  // Screen fit class
  const getFitStyle = () => {
    if (fit === "width") return "w-full max-w-full h-auto object-contain";
    if (fit === "height") return "h-[85vh] max-h-[85vh] w-auto object-contain mx-auto";
    return "w-auto max-w-none h-auto object-none"; // 100% original
  };

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
        filter: `brightness(${brightness}%)`,
      }}
      className="min-h-screen select-none transition-colors duration-300"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* HEADER */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-2xl transition-transform duration-300 ${
          ui ? "" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 text-white">
          {mangaId ? (
            <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full p-2 hover:bg-white/10" aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <Link to="/manga" className="rounded-full p-2 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
          )}

          {/* Chapter Selector */}
          <select
            value={chapterId}
            onChange={(e) => go(e.target.value)}
            className="min-w-0 flex-1 truncate rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-primary"
          >
            {!current && <option value={chapterId}>{info.data?.chapter ? `Ch. ${info.data.chapter}` : "Chargement…"}</option>}
            {sameLang.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                {chapterLabel(c)}
              </option>
            ))}
          </select>

          {/* 5 Reader Modes Menu */}
          <div className="relative">
            <button
              onClick={() => { setShowModeMenu(!showModeMenu); setShowSettings(false); }}
              className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/20 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/30"
              title="Changer de mode"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">{READER_MODES.find((m) => m.id === mode)?.label}</span>
            </button>

            {showModeMenu && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-white/15 bg-zinc-950 p-2 shadow-2xl backdrop-blur-2xl">
                <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">5 Modes de lecture</p>
                {READER_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      localStorage.setItem("kova:reader_mode", m.id);
                      setShowModeMenu(false);
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition ${
                      mode === m.id ? "bg-primary text-black font-bold" : "hover:bg-white/10 text-white"
                    }`}
                  >
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className={`text-[11px] ${mode === m.id ? "text-black/80" : "text-zinc-400"}`}>{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Display Settings Button (Brightness, Background, Screen Fit) */}
          <div className="relative">
            <button
              onClick={() => { setShowSettings(!showSettings); setShowModeMenu(false); }}
              className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
              title="Réglages d'affichage (Luminosité, Fond, Ajustement)"
            >
              <Sliders className="h-4 w-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-white/15 bg-zinc-950 p-4 shadow-2xl backdrop-blur-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Réglages d'affichage</p>

                {/* Luminosité */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-1.5">
                    <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5 text-amber-400" /> Luminosité</span>
                    <span>{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={brightness}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBrightness(val);
                      localStorage.setItem("kova:reader_brightness", String(val));
                    }}
                    className="w-full accent-primary"
                  />
                </div>

                {/* Couleur de fond */}
                <div className="mb-4">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-2">
                    <Palette className="h-3.5 w-3.5 text-indigo-400" /> Couleur de fond
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(BG_STYLES) as ReaderBg[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          setBg(key);
                          localStorage.setItem("kova:reader_bg", key);
                        }}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                          bg === key ? "border-primary bg-primary/20 text-white" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        <span className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: BG_STYLES[key].bg }} />
                        {BG_STYLES[key].label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ajustement à l'écran */}
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-2">
                    <Maximize2 className="h-3.5 w-3.5 text-emerald-400" /> Ajustement écran
                  </span>
                  <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
                    <button
                      onClick={() => { setFit("width"); localStorage.setItem("kova:reader_fit", "width"); }}
                      className={`flex-1 rounded py-1 font-medium transition ${fit === "width" ? "bg-primary text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                    >
                      Largeur
                    </button>
                    <button
                      onClick={() => { setFit("height"); localStorage.setItem("kova:reader_fit", "height"); }}
                      className={`flex-1 rounded py-1 font-medium transition ${fit === "height" ? "bg-primary text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                    >
                      Hauteur
                    </button>
                    <button
                      onClick={() => { setFit("original"); localStorage.setItem("kova:reader_fit", "original"); }}
                      className={`flex-1 rounded py-1 font-medium transition ${fit === "original" ? "bg-primary text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                    >
                      100%
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quality HQ/ÉCO */}
          <button
            onClick={() => {
              const nextVal = !saver;
              localStorage.setItem("kova:saver", nextVal ? "1" : "0");
              setSaver(nextVal);
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${
              saver ? "border-amber-400 text-amber-400" : "border-emerald-400 text-emerald-400"
            }`}
            title="Qualité des images"
          >
            <Gauge className="h-4 w-4" /> {saver ? "ÉCO" : "HQ"}
          </button>
        </div>
      </header>

      {/* ZOOM FLOATING CONTROLS (QUICK ZOOM / RESET) */}
      {zoom > 1 && (
        <div className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-white/20 bg-black/80 px-3 py-1.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            <RotateCcw className="h-3 w-3" /> Réinit.
          </button>
        </div>
      )}

      {/* READER CONTENT CONTAINER */}
      <main className="pt-14 pb-16 min-h-screen overflow-hidden">
        {pages.isLoading && (
          <div role="status" aria-label="Chargement des planches" className="flex h-[80vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {pages.error && (
          <div role="alert" className="flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">
            Impossible de récupérer les planches de ce chapitre.
            <button type="button" onClick={() => void pages.refetch()} className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Réessayer</button>
          </div>
        )}

        {/* 1. WEBTOON MODE */}
        {mode === "webtoon" && pages.data && (
          <div
            className="mx-auto max-w-3xl transition-transform duration-75"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "center top",
            }}
          >
            {pages.data.map((src, i) => (
              <div key={src} data-page={i} className="relative w-full">
                <ReaderPage src={src} alt={`Page ${i + 1}`} loading={i < 4 ? "eager" : "lazy"} className={`mx-auto block select-none ${getFitStyle()}`} />
              </div>
            ))}
            <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
              <p className="text-sm opacity-60">Fin du chapitre</p>
              {next ? (
                <button
                  onClick={() => go(next.id)}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-black shadow-lg"
                >
                  Chapitre suivant · {chapterLabel(next)}
                </button>
              ) : (
                mangaId && <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold">Retour à la fiche</Link>
              )}
            </div>
          </div>
        )}

        {/* 2 & 3. HORIZONTAL PAGED (RTL or LTR) */}
        {(mode === "horizontal_rtl" || mode === "horizontal_ltr") && pages.data && (
          <div className="relative mx-auto flex h-[calc(100vh-7.5rem)] max-w-4xl items-center justify-center px-2">
            {/* Click zones */}
            {zoom === 1 && (
              <>
                <div onClick={mode === "horizontal_rtl" ? nextPage : prevPage} className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize z-20" />
                <div onClick={() => setUi(!ui)} className="absolute inset-y-0 left-1/3 w-1/3 cursor-pointer z-20" />
                <div onClick={mode === "horizontal_rtl" ? prevPage : nextPage} className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize z-20" />
              </>
            )}

            {pages.data[page] && (
              <img
                src={pages.data[page]}
                alt={`Page ${page + 1}`}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  cursor: zoom > 1 ? "grab" : "default",
                }}
                className={`select-none shadow-2xl transition-transform duration-75 ${getFitStyle()}`}
              />
            )}
          </div>
        )}

        {/* 4. DOUBLE PAGE SPREAD */}
        {mode === "double_page" && pages.data && (
          <div className="relative mx-auto flex h-[calc(100vh-7.5rem)] max-w-6xl items-center justify-center gap-2 px-2">
            {zoom === 1 && (
              <>
                <div onClick={nextPage} className="absolute inset-y-0 left-0 w-1/4 cursor-pointer z-20" />
                <div onClick={() => setUi(!ui)} className="absolute inset-y-0 left-1/4 w-1/2 cursor-pointer z-20" />
                <div onClick={prevPage} className="absolute inset-y-0 right-0 w-1/4 cursor-pointer z-20" />
              </>
            )}

            <div
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                cursor: zoom > 1 ? "grab" : "default",
              }}
              className="flex items-center justify-center gap-2 max-h-full transition-transform duration-75"
            >
              {pages.data[page + 1] && (
                <img
                  src={pages.data[page + 1]}
                  alt={`Page ${page + 2}`}
                  className="max-h-[85vh] w-auto max-w-[48vw] select-none object-contain shadow-lg"
                />
              )}
              {pages.data[page] && (
                <img
                  src={pages.data[page]}
                  alt={`Page ${page + 1}`}
                  className="max-h-[85vh] w-auto max-w-[48vw] select-none object-contain shadow-lg"
                />
              )}
            </div>
          </div>
        )}

        {/* 5. VERTICAL PAGED */}
        {mode === "vertical_paged" && pages.data && (
          <div className="relative mx-auto flex h-[calc(100vh-7.5rem)] max-w-3xl flex-col items-center justify-center px-2">
            {zoom === 1 && (
              <>
                <div onClick={prevPage} className="absolute inset-x-0 top-0 h-1/3 cursor-n-resize z-20" />
                <div onClick={() => setUi(!ui)} className="absolute inset-x-0 top-1/3 h-1/3 cursor-pointer z-20" />
                <div onClick={nextPage} className="absolute inset-x-0 bottom-0 h-1/3 cursor-s-resize z-20" />
              </>
            )}

            {pages.data[page] && (
              <img
                src={pages.data[page]}
                alt={`Page ${page + 1}`}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  cursor: zoom > 1 ? "grab" : "default",
                }}
                className={`select-none shadow-2xl transition-transform duration-75 ${getFitStyle()}`}
              />
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer
        className={`fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl transition-transform duration-300 ${
          ui ? "" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-3 text-white">
          <button
            disabled={!prev && page === 0}
            onClick={mode === "webtoon" ? () => go(prev?.id) : prevPage}
            className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Préc.
          </button>

          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: total ? `${((page + 1) / total) * 100}%` : "0%" }}
              />
            </div>
            <p className="mt-1 text-center text-xs font-semibold tabular-nums opacity-75">
              {total ? `${page + 1} / ${total}` : "—"}
            </p>
          </div>

          <button
            disabled={!next && page >= total - 1}
            onClick={mode === "webtoon" ? () => go(next?.id) : nextPage}
            className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-30"
          >
            Suiv. <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
