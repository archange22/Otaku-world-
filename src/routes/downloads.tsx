import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, BookOpen, HardDrive, RefreshCw, WifiOff } from "lucide-react";
import { getAllSavedChapters, getOfflineSummary, removeSavedChapter } from "@/lib/reader-offline";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Mes téléchargements — KOVA" },
      { name: "description", content: "Retrouve et lis hors connexion les chapitres enregistrés sur cet appareil." },
    ],
  }),
  component: DownloadsPage,
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function DownloadsPage() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getAllSavedChapters>>>([]);
  const [summary, setSummary] = useState({ count: 0, bytes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [saved, total] = await Promise.all([getAllSavedChapters(), getOfflineSummary()]);
      setItems(saved);
      setSummary(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le stockage hors ligne est indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer le téléchargement « ${title} » de cet appareil ?`)) return;
    try {
      await removeSavedChapter(id);
      await refresh();
    } catch {
      setError("Impossible de supprimer ce chapitre. Réessaie.");
    }
  };

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.mangaId;
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><WifiOff className="h-4 w-4" /> Bibliothèque hors ligne</p>
          <h1 className="mt-2 text-2xl font-extrabold md:text-4xl">Mes téléchargements</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Les chapitres sauvegardés sur ce navigateur restent disponibles sans connexion. Ils ne sont pas synchronisés automatiquement entre tes appareils.</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:border-primary">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:max-w-xl">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Chapitres enregistrés</p>
          <p className="mt-1 text-2xl font-extrabold">{summary.count}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><HardDrive className="h-4 w-4" /> Espace utilisé</p>
          <p className="mt-1 text-2xl font-extrabold">{formatBytes(summary.bytes)}</p>
        </div>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{error}</div>}
      {loading && <div className="mt-6 grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
          <Download className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-bold">Aucun chapitre hors ligne</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ouvre une fiche manga et utilise « Télécharger pour lire hors ligne » pour enregistrer des chapitres.</p>
          <Link to="/manga" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Explorer les mangas</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="mt-8 space-y-6">
          {Object.entries(grouped).map(([mangaId, chapters]) => (
            <section key={mangaId} className="rounded-2xl border bg-card/60 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{chapters[0]?.mangaTitle ?? "Manga"}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{chapters.length} chapitre(s) · {formatBytes(chapters.reduce((sum, item) => sum + item.bytes, 0))}</p>
                </div>
                <Link to="/manga/$id" params={{ id: mangaId }} className="rounded-full border px-3 py-2 text-xs font-bold hover:border-primary">Fiche du manga</Link>
              </div>
              <ul className="mt-4 grid gap-2 md:grid-cols-2">
                {chapters.map((item) => (
                  <li key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl border bg-background/70 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">Chapitre {item.chapter ?? "spécial"}</p>
                      <p className="text-xs text-muted-foreground">{item.lang.toUpperCase()} · {item.pages} pages · {formatBytes(item.bytes)}</p>
                    </div>
                    <Link to="/read/$chapterId" params={{ chapterId: item.id }} className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Lire</Link>
                    <button type="button" onClick={() => void remove(item.id, `${item.mangaTitle} - chapitre ${item.chapter ?? ""}`)} aria-label="Supprimer le téléchargement" title="Supprimer" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mb-6 mt-8 text-xs text-muted-foreground">Important : les données sont stockées localement dans le navigateur. Effacer les données du site, désinstaller le navigateur ou manquer d’espace peut supprimer les chapitres sauvegardés. Le téléchargement ne contourne pas les restrictions des sources.</p>
    </div>
  );
}
