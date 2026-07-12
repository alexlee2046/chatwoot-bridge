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
    // No sourcemap for this target: it's meant to be vendored/copied as a
    // single file by consumers with no bundler (see projectfurniture's
    // sync-chatwoot-bridge.mjs) — an accompanying .map only helps if it
    // travels with the .js under the exact same relative name, which a
    // copy-paste vendoring step has no way to guarantee automatically.
    sourcemap: false,
    outDir: "dist",
    clean: false,
    minify: true,
  },
]);
