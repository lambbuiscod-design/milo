import { builtinModules } from "node:module";
import { defineConfig, loadEnv } from "vite";

const nodeBuiltins = builtinModules.flatMap((moduleName) => [
  moduleName,
  `node:${moduleName}`,
]);

export default defineConfig(({ mode }) => {
  const publicEnvironment = loadEnv(mode, process.cwd(), "MILO_");
  return {
    define: {
      __MILO_API_BASE_URL__: JSON.stringify(publicEnvironment.MILO_API_BASE_URL?.trim() ?? ""),
      __MILO_DESKTOP_CLIENT_ID__: JSON.stringify(publicEnvironment.MILO_DESKTOP_CLIENT_ID?.trim() ?? ""),
      __MILO_SUPABASE_ORIGIN__: JSON.stringify(publicEnvironment.MILO_SUPABASE_ORIGIN?.trim() ?? ""),
    },
    build: {
      emptyOutDir: false,
      minify: true,
      outDir: ".vite/build",
      sourcemap: false,
      target: "node24",
      lib: {
        entry: "src/main/index.ts",
        formats: ["es"],
        fileName: () => "main.js",
      },
      rollupOptions: {
        external: [
          "electron",
          "better-sqlite3",
          "tesseract.js",
          "tesseract.js-core",
          "@tesseract.js-data/eng",
          ...nodeBuiltins,
        ],
      },
    },
  };
});
