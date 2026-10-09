import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play, Star, BookOpen, SlidersHorizontal, X } from "lucide-react";
import { searchAnime, animeTitle, cleanText, type Anime } from "@/lib/anilist";
import { searchManga, type Manga } from "@/lib/mangadex";
import { Rail, type CardData } from "@/components/kova";
import { useLibrary } from "@/lib/library";
import mascot from "@/assets/kova-mascot.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOVA — Animes, mangas & manhwas" },
      { name: "description", content: "Tendances anime, nouveautés manga et manhwa, lecteur intégré : tout l'univers otaku sur KOVA." },
      { property: "og:title", content: "KOVA — Otaku-World" },
      { property: "og:description", content: "Explore les animes et lis mangas, manhwas et manhuas gratuitement." },
    ],
  }),
  component: Home,
});

const a2c = (a: Anime): CardData => ({ id: String(a.id), title: animeTitle(a), cover: a.coverImage.large, score: a.averageScore, sub: [a.format, a.episodes && `${a.episodes} ép.`].filter(Boolean).join(" · "), kind: "anime" });
export const m2c = (m: Manga): CardData => ({ id: m.id, title: m.title, cover: m.cover, sub: m.kind, kind: "manga" });

const DEFAULT_HOME_SECTIONS = { trending: true, airing: true, manga: true, manhwa: true, latest: true };
const HOME_SECTIONS = [
  { key: "trending", label: "Tendances anime" },
  { key: "airing", label: "Anime en cours" },
  { key: "manga", label: "Mangas populaires" },
  { key: "manhwa", label: "Manhwas du moment" },
  { key: "latest", label: "Nouveaux chapitres" },
] as const;

