// @lovable.dev/vite-tanstack-config already includes the application plugins.
// Keep the existing wrapper to avoid duplicate TanStack/React/Tailwind plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Emit static files instead of a Cloudflare Workers runtime.
  nitro: { preset: "static" },
  tanstackStart: {
    // Keep the custom server entry available for build-time rendering only.
    server: { entry: "server" },
    // Firebase Hosting serves files only, so generate a client-side SPA shell.
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
      },
    },
  },
});
