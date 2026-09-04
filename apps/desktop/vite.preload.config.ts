import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: true,
    outDir: ".vite/build",
    sourcemap: false,
    lib: {
      entry: "src/preload/index.ts",
      formats: ["cjs"],
      fileName: () => "preload.cjs",
    },
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "preload.cjs",
        format: "cjs",
      },
    },
  },
});
