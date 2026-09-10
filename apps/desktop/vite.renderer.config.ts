import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    emptyOutDir: true,
    minify: true,
    outDir: ".vite/renderer/main_window",
    sourcemap: false,
    rollupOptions: {
      input: {
        main: "index.html",
        companion: "companion.html",
      },
    },
  },
});

