import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/lib/**", "**/*.emulator.test.ts"],
    passWithNoTests: true,
  },
});