function Home() {
  const [visibleSections, setVisibleSections] = useState(DEFAULT_HOME_SECTIONS);
  const [customizing, setCustomizing] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kova:home-sections");
      if (saved) setVisibleSections({ ...DEFAULT_HOME_SECTIONS, ...JSON.parse(saved) });
    } catch {
      // Des préférences invalides ne doivent jamais empêcher l'accueil de s'afficher.
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem("kova:home-sections", JSON.stringify(visibleSections));
    } catch {
      // La personnalisation reste utilisable même si le stockage est indisponible.
    }
  }, [visibleSections, preferencesLoaded]);
  const trending = useQuery({ queryKey: ["home-trending"], queryFn: () => searchAnime({ sort: "TRENDING_DESC", perPage: 16 }) });
  const airing = useQuery({ queryKey: ["home-airing"], queryFn: () => searchAnime({ sort: "POPULARITY_DESC", status: "RELEASING", perPage: 16 }) });
  const popManga = useQuery({ queryKey: ["home-manga"], queryFn: () => searchManga({ limit: 16 }) });
  const manhwa = useQuery({ queryKey: ["home-manhwa"], queryFn: () => searchManga({ kind: "Manhwa", limit: 16 }) });
  const latest = useQuery({ queryKey: ["home-latest"], queryFn: () => searchManga({ sort: "latestUploadedChapter", limit: 16 }) });
  const { history } = useLibrary();
  const hero = trending.data?.find((a) => a.bannerImage) ?? trending.data?.[0];

  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative mx-0 overflow-hidden md:mx-8 md:mt-6 md:rounded-3xl">
        <div className="relative h-[62vh] min-h-[420px] md:h-[520px]">
          {hero ? (
            <img referrerPolicy="no-referrer" src={hero.bannerImage ?? hero.coverImage.extraLarge} alt="" className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700" />
          ) : (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          {hero && (
            <div className="absolute inset-x-0 bottom-0 p-5 md:max-w-2xl md:p-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                #1 Tendance
              </span>
              <h1 className="mt-3 line-clamp-2 text-2xl font-extrabold leading-tight md:text-4xl">{animeTitle(hero)}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {hero.averageScore && <span className="flex items-center gap-1 text-foreground"><Star className="h-4 w-4 fill-accent text-accent" />{hero.averageScore}%</span>}
                <span>{hero.format}</span>
                {hero.seasonYear && <span>{hero.seasonYear}</span>}
                <span>{hero.genres.slice(0, 3).join(" · ")}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground md:text-base">{cleanText(hero.description)}</p>
              <div className="mt-5 flex gap-3">
                <Link to="/anime/$id" params={{ id: String(hero.id) }} className="bg-neon shadow-neon inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-primary-foreground transition hover:scale-105">
                  <Play className="h-4 w-4 fill-current" /> Découvrir
                </Link>
                <Link to="/manga" className="inline-flex items-center gap-2 rounded-full border bg-secondary/60 px-6 py-3 text-sm font-bold backdrop-blur transition hover:border-primary">
                  <BookOpen className="h-4 w-4" /> Lire
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-4 mt-8 flex items-center gap-4 overflow-hidden rounded-3xl border bg-card p-4 md:mx-8 md:gap-6 md:p-6">
        <img src={mascot} alt="Mascotte KOVA" className="h-20 w-20 shrink-0 rounded-2xl object-cover md:h-28 md:w-28" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-extrabold md:text-2xl">Bienvenue dans l'<span className="text-neon">Otaku-World</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">Crée ton compte pour garder tes favoris et reprendre tes lectures.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={() => setCustomizing((v) => !v)} aria-expanded={customizing} className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition hover:border-primary">
            {customizing ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            <span className="hidden sm:inline">{customizing ? "Fermer" : "Personnaliser"}</span>
          </button>
          <Link to="/auth" className="bg-neon hidden shrink-0 rounded-full px-5 py-2.5 text-center text-sm font-bold text-primary-foreground sm:inline-flex">Rejoindre</Link>
        </div>
      </section>

      {customizing && (
        <section className="mx-4 mt-4 rounded-2xl border bg-card p-4 md:mx-8 md:p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold">Personnaliser l'accueil</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choisis les rubriques que tu veux voir. Tes préférences sont gardées sur cet appareil.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_SECTIONS.map((section) => (
              <label key={section.key} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background/50 p-3 text-sm font-medium transition hover:border-primary">
                <input type="checkbox" checked={visibleSections[section.key]} onChange={(event) => setVisibleSections((current) => ({ ...current, [section.key]: event.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
                {section.label}
              </label>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 px-4 md:px-8">
          <h2 className="mb-4 text-lg font-bold md:text-2xl">Reprendre la lecture</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto">
            {history.slice(0, 10).map((h) => (
              <Link key={h.mangaId} to="/read/$chapterId" params={{ chapterId: h.chapterId }} className="flex w-72 shrink-0 gap-3 rounded-2xl border bg-card p-3 transition hover:border-primary">
                {h.cover && <img referrerPolicy="no-referrer" src={h.cover} alt="" className="h-20 w-14 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{h.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.chapterLabel}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="bg-neon h-full" style={{ width: `${Math.round(((h.page + 1) / Math.max(h.total, 1)) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Page {h.page + 1}/{h.total}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {visibleSections.trending && <Rail title="Tendances anime" items={trending.data?.map(a2c)} loading={trending.isLoading} error={trending.isError} onRetry={() => void trending.refetch()} action={<Link to="/anime" className="text-sm font-semibold text-primary">Tout voir</Link>} />}
      {visibleSections.airing && <Rail title="En cours de diffusion" items={airing.data?.map(a2c)} loading={airing.isLoading} error={airing.isError} onRetry={() => void airing.refetch()} />}
      {visibleSections.manga && <Rail title="Mangas populaires" items={popManga.data?.map(m2c)} loading={popManga.isLoading} error={popManga.isError} onRetry={() => void popManga.refetch()} action={<Link to="/manga" className="text-sm font-semibold text-primary">Tout voir</Link>} />}
      {visibleSections.manhwa && <Rail title="Manhwas du moment" items={manhwa.data?.map(m2c)} loading={manhwa.isLoading} error={manhwa.isError} onRetry={() => void manhwa.refetch()} />}
      {visibleSections.latest && <Rail title="Nouveaux chapitres" items={latest.data?.map(m2c)} loading={latest.isLoading} error={latest.isError} onRetry={() => void latest.refetch()} />
    </div>
  );
}
