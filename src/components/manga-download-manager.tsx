import { useMemo, useRef, useState } from "react";
import { Download, Pause, Play, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import { chapterLabel, getPages, type Chapter } from "@/lib/mangadex";
import { getOfflineSummary, getSavedChapter, saveChapterOffline } from "@/lib/reader-offline";

type Props = {
  mangaId: string;
  mangaTitle: string;
  chapters: Chapter[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export function MangaDownloadManager({ mangaId, mangaTitle, chapters }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const cancelRef = useRef(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, chapter: "", pagesDone: 0, pagesTotal: 0 });
  const [saved, setSaved] = useState<{ count: number; bytes: number } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  const sorted = useMemo(() => [...chapters].sort((a, b) => {
    const aa = Number(a.chapter ?? 0);
    const bb = Number(b.chapter ?? 0);
    return aa - bb;
  }), [chapters]);

  const chosen = selected.length ? sorted.filter((chapter) => selected.includes(chapter.id)) : sorted;

  const refreshSaved = async () => setSaved(await getOfflineSummary());

  const toggle = (id: string) => setSelected((current) =>
    current.length === 0
      ? sorted.filter((chapter) => chapter.id !== id).map((chapter) => chapter.id)
      : current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
  );

  const download = async () => {
    if (!chosen.length || running) return;
    cancelRef.current = false;
    setCancelRequested(false);
    setRunning(true);
    setMessage(null);
    setProgress({ done: 0, total: chosen.length, chapter: "", pagesDone: 0, pagesTotal: 0 });
    let completed = 0;
    let skipped = 0;
    try {
      for (const chapter of chosen) {
        if (cancelRef.current) break;
        setProgress((p) => ({ ...p, chapter: chapterLabel(chapter), pagesDone: 0, pagesTotal: chapter.pages }));
        if (await getSavedChapter(chapter.id)) {
          skipped++;
          completed++;
          setProgress((p) => ({ ...p, done: completed }));
          continue;
        }
        const pageUrls = await getPages(chapter.id, true);
        await saveChapterOffline(
          chapter.id,
          pageUrls,
          (pagesDone, pagesTotal) => setProgress((p) => ({ ...p, pagesDone, pagesTotal })),
          { mangaId, mangaTitle, lang: chapter.lang, chapter: chapter.chapter },
        );
        completed++;
        setProgress((p) => ({ ...p, done: completed }));
      }
      await refreshSaved();
      if (cancelRef.current) {
        setMessage({ kind: "info", text: `Téléchargement arrêté. ${completed} chapitre(s) traité(s); tu peux reprendre plus tard.` });
      } else {
        setMessage({ kind: "ok", text: `Terminé : ${completed - skipped} nouveau(x) chapitre(s) enregistré(s), ${skipped} déjà hors ligne.` });
      }
    } catch (error) {
      await refreshSaved().catch(() => undefined);
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Le téléchargement a échoué. Vérifie ta connexion et réessaie." });
    } finally {
      setRunning(false);
      setCancelRequested(false);
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    setCancelRequested(true);
  };

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-card/70 p-4 md:p-5" aria-labelledby="offline-download-heading">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Download className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="offline-download-heading" className="font-bold">Télécharger pour lire hors ligne</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enregistre tous les chapitres affichés, ou sélectionne uniquement ceux dont tu as besoin. Les fichiers restent sur cet appareil.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSelected([])} disabled={running} className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
          Tous les chapitres ({sorted.length})
        </button>
        <button type="button" onClick={() => setSelected(sorted.map((chapter) => chapter.id))} disabled={running || !sorted.length} className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
          Sélectionner tout
        </button>
        <button type="button" onClick={() => setSelected([])} disabled={running || !selected.length} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-50">
          Revenir à tous les chapitres
        </button>
      </div>

      {sorted.length > 0 && (
        <details className="mt-3 rounded-xl border bg-background/50">
          <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">
            Choisir les chapitres {selected.length ? `· ${selected.length} sélectionné(s)` : ""}
          </summary>
          <div className="max-h-64 overflow-y-auto border-t p-2">
            {sorted.map((chapter) => (
              <label key={chapter.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/70">
                <input type="checkbox" checked={!selected.length || selected.includes(chapter.id)} onChange={() => toggle(chapter.id)} disabled={running} className="h-4 w-4 accent-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">{chapterLabel(chapter)}</span>
                <span className="text-xs text-muted-foreground">{chapter.pages} p.</span>
              </label>
            ))}
          </div>
        </details>
      )}

      {running && (
        <div className="mt-4 rounded-xl border bg-background/70 p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{progress.chapter || "Préparation…"}</span>
            <span className="shrink-0 tabular-nums">{progress.done}/{progress.total}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {progress.pagesTotal ? `Pages du chapitre : ${progress.pagesDone}/${progress.pagesTotal}` : "Préparation du chapitre…"}
            {cancelRequested ? " · Arrêt en cours…" : ""}
          </p>
          <button type="button" onClick={cancel} disabled={cancelRequested} className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-50">
            <Pause className="h-3.5 w-3.5" /> Arrêter après le chapitre en cours
          </button>
        </div>
      )}

      {!running && (
        <button type="button" onClick={() => void download()} disabled={!sorted.length} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <Play className="h-4 w-4" /> Télécharger {selected.length ? `${selected.length} chapitre(s) sélectionné(s)` : `les ${sorted.length} chapitres affichés`}
        </button>
      )}

      {message && (
        <div role="status" className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm ${message.kind === "error" ? "border-destructive/40 text-destructive" : message.kind === "ok" ? "border-primary/30 text-primary" : "text-muted-foreground"}`}>
          {message.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <HardDrive className="h-4 w-4" />
        {saved ? <span>{saved.count} chapitre(s) hors ligne · {formatBytes(saved.bytes)} enregistrés sur cet appareil</span> : <button type="button" onClick={() => void refreshSaved().catch(() => setMessage({ kind: "error", text: "Le stockage hors ligne est indisponible dans ce navigateur." }))} className="underline">Voir l’espace utilisé</button>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Les téléchargements dépendent des pages disponibles sur la source. Ils peuvent disparaître si tu effaces les données du navigateur ou si l’appareil manque d’espace. Utilise cette fonction uniquement pour les contenus que tu es autorisé à enregistrer.</p>
    </section>
  );
}
