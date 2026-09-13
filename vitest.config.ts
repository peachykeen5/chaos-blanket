import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/*.rules.test.ts",
      "**/*.emulator.test.ts",
    ],
  },
});
