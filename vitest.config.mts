import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Tests run outside a React server environment, where "server-only" would throw.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // next-auth imports "next/server" without a file extension, which only resolves when the
    // package is processed by Vite rather than loaded directly by Node.
    server: { deps: { inline: ["next-auth"] } },
  },
});
