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
import { Home, Tv, BookOpen, Library, User as UserIcon, Menu, X, Settings } from "lucide-react";

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
          onClick={() => {
            router.invalidate();
            reset();
          }}
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
      { title: "KOVA — Otaku-World" },
      { name: "description", content: "Explore les animes et lis tes mangas, manhwas et manhuas sur KOVA." },
      { property: "og:type", content: "website" },
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
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AccountButton() {
  const { user } = useAuth();
  const initial = (user?.displayName || user?.email || "?").charAt(0).toUpperCase();
  return (
    <Link to="/auth" aria-label={user ? "Mon compte" : "Se connecter"} className="flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition hover:border-primary">
      {user ? (
        user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" /> : <span className="bg-neon flex h-6 w-6 items-center justify-center rounded-full text-xs text-primary-foreground">{initial}</span>
      ) : (
        <><UserIcon className="h-4 w-4" /><span className="hidden sm:inline">Connexion</span></>
      )}
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/library", label: "Biblio", icon: Library },
  { to: "/profile", label: "Profil", icon: UserIcon },
  { to: "/settings", label: "Réglages", icon: Settings },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reader = path.startsWith("/read/");
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <QueryClientProvider client={queryClient}>
      {!reader && (
        <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:h-16 md:px-8">
            <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
              <img src={logo} alt="" className="h-9 w-9 rounded-lg object-cover md:h-10 md:w-10" />
              <span className="text-neon">KOVA</span>
              <span className="ml-1 hidden text-xs font-medium text-muted-foreground sm:inline">Otaku-World</span>
            </Link>
            <div className="flex items-center gap-2">
              <nav className="hidden gap-1 md:flex">
                {NAV.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    activeOptions={{ exact: n.to === "/" }}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    activeProps={{ className: "bg-secondary !text-foreground" }}
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <AccountButton />
            </div>
          </div>
        </header>
      )}
      <main className={reader ? "" : "pb-24 md:pb-12"}>
        <Outlet />
      </main>
      {!reader && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-4">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground"
                activeProps={{ className: "!text-primary" }}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </QueryClientProvider>
  );
}
