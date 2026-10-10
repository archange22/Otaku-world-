import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Tv, ArrowRight } from "lucide-react";
import { searchManga, type Manga } from "@/lib/mangadex";
import { Rail, type CardData, warningFor } from "@/components/kova";
import { useLibrary } from "@/lib/library";
import mascot from "@/assets/kova-mascot.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOVA — Mangas, manhwas & manhuas" },
      { name: "description", content: "Découvre et lis des mangas, manhwas et manhuas sur KOVA." },
      { property: "og:title", content: "KOVA — Otaku-World" },
      { property: "og:description", content: "Explore les mangas et retrouve tes lectures au même endroit." },
    ],
  }),
  component: Home,
});

const m2c = (m: Manga): CardData => ({ id: m.id, title: m.title, cover: m.cover, sub: m.kind, kind: "manga", warning: warningFor(m.tags, m.adult) });

function Home() {
  const popular = useQuery({ queryKey: ["home-manga"], queryFn: () => searchManga({ limit: 16 }) });
  const manhwa = useQuery({ queryKey: ["home-manhwa"], queryFn: () => searchManga({ kind: "Manhwa", limit: 16 }) });
  const latest = useQuery({ queryKey: ["home-latest"], queryFn: () => searchManga({ sort: "latestUploadedChapter", limit: 16 }) });
  const { history } = useLibrary();

  return (
    <div className="mx-auto max-w-7xl">
      <section className="mx-0 overflow-hidden md:mx-8 md:mt-6 md:rounded-3xl">
        <div className="relative flex min-h-[420px] items-end overflow-hidden rounded-3xl border bg-card p-6 md:min-h-[500px] md:p-12">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="inline-flex rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">KOVA</span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">Ton univers manga, manhwa & manhua.</h1>
            <p className="mt-4 text-muted-foreground md:text-lg">Découvre de nouvelles séries manga et reprends facilement tes lectures.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/manga" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90">
                <BookOpen className="h-4 w-4" /> Explorer les mangas <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/anime" className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold transition hover:border-primary hover:text-primary">
                <Tv className="h-4 w-4" /> Découvrir les animes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-4 mt-8 flex items-center gap-4 overflow-hidden rounded-3xl border bg-card p-4 md:mx-8 md:gap-6 md:p-6">
        <img src={mascot} alt="Mascotte KOVA" className="h-20 w-20 shrink-0 rounded-2xl object-cover md:h-28 md:w-28" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-extrabold md:text-2xl">Bienvenue dans KOVA</h2>
          <p className="mt-1 text-sm text-muted-foreground">Crée ton compte pour garder tes favoris et reprendre tes lectures.</p>
        </div>
        <Link to="/auth" className="bg-neon hidden shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground sm:inline-flex">Rejoindre</Link>
      </section>

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
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="bg-neon h-full" style={{ width: `${Math.round(((h.page + 1) / Math.max(h.total, 1)) * 100)}%` }} /></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Page {h.page + 1}/{h.total}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Rail title="Mangas populaires" items={popular.data?.map(m2c)} loading={popular.isLoading} error={popular.isError} onRetry={() => void popular.refetch()} action={<Link to="/manga" className="text-sm font-semibold text-primary">Tout voir</Link>} />
      <Rail title="Manhwas du moment" items={manhwa.data?.map(m2c)} loading={manhwa.isLoading} error={manhwa.isError} onRetry={() => void manhwa.refetch()} />
      <Rail title="Nouveaux chapitres" items={latest.data?.map(m2c)} loading={latest.isLoading} error={latest.isError} onRetry={() => void latest.refetch()} />
    </div>
  );
}
