import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@moonos/protocols": path.resolve(__dirname, "src/protocols"),
      "@moonos/core": path.resolve(__dirname, "src/core"),
      "@moonos/storage": path.resolve(__dirname, "src/storage"),
    },
  },
});
