import { defineConfig } from "vitest/config";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  test: {
    environment: "node",
    root: join(__dirname, "tests"),
  },
});
