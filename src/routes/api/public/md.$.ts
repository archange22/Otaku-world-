import { createFileRoute } from "@tanstack/react-router";

// Proxy read-only vers l'API MangaDex (contourne CORS / User-Agent navigateur)
export const Route = createFileRoute("/api/public/md/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[a-z0-9\-/]+$/i.test(path)) return new Response("Bad path", { status: 400 });
        const incoming = new URL(request.url);
        const params = new URLSearchParams(incoming.search);
        // Catalogue et lecteur limités aux classifications tout public.
        params.delete("contentRating[]");
        params.delete("contentRating");
        if (path === "manga" || path.startsWith("manga/")) {
          params.append("contentRating[]", "safe");
          params.append("contentRating[]", "suggestive");
        }
        const search = params.toString();
        const res = await fetch(`https://api.mangadex.org/${path}${search ? `?${search}` : ""}`, {
          headers: { "User-Agent": "KOVA-OtakuWorld/1.0" },
        });
        if (path.startsWith("manga/") && !path.endsWith("/feed") && res.ok) {
          const data = await res.clone().json().catch(() => null);
          const entries = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];
          const blocked = entries.some((m: any) => {
            const a = m?.attributes;
            const tags = (a?.tags ?? []).map((t: any) => String(t?.attributes?.name?.en ?? ""));
            return ["erotica", "pornographic"].includes(String(a?.contentRating ?? "")) ||
              tags.some((tag: string) => /hentai|ecchi/i.test(tag));
          });
          if (blocked) return new Response("Contenu indisponible", { status: 404 });
        }
        return new Response(res.body, {
          status: res.status,
          headers: {
            "content-type": "application/json",
            "cache-control": path.startsWith("at-home") ? "no-store" : "public, max-age=300",
          },
        });
      },
    },
  },
});
