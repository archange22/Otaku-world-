import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Star } from "lucide-react";
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
