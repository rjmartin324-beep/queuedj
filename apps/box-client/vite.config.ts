import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "PartyGlue",
        short_name: "PartyGlue",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "any",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Cache all assets for fully offline play
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,woff2,mp3}"],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Bump from default 2 MB so big GeoGuesser landmark photos precache
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\//,
            handler: "NetworkFirst",
          },
        ],
      },
    }),
  ],
  server: {
    // Dev proxy — forward /ws to the box server
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    // Keep bundle small for Termux file serving
    chunkSizeWarningLimit: 300,
  },
});
