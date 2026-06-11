import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Default dev server port
    watch: {
      usePolling: true, // Enable polling for file changes
      interval: 100, // Check for changes every 100ms
      depth: 99, // Watch deeply nested folders
      ignored: ["!**/node_modules/**"], // Don't ignore anything in src
    },
    hmr: {
      overlay: true,
    },
  },
  publicDir: "public",
  build: {
    outDir: "dist", // Build output directory
  },
  optimizeDeps: {
    exclude: [], // Don't pre-bundle anything that might interfere with HMR
  },
});
