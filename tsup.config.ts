import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry — 需要 shebang
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    target: "es2022",
    dts: false,
    sourcemap: false,
    clean: true,
    splitting: false,
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node" },
  },
  // Protocols entry — 库导出
  {
    entry: { "protocols/index": "src/protocols/index.ts" },
    format: ["esm"],
    target: "es2022",
    dts: true,
    sourcemap: false,
    clean: false,
    splitting: false,
    outDir: "dist",
  },
]);
