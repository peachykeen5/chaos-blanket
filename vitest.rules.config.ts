import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.rules.test.ts"],
    // All rules test files share one emulator instance and each calls
    // clearFirestore() in beforeEach; running files in parallel would race
    // that shared state once a second *.rules.test.ts file exists.
    fileParallelism: false,
  },
});
