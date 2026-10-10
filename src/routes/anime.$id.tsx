import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Star, Play, ExternalLink } from "lucide-react";
import { getAnime, animeTitle, cleanText } from "@/lib/anilist";
import { lib, useLibrary } from "@/lib/library";
import { ErrorBox } from "@/components/kova";

export const Route = createFileRoute("/anime/$id")({
  head: () => ({
    meta: [
      { title: "Fiche anime — KOVA" },
      { name: "description", content: "Synopsis, épisodes, note et bande-annonce officielle." },
      { property: "og:title", content: "Fiche anime — KOVA" },
      { property: "og:description", content: "Synopsis, épisodes, note et bande-annonce officielle." },
    ],
  }),
  component: AnimeDetail,
});

const STATUS: Record<string, string> = { FINISHED: "Terminé", RELEASING: "En cours", NOT_YET_RELEASED: "À venir", CANCELLED: "Annulé", HIATUS: "En pause" };

function AnimeDetail() {
  const { id } = Route.useParams();
  const { data: a, isLoading, error } = useQuery({ queryKey: ["anime-detail", id], queryFn: () => getAnime(Number(id)) });
  const { favs } = useLibrary();
  const [provider, setProvider] = useState<"animesama" | "franime">("animesama");
  if (error) return <ErrorBox msg="Anime introuvable." />;
  if (isLoading || !a) return <div className="h-[50vh] animate-pulse bg-muted" />;
  const title = animeTitle(a);
  const isFav = favs.some((f) => f.kind === "anime" && f.id === id);
  const meta = [
    ["Statut", a.status ? STATUS[a.status] ?? a.status : "—"],
    ["Format", a.format ?? "—"],
    ["Épisodes", a.episodes ?? "?"],
    ["Durée", a.duration ? `${a.duration} min` : "—"],
    ["Année", a.seasonYear ?? "—"],
    ["Studio", a.studios?.nodes[0]?.name ?? "—"],
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="relative h-56 md:h-96">
        {a.bannerImage ? <img src={a.bannerImage} alt="" className="h-full w-full object-cover" /> : <div className="bg-neon h-full opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>
      <div className="mx-auto -mt-28 max-w-6xl px-4 md:-mt-40 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          <img src={a.coverImage.extraLarge} alt={title} className="relative w-36 shrink-0 rounded-2xl shadow-neon ring-1 ring-border md:w-60" />
          <div className="relative flex-1 md:pt-32">
            <h1 className="text-2xl font-extrabold md:text-4xl">{title}</h1>
            {a.title.english && a.title.romaji !== a.title.english && <p className="mt-1 text-sm text-muted-foreground">{a.title.romaji}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {a.averageScore && <span className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-sm font-bold text-accent"><Star className="h-4 w-4 fill-current" />{a.averageScore}%</span>}
              {a.genres.map((g) => <span key={g} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{g}</span>)}
            </div>
            <button
              onClick={() => lib.toggleFav({ kind: "anime", id, title, cover: a.coverImage.large })}
              className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${isFav ? "bg-neon text-primary-foreground shadow-neon" : "border bg-secondary hover:border-primary"}`}
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} /> {isFav ? "Dans mes favoris" : "Ajouter aux favoris"}
            </button>
          </div>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
          <div>
            <h2 className="mb-3 text-lg font-bold">Synopsis</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{cleanText(a.description) || "Pas de synopsis disponible."}</p>
            <section className="mt-8 rounded-2xl border bg-card p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Play className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-lg font-bold">Regarder sur KOVA</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choisis un service. KOVA essaiera d’afficher son site ici. Certains services interdisent l’intégration : dans ce cas, utilise le bouton pour l’ouvrir dans un nouvel onglet.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setProvider("animesama")} aria-pressed={provider === "animesama"} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${provider === "animesama" ? "bg-primary text-primary-foreground" : "border hover:border-primary"}`}>Anime-Sama</button>
                <button type="button" onClick={() => setProvider("franime")} aria-pressed={provider === "franime"} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${provider === "franime" ? "bg-primary text-primary-foreground" : "border hover:border-primary"}`}>FRAnime</button>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                  <span className="text-sm font-semibold">{provider === "animesama" ? "Anime-Sama" : "FRAnime"} · lecteur externe</span>
                  <a href={provider === "animesama" ? `https://www.google.com/search?q=${encodeURIComponent(`${title} site:animes-sama.fr`)}` : `https://www.google.com/search?q=${encodeURIComponent(`${title} site:franime.fr`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:border-primary">Rechercher « {title} » <ExternalLink className="h-4 w-4" /></a>
                </div>
                <iframe
                  key={provider}
                  src={provider === "animesama" ? "https://animes-sama.fr/" : "https://franime.fr/"}
                  title={provider === "animesama" ? "Anime-Sama intégré à KOVA" : "FRAnime intégré à KOVA"}
                  className="h-[65vh] min-h-[420px] w-full bg-background"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  allow="fullscreen; encrypted-media; picture-in-picture"
                />
                <p className="border-t p-3 text-xs text-muted-foreground">Si la zone reste vide ou affiche une erreur, le service bloque probablement l’intégration. Ouvre-le avec le bouton de recherche ci-dessus. KOVA ne récupère ni ne diffuse les vidéos lui-même.</p>
              </div>
            </section>
            {a.trailer?.site === "youtube" && (
              <>
                <h2 className="mb-3 mt-8 text-lg font-bold">Bande-annonce</h2>
                <div className="aspect-video overflow-hidden rounded-2xl border">
                  <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${a.trailer.id}`} title="Bande-annonce" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                </div>
              </>
            )}
          </div>
          <dl className="h-fit rounded-2xl border bg-card p-5">
            {meta.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b py-2.5 text-sm last:border-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
