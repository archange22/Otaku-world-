import { ShieldCheck } from "lucide-react";

export function ContentSafetyNotice() {
  return (
    <aside
      role="status"
      aria-label="Protection du contenu adulte activée"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
    >
      <span className="shrink-0 rounded-md border border-amber-500/50 px-2 py-1 text-xs font-extrabold tracking-wide text-amber-500">
        +18
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Protection du contenu activée</p>
        <p className="mt-1 text-muted-foreground">
          Les contenus adultes et érotiques sont filtrés. Les recommandations de contenu adulte restent désactivées par défaut.
        </p>
      </div>
      <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
    </aside>
  );
}
