import { createFileRoute } from "@tanstack/react-router";

// Proxy read-only vers l'API MangaDex (contourne CORS / User-Agent navigateur)
export const Route = createFileRoute("/api/public/md/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[a-z0-9\-/]+$/i.test(path)) return new Response("Bad path", { status: 400 });
        const search = new URL(request.url).search;
        const res = await fetch(`https://api.mangadex.org/${path}${search}`, {
          headers: { "User-Agent": "KOVA-OtakuWorld/1.0" },
        });
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
