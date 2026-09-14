import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unlike vitest.rules.config.ts, emulator tests don't need
    // fileParallelism: false — each test signs in anonymously and gets a
    // fresh, isolated uid, so there's no shared state to race on. If a
    // future emulator test ever shares state across files, revisit this.
    include: ["**/*.emulator.test.ts"],
    // functions/ has its own emulator config and its own `test:emulator`
    // script; without this exclude, this root config's glob also picks up
    // functions/test/*.emulator.test.ts, which fails here (no Functions
    // emulator running, wrong project id).
    exclude: ["**/node_modules/**", "functions/**"],
  },
});
