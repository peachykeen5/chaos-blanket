import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.rules.test.ts", "**/*.emulator.test.ts"],
  },
});
