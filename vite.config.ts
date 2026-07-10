import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "netlify", // هذا أهم تغيير
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});