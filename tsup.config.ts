import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { "core/index": "src/core/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist",
    clean: false,
  },
  {
    entry: { "react/index": "src/react/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist",
    clean: false,
    external: [/^react/],
  },
  {
    entry: { "browser/index": "src/browser/index.ts" },
    format: ["iife"],
    dts: false,
    sourcemap: true,
    outDir: "dist",
    clean: false,
    minify: false,
  },
]);
