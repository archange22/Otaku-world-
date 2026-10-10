import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { lib, useLibrary } from "@/lib/library";
import { MediaCard, Chip } from "@/components/kova";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Ma bibliothèque — KOVA" },
      { name: "description", content: "Tes favoris et ton historique de lecture sur KOVA." },
      { property: "og:title", content: "Ma bibliothèque — KOVA" },
      { property: "og:description", content: "Favoris et historique de lecture." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { favs, history, progress } = useLibrary();
  const [tab, setTab] = useState<"favs" | "history">("favs");

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
      <div className="flex items-center gap-4 rounded-3xl border bg-card p-5">
        <div className="bg-neon shadow-neon flex h-16 w-16 items-center justify-center rounded-2xl font-display text-2xl font-extrabold text-primary-foreground">K</div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold md:text-2xl">Ma bibliothèque</h1>
          <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
            <span><b className="text-foreground">{favs.length}</b> favoris</span>
            <span><b className="text-foreground">{Object.keys(progress).length}</b> chapitres suivis</span>\n            <span><b className="text-foreground">{lib.getXP()}</b> XP</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-6 border-b">
        {(["favs", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-3 text-sm font-bold transition ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            {t === "favs" ? "Favoris" : "Historique"}
          </button>
        ))}
      </div>

      {tab === "favs" ? (
        favs.length === 0 ? (
          <Empty text="Aucun favori pour l'instant. Ajoute des titres avec le cœur sur leur fiche." />
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-5 lg:grid-cols-6">
            {favs.map((f) => <MediaCard key={f.id} d={{ ...f, sub: "Manga" }} />)}
          </div>
        )
      ) : history.length === 0 ? (
        <Empty text="Ton historique de lecture apparaîtra ici." />
      ) : (
        <>
          <button onClick={() => lib.clearHistory()} className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /> Effacer l'historique</button>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {history.map((h) => (
              <li key={h.mangaId}>
                <Link to="/read/$chapterId" params={{ chapterId: h.chapterId }} className="flex gap-4 rounded-2xl border bg-card p-3 transition hover:border-primary">
                  {h.cover ? <img referrerPolicy="no-referrer" src={h.cover} alt="" className="h-24 w-16 rounded-lg object-cover" /> : <div className="h-24 w-16 rounded-lg bg-muted" />}
                  <div className="min-w-0 flex-1 py-1">
                    <p className="truncate font-bold">{h.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{h.chapterLabel}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="bg-neon h-full" style={{ width: `${Math.round(((h.page + 1) / Math.max(h.total, 1)) * 100)}%` }} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">Page {h.page + 1}/{h.total} · {new Date(h.at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-16 text-center text-muted-foreground">{text}</p>;
}
