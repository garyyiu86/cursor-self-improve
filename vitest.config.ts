import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["sample/**/*.test.ts"],
  },
});
