import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Vercel يدعم الـ SSR، لذا نترك الإعدادات الافتراضية للـ Nitro
  nitro: {
    preset: "vercel", // نخبره أننا نستضيف على Vercel
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});