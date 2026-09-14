import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unlike vitest.rules.config.ts, emulator tests don't need
    // fileParallelism: false — each test signs in anonymously and gets a
    // fresh, isolated uid, so there's no shared state to race on. If a
    // future emulator test ever shares state across files, revisit this.
    include: ["**/*.emulator.test.ts"],
  },
});
