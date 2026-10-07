import { Link } from "@tanstack/react-router";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

export type CardData = { id: string; title: string; cover: string | null; score?: number | null; sub?: string; kind: "anime" | "manga" };

export function MediaCard({ d, className = "" }: { d: CardData; className?: string }) {
  const inner = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted">
        {d.cover && (
          <img referrerPolicy="no-referrer" src={d.cover} alt={d.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {d.score != null && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold backdrop-blur">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {d.score}
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-border transition group-hover:ring-2 group-hover:ring-primary" />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{d.title}</p>
      {d.sub && <p className="mt-0.5 text-xs text-muted-foreground">{d.sub}</p>}
    </>
  );
  const cls = `group block ${className}`;
  return d.kind === "anime" ? (
    <Link to="/anime/$id" params={{ id: d.id }} className={cls}>{inner}</Link>
  ) : (
    <Link to="/manga/$id" params={{ id: d.id }} className={cls}>{inner}</Link>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function Rail({ title, action, items, loading }: { title: string; action?: ReactNode; items?: CardData[] | undefined; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4 px-4 md:px-8">
        <h2 className="text-lg font-bold md:text-2xl">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          <button onClick={() => scroll(-1)} className="hidden rounded-full border p-1.5 hover:border-primary md:block" aria-label="Précédent"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll(1)} className="hidden rounded-full border p-1.5 hover:border-primary md:block" aria-label="Suivant"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 md:gap-4 md:px-8">
        {loading || !items
          ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} className="w-32 shrink-0 md:w-44" />)
          : items.map((d) => <MediaCard key={d.id} d={d} className="w-32 shrink-0 snap-start md:w-44" />)}
      </div>
    </section>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? "border-primary bg-primary text-primary-foreground shadow-neon" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return <div className="m-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{msg}</div>;
}
