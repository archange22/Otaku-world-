import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Play, ShieldAlert, ExternalLink, Link2 } from "lucide-react";

export const Route = createFileRoute("/watch")({
  head: () => ({ meta: [
    { title: "Lecteur vidéo | KOVA" },
    { name: "description", content: "Lecteur intégré KOVA pour les sources vidéo autorisées." },
  ] }),
  component: WatchPage,
});

const EXAMPLE_URL = "https://ansembed.net/embed-h3gamyyzs0g9.html";
const SOURCE_HINTS = [
  { name: "Ansembed", host: "ansembed.net" },
  { name: "Sendvid", host: "sendvid.com" },
  { name: "Uqload", host: "uqload." },
  { name: "Vidmoly", host: "vidmoly." },
];

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch { return false; }
}

function WatchPage() {
  const [sourceUrl, setSourceUrl] = useState(EXAMPLE_URL);
  const [activeUrl, setActiveUrl] = useState(EXAMPLE_URL);
  const [error, setError] = useState("");
  const host = (() => { try { return new URL(activeUrl).hostname; } catch { return ""; } })();
  const sourceName = SOURCE_HINTS.find((s) => host.includes(s.host))?.name || "Source externe";

  const loadSource = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validHttpsUrl(sourceUrl)) {
      setError("Entre une URL HTTPS valide. KOVA ne peut pas garantir que toutes les sources autorisent l'intégration.");
      return;
    }
    setError("");
    setActiveUrl(sourceUrl.trim());
  };

  return <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
    <Link to="/anime" className="text-sm font-semibold text-primary hover:underline">← Retour au catalogue Anime</Link>
    <section className="mt-4 rounded-3xl border bg-card p-5 md:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">KOVA PLAYER</p>
      <h1 className="mt-2 text-2xl font-extrabold md:text-4xl">Lecteur intégré</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ouvre une source vidéo autorisée dans le lecteur intégré. Certaines plateformes bloquent l'intégration externe ou exigent leur propre lecteur.</p>

      <form onSubmit={loadSource} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground"/>
          <input aria-label="URL de la source vidéo" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://exemple.com/embed/..." className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/>
        </label>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"><Play className="h-4 w-4"/> Charger la source</button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Source active : <strong className="text-foreground">{sourceName}</strong></span>
        <a href={activeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary">Ouvrir à part <ExternalLink className="h-3 w-3"/></a>
      </div>
      <div className="mt-3 aspect-video overflow-hidden rounded-2xl border bg-black">
        <iframe key={activeUrl} src={activeUrl} title="Lecteur vidéo KOVA" className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" />
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-xl border bg-secondary/30 p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary"/>
        <p className="text-muted-foreground">Si le lecteur reste noir, la source peut refuser les iframes. Utilise uniquement des liens que tu es autorisé à intégrer. Cette page ne télécharge ni ne réhéberge la vidéo, et ne contourne pas les restrictions du fournisseur.</p>
      </div>
    </section>
    <section className="mt-5 rounded-2xl border p-5">
      <h2 className="font-bold">Sources connues</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ansembed, Sendvid, Uqload et Vidmoly peuvent être proposés quand tu disposes d'un lien d'intégration valide. Leur disponibilité et leurs règles d'intégration varient.</p>
      <p className="mt-2 text-xs text-muted-foreground">L'exemple Ansembed est prérempli à partir du lien fourni, mais son fonctionnement dépend du fournisseur et n'a pas été vérifié.</p>
    </section>
  </main>;
}
