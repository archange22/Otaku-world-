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
  type Provider = "kova" | "sendvid" | "uqload" | "vidmoly" | "animesama" | "franime";
  const [provider, setProvider] = useState<Provider>("kova");
  const [customPlayerUrls, setCustomPlayerUrls] = useState<Record<string, string>>({});
  const playerNames: Record<Provider, string> = {
    kova: "KOVA", sendvid: "Sendvid", uqload: "Uqload",
    vidmoly: "Vidmoly", animesama: "Anime-Sama", franime: "FRAnime",
  };
  const playerUrl = provider === "kova"
    ? "https://ansembed.net/embed-h3gamyyzs0g9.html"
    : provider === "animesama" ? "https://animes-sama.fr/"
    : provider === "franime" ? "https://franime.fr/"
    : customPlayerUrls[provider]?.trim() ?? "";
  const isDirectPlayer = provider === "kova" || provider === "animesama" || provider === "franime";
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
                  <h2 className="text-lg font-bold">Lecteurs KOVA</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choisis le lecteur. KOVA est préconfiguré avec la source fournie. Pour Sendvid, Uqload et Vidmoly, colle l’URL d’intégration de la vidéo ou de l’épisode que tu as le droit de diffuser.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(["kova", "sendvid", "uqload", "vidmoly", "animesama", "franime"] as Provider[]).map((p) => (
                  <button key={p} type="button" onClick={() => setProvider(p)} aria-pressed={provider === p} className={`inline-flex min-h-12 items-center justify-center rounded-xl px-3 py-3 text-sm font-bold transition ${provider === p ? "bg-primary text-primary-foreground" : "border hover:border-primary"}`}>
                    {playerNames[p]}
                  </button>
                ))}
              </div>
              {!isDirectPlayer && (
                <div className="mt-4">
                  <label htmlFor="custom-player-url" className="mb-2 block text-sm font-semibold">URL d’intégration · {playerNames[provider]}</label>
                  <input id="custom-player-url" type="url" inputMode="url" placeholder="https://…/embed/…" value={customPlayerUrls[provider] ?? ""} onChange={(e) => setCustomPlayerUrls((old) => ({ ...old, [provider]: e.target.value }))} className="w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
                  <p className="mt-2 text-xs text-muted-foreground">L’URL est utilisée uniquement dans cette page. Elle n’est pas enregistrée dans ton compte ni partagée avec KOVA.</p>
                </div>
              )}
              <div className="mt-4 overflow-hidden rounded-xl border bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                  <span className="text-sm font-semibold">{playerNames[provider]} · lecteur</span>
                  {playerUrl && <a href={playerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:border-primary">Ouvrir séparément <ExternalLink className="h-4 w-4" /></a>}
                </div>
                {playerUrl ? (
                  <iframe key={provider + playerUrl} src={playerUrl} title={playerNames[provider] + " intégré à KOVA"} className="h-[65vh] min-h-[420px] w-full bg-background" loading="lazy" referrerPolicy="no-referrer" allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-6 text-center">
                    <Play className="h-8 w-8 text-muted-foreground" />
                    <p className="font-semibold">Ajoute l’URL du lecteur {playerNames[provider]}</p>
                    <p className="max-w-md text-sm text-muted-foreground">Il faut l’adresse d’intégration propre à la vidéo ou à l’épisode. KOVA ne peut pas deviner cette adresse à partir du seul nom du service.</p>
                  </div>
                )}
                <p className="border-t p-3 text-xs text-muted-foreground">Certains sites interdisent l’affichage intégré. Si le lecteur reste vide ou affiche une erreur, ouvre-le séparément. KOVA ne contourne pas les restrictions du service.</p>
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
