import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, Database, RotateCw, Inbox } from "lucide-react";
import { kova, type KovaCategory, type KovaMediaItem } from "@/lib/adapters";
function useDebounced<T>(value: T, ms = 350) { const [v, setV] = useState(value); useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]); return v; }

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Explorer — KOVA" },
      { name: "description", content: "Recherche multi-sources KOVA avec normalisation des données." },
    ],
  }),
  component: SourcesExplorer,
});

const CATEGORIES: { id: KovaCategory; label: string }[] = [
  { id: "manga", label: "Manga" },
  { id: "comics", label: "Comics" },
  { id: "books", label: "Livres" },
];

function SourcesExplorer() {
  const [category, setCategory] = useState<KovaCategory>("manga");
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 400);
  const result = useQuery({
    queryKey: ["kova-sources", category, q],
    queryFn: () => kova.search(q, category, { limit: 24, languages: ["fr", "en"] }),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">KOVA DATA HUB</p>
          <h1 className="mt-1 text-2xl font-extrabold md:text-4xl">Explorer multi-sources</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            KOVA interroge plusieurs catalogues puis transforme leurs réponses dans un format commun.
          </p>
        </div>
        <Database className="hidden h-10 w-10 text-primary md:block" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)} aria-pressed={category === c.id} className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition ${category === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-secondary/50 hover:border-primary"}`}>
            {c.label}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 focus-within:border-primary">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input aria-label="Rechercher dans toutes les sources" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans toutes les sources…" className="w-full bg-transparent outline-none" />
      </label>

      {result.error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><span>Certaines sources ne répondent pas actuellement. Réessaie dans un instant.</span><button type="button" onClick={() => void result.refetch()} disabled={result.isFetching} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 font-semibold disabled:opacity-60"><RotateCw className={`h-4 w-4 ${result.isFetching ? "animate-spin" : ""}`} /> Réessayer</button></div>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {result.isLoading
          ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />)
          : result.data?.map((item) => <SourceCard key={`${item.source}:${item.externalId}`} item={item} />)}
      </div>

      {!result.isLoading && !result.error && result.data?.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed p-8 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucun résultat</p>
          <p className="mt-1 text-sm text-muted-foreground">Essaie un autre titre ou change de catégorie.</p>
          {search && <button type="button" onClick={() => setSearch("")} className="mt-4 min-h-10 rounded-full border px-4 text-sm font-semibold hover:border-primary">Effacer la recherche</button>}
        </div>
      )}
    </div>
  );
}

function SourceCard({ item }: { item: KovaMediaItem }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="aspect-[2/3] bg-muted">
        {item.coverUrl && <img src={item.coverUrl} alt={item.title.canonical} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-bold">{item.title.canonical}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-primary">{item.source.replace("_", " ")}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.genres.slice(0, 2).join(" · ")}</p>
      </div>
    </article>
  );
}
