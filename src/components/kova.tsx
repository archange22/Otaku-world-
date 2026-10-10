import { Link } from "@tanstack/react-router";
import { Star, ChevronLeft, ChevronRight, Search, TriangleAlert, RotateCw, Inbox } from "lucide-react";
import { useRef, type ReactNode } from "react";

export type CardData = { id: string; title: string; cover: string | null; score?: number | null; sub?: string; kind: "manga"; warning?: "HENTAI" | "ECCHI" | undefined };

export function ContentWarning({ type }: { type: "HENTAI" | "ECCHI" }) {
  const hentai = type === "HENTAI";
  return (
    <span role="note" aria-label={hentai ? "Avertissement : contenu hentai" : "Avertissement : contenu ecchi suggestif"} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-sm backdrop-blur ${hentai ? "border-red-500/60 bg-red-950/90 text-red-100" : "border-amber-500/60 bg-amber-950/90 text-amber-100"}`}>
      <TriangleAlert className="h-3 w-3" /> {hentai ? "Hentai · contenu adulte" : "Ecchi · contenu suggestif"}
    </span>
  );
}

export function warningFor(tags: string[], adult = false): "HENTAI" | "ECCHI" | undefined {
  const normalized = tags.map((tag) => tag.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  if (adult || normalized.some((tag) => ["hentai", "erotica", "pornographic"].includes(tag))) return "HENTAI";
  if (normalized.some((tag) => tag === "ecchi" || tag.includes("suggestive"))) return "ECCHI";
  return undefined;
}

export function MediaCard({ d, className = "" }: { d: CardData; className?: string }) {
  const inner = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted">
        {d.cover && <img referrerPolicy="no-referrer" src={d.cover} alt={d.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {d.score != null && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold backdrop-blur"><Star className="h-3 w-3 fill-accent text-accent" />{d.score}</span>}
        {d.warning && <div className="absolute inset-x-1 bottom-1 flex justify-center"><ContentWarning type={d.warning} /></div>}
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-border transition group-hover:ring-2 group-hover:ring-primary" />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{d.title}</p>
      {d.sub && <p className="mt-0.5 text-xs text-muted-foreground">{d.sub}</p>}
    </>
  );
  const classNames = `group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`;
  return <Link to="/manga/$id" params={{ id: d.id }} className={classNames}>{inner}</Link>;
}

export function CardSkeleton({ className = "" }: { className?: string; "aria-hidden"?: boolean }) {
  return <div className={className} aria-hidden><div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" /><div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" /></div>;
}

export function Rail({ title, action, items, loading, error, onRetry }: { title: string; action?: ReactNode; items?: CardData[] | undefined; loading?: boolean; error?: boolean; onRetry?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="mt-8 md:mt-10" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4 px-4 md:px-8">
        <h2 className="min-w-0 truncate text-lg font-bold md:text-2xl">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">{action}<button onClick={() => scroll(-1)} className="hidden rounded-full border p-1.5 hover:border-primary md:block" aria-label="Précédent"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => scroll(1)} className="hidden rounded-full border p-1.5 hover:border-primary md:block" aria-label="Suivant"><ChevronRight className="h-4 w-4" /></button></div>
      </div>
      {error ? <ErrorBox msg="Cette section n'a pas pu être chargée." onRetry={onRetry} /> : !loading && items?.length === 0 ? <p className="px-4 text-sm text-muted-foreground md:px-8">Rien à afficher pour l'instant.</p> : <div ref={ref} className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 md:gap-4 md:px-8">
        {loading || !items ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} className="w-32 shrink-0 md:w-44" aria-hidden />) : items.map((d) => <MediaCard key={d.id} d={d} className="w-32 shrink-0 snap-start md:w-44" />)}
      </div>}
    </section>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={!!active} onClick={onClick} className={`shrink-0 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary text-primary-foreground shadow-neon" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}

export function ErrorBox({ msg, onRetry, retrying }: { msg: string; onRetry?: (() => void) | undefined; retrying?: boolean }) {
  return (
    <div role="alert" className="mx-4 my-4 flex flex-col items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between md:mx-0">
      <span className="flex min-w-0 items-center gap-2"><TriangleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />{msg}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-destructive/50 px-4 text-sm font-semibold transition hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          <RotateCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden /> Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="mx-4 my-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-10 text-center md:mx-0">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

export function Filters({ search, setSearch, placeholder, children }: { search: string; setSearch: (s: string) => void; placeholder: string; children: ReactNode }) {
  return <div className="mt-4 space-y-3"><label className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 focus-within:border-primary focus-within:shadow-neon"><Search className="h-5 w-5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground" /></label>{children}</div>;
}

export function SortSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return <label className="flex items-center gap-2 text-sm text-muted-foreground">Trier par<select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-10 rounded-lg border bg-card px-3 text-foreground outline-none focus:border-primary">{options.map(([v, l]) => <option key={v} value={v ?? ""}>{l}</option>)}</select></label>;
}
