import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  Crown, BookOpen, Library, Settings, ShieldCheck, ArrowLeft, LayoutDashboard,
  Activity, Database, ExternalLink, Search, SlidersHorizontal, UserRound,
  Clock3, CheckCircle2, CircleHelp, Sparkles, ArrowUpRight, LockKeyhole,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Dashboard propriétaire — KOVA" },
      { name: "description", content: "Espace privé de gestion du site KOVA." },
    ],
  }),
  component: OwnerDashboard,
});

const quickLinks = [
  { label: "Explorer le catalogue", detail: "Vérifier les fiches manga et les résultats de recherche", to: "/manga", icon: BookOpen },
  { label: "Bibliothèque", detail: "Consulter les favoris et l'historique de lecture", to: "/library", icon: Library },
  { label: "Paramètres du site", detail: "Contrôler les préférences et options disponibles", to: "/settings", icon: SlidersHorizontal },
] as const;

function OwnerDashboard() {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16" role="status" aria-live="polite">
        <div className="h-40 animate-pulse rounded-3xl border bg-card" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl border bg-card" />)}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">Vérification de l'accès propriétaire…</p>
      </main>
    );
  }

  if (!user) return <Navigate to="/auth" />;
  if (!isOwner) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border bg-card"><ShieldCheck className="h-8 w-8 text-muted-foreground" /></div>
        <h1 className="mt-5 text-2xl font-extrabold">Accès réservé</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cet espace est uniquement accessible au propriétaire de KOVA.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"><ArrowLeft className="h-4 w-4" /> Retour à l'accueil</Link>
      </main>
    );
  }

  const displayName = user.displayName || user.email?.split("@")[0] || "Propriétaire";
  const joinedAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "Non disponible";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour au site</Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary"><ShieldCheck className="h-4 w-4" /> Espace privé</span>
      </div>

      <section className="relative overflow-hidden rounded-3xl border bg-card p-6 shadow-neon md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg md:h-16 md:w-16"><Crown className="h-7 w-7 md:h-8 md:w-8" /></div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">KOVA / CONTROL CENTER</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-4xl">Bonjour, {displayName}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">Ton espace de pilotage. Accède rapidement aux outils du site et vérifie l'état de ton compte propriétaire.</p>
            </div>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Session authentifiée</div>
        </div>
      </section>

      <section aria-label="Résumé" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={UserRound} label="Compte connecté" value={user.email || "Compte Firebase"} note="Identité Firebase active" />
        <SummaryCard icon={ShieldCheck} label="Rôle" value="Propriétaire" note="Accès owner reconnu" />
        <SummaryCard icon={Clock3} label="Compte créé" value={joinedAt} note="Date fournie par Firebase" />
        <SummaryCard icon={Activity} label="Déploiement" value="À vérifier" note="État Cloudflare non vérifié depuis ce dashboard" />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Raccourcis</p><h2 className="mt-1 text-xl font-extrabold md:text-2xl">Gestion de KOVA</h2></div>
            <span className="text-xs text-muted-foreground">Accès rapide</span>
          </div>
          <div className="grid gap-3">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to} className="group flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><h3 className="font-bold">{item.label}</h3><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-card p-5 md:p-6">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div><div><h2 className="font-extrabold">État des services</h2><p className="text-xs text-muted-foreground">Informations disponibles côté client</p></div></div>
            <div className="mt-5 space-y-3">
              <StatusRow icon={LockKeyhole} label="Authentification Firebase" status="Session active" good />
              <StatusRow icon={ShieldCheck} label="Contrôle propriétaire" status="Accès autorisé" good />
              <StatusRow icon={Database} label="Firestore / données" status="Non testé ici" />
              <StatusRow icon={Activity} label="Cloudflare Workers" status="À vérifier dans Cloudflare" />
            </div>
            <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">Les états « à vérifier » ne sont pas des pannes confirmées. Ce dashboard n'effectue pas de test serveur de ces services.</p>
          </section>

          <section className="rounded-2xl border bg-card p-5 md:p-6">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-extrabold">Sécurité du compte</h2><p className="text-xs text-muted-foreground">Contrôles de base</p></div></div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p>Ton compte est connecté via Firebase Authentication.</p></div>
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p>Le rôle propriétaire est reconnu dans l'application.</p></div>
              <div className="flex items-start gap-3"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><p className="text-muted-foreground">Les autorisations Firestore doivent toujours être garanties par les règles côté serveur.</p></div>
            </div>
            <Link to="/settings" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition hover:border-primary"><Settings className="h-4 w-4" /> Ouvrir les réglages <ArrowUpRight className="h-4 w-4" /></Link>
          </section>
        </aside>
      </div>

      <section className="mt-8 rounded-2xl border border-dashed p-5 md:p-6">
        <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-extrabold">Prochaine étape</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Les statistiques globales (nombre d'utilisateurs, lectures, signalements et catalogue) nécessitent des données agrégées et des règles d'accès sécurisées. Aucun chiffre fictif n'est affiché ici.</p></div></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/manga" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"><Search className="h-4 w-4" /> Ouvrir le catalogue</Link>
          <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold transition hover:border-primary"><ExternalLink className="h-4 w-4" /> Cloudflare <ArrowUpRight className="h-3.5 w-3.5" /></a>
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> KOVA Owner Dashboard</span>
        <span>Session : {user.email || "Firebase"}</span>
      </footer>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <article className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div>
      <p className="mt-3 break-words text-lg font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}

function StatusRow({ icon: Icon, label, status, good = false }: { icon: LucideIcon; label: string; status: string; good?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${good ? "bg-emerald-500/10 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>{status}</span>
    </div>
  );
}
