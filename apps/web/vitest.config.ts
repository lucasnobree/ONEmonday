import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest configuration for the web app's unit/integration tests.
// The `@/` alias mirrors the tsconfig.json `paths` mapping.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
  },
});
