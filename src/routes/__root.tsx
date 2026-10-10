import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, BookOpen, Library, Settings, User as UserIcon, Crown, Menu, X, Search, ShieldCheck, Tv } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/kova-logo.jpg";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-neon text-7xl font-bold">404</h1>
        <p className="mt-4 text-muted-foreground">Cette page s'est perdue dans un autre isekai.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Accueil</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Cette page n'a pas pu charger</h1>
        <p className="mt-2 text-sm text-muted-foreground">Un problème est survenu. Réessaie dans un instant.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0d0a14" },
      { title: "KOVA | Manga, Manhwa & Manhua" },
      { name: "description", content: "Découvre et lis des mangas, manhwas et manhuas sur KOVA." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "KOVA | Manga, Manhwa & Manhua" },
      { property: "og:description", content: "Découvre et lis des mangas, manhwas et manhuas sur KOVA." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function AccountButton() {
  const { user, isOwner } = useAuth();
  const initial = (user?.displayName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <Link to="/auth" aria-label={user ? "Mon compte" : "Se connecter"} className="flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition hover:border-primary">
      {user ? (
        user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" />
          : <span className="bg-neon flex h-6 w-6 items-center justify-center rounded-full text-xs text-primary-foreground">{initial}</span>
      ) : (
        <><UserIcon className="h-4 w-4" /><span className="hidden sm:inline">Connexion</span></>
      )}
      {user && isOwner && (
        <span title="Owner KOVA" className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-extrabold text-primary">
          <Crown className="h-3 w-3" /> OWNER
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/library", label: "Biblio", icon: Library },
  { to: "/settings", label: "Réglages", icon: Settings },
  { to: "/sources", label: "Sources", icon: Search },
] as const;

function RootComponent() {
  const { isOwner, user } = useAuth();
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const reader = path.startsWith("/read/");

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  return (
    <QueryClientProvider client={queryClient}>
      {!reader && (
        <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:h-16 md:px-8">
            <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
              <img src={logo} alt="" className="h-9 w-9 rounded-lg object-cover md:h-10 md:w-10" />
              <span className="text-neon">KOVA</span>
              <span className="ml-1 hidden text-xs font-medium text-muted-foreground sm:inline">Manga-World</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={menuOpen}
                aria-controls="kova-mobile-menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-card/70 transition hover:border-primary hover:text-primary md:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <nav className="hidden gap-1 md:flex">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }} className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground" activeProps={{ className: "bg-secondary !text-foreground" }}>
                    {n.label}
                  </Link>
                ))}
              </nav>
              {isOwner && (
                <Link to="/owner" className="hidden items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-extrabold text-primary md:flex">
                  <Crown className="h-3.5 w-3.5" /> Owner
                </Link>
              )}
              <AccountButton />
            </div>
          </div>
        </header>
      )}
      <main className={reader ? "" : "pb-24 md:pb-12"}><Outlet /></main>
      {!reader && (
        <nav aria-label="Navigation rapide mobile" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "!text-primary" }}
              >
                <n.icon className="h-5 w-5" />
                <span>{n.label === "Bibliothèque" ? "Biblio" : n.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
      {!reader && menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="kova-mobile-menu"
            aria-label="Navigation principale"
            className="absolute right-0 top-0 flex h-full w-[min(86vw,360px)] flex-col border-l bg-background p-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] shadow-2xl"
          >
            <div className="mb-7 flex items-center justify-between">
              <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 font-display text-lg font-extrabold">
                <img src={logo} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <span className="text-neon">KOVA <span className="text-xs font-medium text-muted-foreground">Manga-World</span></span>
              </Link>
              <button type="button" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border hover:border-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Explorer</div>
            <div className="space-y-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: n.to === "/" }}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "!bg-primary/10 !text-primary", "aria-current": "page" }}
                >
                  <n.icon className="h-5 w-5" />{n.label}
                </Link>
              ))}
              {isOwner && (
                <Link to="/owner" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3.5 text-sm font-extrabold text-primary transition hover:bg-primary/15">
                  <Crown className="h-5 w-5" />Centre Owner
                </Link>
              )}
            </div>
            <div className="my-5 border-t" />
            <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Compte</div>
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <UserIcon className="h-5 w-5" />{user ? "Mon compte" : "Connexion / Inscription"}
            </Link>
            {isOwner && (
              <Link to="/owner" onClick={() => setMenuOpen(false)} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-bold text-primary transition hover:bg-primary/10" activeProps={{ className: "bg-primary/10" }}>
                <ShieldCheck className="h-5 w-5" />Espace Owner
              </Link>
            )}
            <div className="mt-auto rounded-2xl border bg-card/70 p-4">
              <div className="text-sm font-bold">KOVA</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ton univers manga, manhwa et manhua.</p>
            </div>
          </nav>
        </div>
      )}
    </QueryClientProvider>
  );
}
