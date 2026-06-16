import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  // Dev mode: proxy API calls to the running Fastify server
  server: {
    proxy: {
      "/run":    "http://localhost:3100",
      "/screen": "http://localhost:3100",
      "/config": "http://localhost:3100",
      "/health": "http://localhost:3100",
    },
  },
});
