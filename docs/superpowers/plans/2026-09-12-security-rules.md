# Chaos Blanket — Security Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firestore Security Rules that (a) confine every user's personal data to `users/{uid}/**`, readable/writable only by that uid, and (b) make `globalStitches`/`globalColours` read-only for any signed-in user with all direct client writes denied — verified entirely against the Firestore emulator, no application UI required.

**Architecture:** One `firestore.rules` file with two rule groups: a recursive `users/{uid}/{document=**}` match gated on `request.auth.uid == uid`, and flat `globalStitches/{itemId}` / `globalColours/{itemId}` matches allowing `read` to any authenticated user and `write` to nobody (the Cloud Function in the Global Pool plan uses the Admin SDK, which bypasses rules entirely). Tests use `@firebase/rules-unit-testing` against the emulator, not the Admin SDK, so they exercise the rules exactly as a real client would.

**Tech Stack:** Firebase Security Rules, `@firebase/rules-unit-testing`, Vitest, Firestore Emulator.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md), section "Security & Abuse Prevention".

**Depends on:** [2026-09-12-scaffolding-and-setup.md](./2026-09-12-scaffolding-and-setup.md) (needs `firebase.json`, the deny-all `firestore.rules` stub, and the emulator suite).

## Global Constraints

- Frontend: React + TypeScript + Vite + Tailwind CSS, deployed as a static SPA on Firebase Hosting.
- Auth: Firebase Auth, Google sign-in provider only.
- Database: Firestore. All personal data lives under `users/{uid}/...`, protected by Security Rules so a user can only read/write their own data.
- Backend: `contributeToGlobal` (callable Cloud Function) is the sole write path into the global pool; every other write goes directly from client to Firestore.
- Abuse protection: Firebase App Check in front of Firestore and the Cloud Functions (not exercised by these rules tests — App Check is a separate gate configured in the Firebase console, not expressible in `firestore.rules`).
- No automated e2e suite for this MVP.

---

## File Structure

```
chaos-blanket/
├── firestore.rules          (modified: replaces the deny-all stub)
├── package.json              (modified: adds test:rules script + devDependency)
├── vitest.rules.config.ts
└── test/
    └── firestore.rules.test.ts
```

---

### Task 1: Owner-only access under `users/{uid}/**`

**Files:**
- Modify: `firestore.rules`
- Create: `test/firestore.rules.test.ts`
- Create: `vitest.rules.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `firebase.json` emulator config from the scaffolding plan
- Produces: a passing `users/{uid}/**` rule and the `testEnv` / `assertSucceeds` / `assertFails` test-setup pattern Task 2 reuses

- [ ] **Step 1: Install the rules-testing library**

```bash
npm install -D @firebase/rules-unit-testing
```

- [ ] **Step 2: Add a `test:rules` script and dedicated config**

First, create a new Vitest config file that includes only `.rules.test.ts` files:

`vitest.rules.config.ts`:

```ts
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
```

Then add the `test:rules` script to `package.json`, in `"scripts"`:

```json
"test:rules": "firebase emulators:exec --only firestore \"vitest run --config vitest.rules.config.ts\""
```

(Why: The main `vitest.config.ts` excludes `.rules.test.ts` files so that `npm run test` doesn't fail trying to connect to the emulator. This dedicated config file ensures rules tests run only when explicitly requested with `npm run test:rules`, keeping `npm run test` independent of the emulator.)

- [ ] **Step 3: Write the failing test**

`test/firestore.rules.test.ts`:

```ts
import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

// firebase emulators:exec sets FIRESTORE_EMULATOR_HOST ("host:port") for the
// script it runs, keeping this in sync with firebase.json automatically.
const [emulatorHost, emulatorPort] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
).split(":");

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "chaos-blanket-rules-test",
    firestore: {
      // Resolved via a file URL so tests load firestore.rules correctly
      // regardless of the process's working directory.
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      host: emulatorHost,
      port: Number(emulatorPort),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("users/{uid}/** isolation", () => {
  it("lets a signed-in user write their own top-level user doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice"), { email: "alice@example.com" })
    );
  });

  it("blocks a signed-in user from writing another user's top-level user doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/bob"), { email: "hijack@example.com" })
    );
  });

  it("lets a signed-in user read and write their own project doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p1"), { name: "Blanket 1" })
    );
    await assertSucceeds(getDoc(doc(aliceDb, "users/alice/projects/p1")));
  });

  it("lets a signed-in user read and write nested subcollections of their own project", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p1/stitches/s1"), {
        label: "double crochet",
      })
    );
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p1/history/h1"), {
        stitchLabel: "double crochet",
        colourLabel: "Coral",
        rowCount: 5,
      })
    );
  });

  it("blocks a signed-in user from reading another user's project doc", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/bob/projects/p1"), {
        name: "Bob's blanket",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(aliceDb, "users/bob/projects/p1")));
  });

  it("blocks a signed-in user from writing to another user's stitch library", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/bob/stitchLibrary/s1"), { label: "moss stitch" })
    );
  });

  it("blocks a signed-in user from deleting another user's project doc", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/bob/projects/p1"), {
        name: "Bob's blanket",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(deleteDoc(doc(aliceDb, "users/bob/projects/p1")));
  });

  it("blocks a signed-in user from listing another user's projects collection", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/bob/projects/p1"), {
        name: "Bob's blanket",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDocs(collection(aliceDb, "users/bob/projects")));
  });

  it("blocks an unauthenticated client from reading or writing any users/** doc", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "users/alice/projects/p1")));
    await assertFails(
      setDoc(doc(anonDb, "users/alice/projects/p1"), { name: "hijacked" })
    );
  });

  it("blocks a signed-in owner from writing to their own users/{uid}/meta/** doc", async () => {
    // users/{uid}/meta/** is reserved for server-side bookkeeping (e.g. the
    // Global Pool plan's contributeToGlobal rate limiter) — no client,
    // owner included, may touch it directly.
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/alice/meta/rateLimit"), { count: 0 })
    );
  });

  it("still lets a signed-in owner write to a normal subpath like projects", async () => {
    // Regression guard: proves the meta exclusion above doesn't over-scope
    // and break every other subpath under the recursive rule.
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p2"), { name: "Blanket 2" })
    );
  });
});

describe("default-deny for unmatched paths", () => {
  it("blocks a signed-in user from reading or writing an unmatched top-level path", async () => {
    // Pins the invariant that this file has no top-level catch-all: an
    // unmatched path relies on Firestore's implicit default-deny.
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(aliceDb, "hackers/whatever")));
    await assertFails(
      setDoc(doc(aliceDb, "hackers/whatever"), { pwned: true })
    );
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test:rules`
Expected: FAIL — the deny-all stub from the scaffolding plan (`allow read, write: if false;`) rejects even the owner's own writes.

- [ ] **Step 5: Implement the owner-only rule**

`firestore.rules`:

```
rules_version = '2';
// Invariants for future plans editing this file:
// 1. No top-level `match /{document=**}` — Firestore's implicit default-deny
//    on any unmatched path is intentional and covered by tests. Do not add a
//    catch-all allow (or a catch-all deny stub) at the top level.
// 2. `users/{uid}/meta/**` is Admin-SDK-only. No client — the owner included —
//    may read or write anything under it, in this plan or any future one
//    (it backs server-side bookkeeping like the Global Pool rate limiter).
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /{collectionName}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid && collectionName != 'meta';
      }
    }
  }
}
```

(Why a single-segment wildcard instead of recursive: Firestore Security Rules cannot index into a recursive-wildcard `path` variable (like `document[0]` from `{document=**}`) during `list` (collection-query) operations — only during single-document `get` operations. This limitation would silently block legitimate list queries under `users/{uid}/**`. Using a single-segment wildcard (`{collectionName}/{document=**}`) instead allows the rule to check the first collection name directly (`collectionName != 'meta'`) for both single-document and list operations. This covers all current and future subcollections, not just the three initially used (`stitches`, `colours`, `history`).)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS (all 12 tests in this task; 18 when the Projects & Lists plan adds its regression test)

- [ ] **Step 7: Commit**

```bash
git add firestore.rules test/firestore.rules.test.ts package.json package-lock.json
git commit -m "feat: add owner-only Security Rules for users/{uid}/**"
```

---

### Task 2: Read-only global collections

**Files:**
- Modify: `firestore.rules`, `test/firestore.rules.test.ts`

**Interfaces:**
- Consumes: `testEnv` setup from Task 1
- Produces: the final `firestore.rules` this whole project deploys — no further plan modifies this file

- [ ] **Step 1: Write the failing tests**

Append to `test/firestore.rules.test.ts`:

```ts
describe("globalStitches / globalColours", () => {
  it("lets any signed-in user read a global stitch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalStitches/double-crochet"), {
        label: "Double Crochet",
        contributorCount: 1,
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "globalStitches/double-crochet")));
  });

  it("blocks an unauthenticated client from reading global collections", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalColours/ff0000"), {
        label: "Red",
        hex: "#ff0000",
        contributorCount: 1,
      });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "globalColours/ff0000")));
  });

  it("blocks a signed-in user from writing directly to a global collection", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "globalStitches/moss-stitch"), {
        label: "Moss Stitch",
        contributorCount: 1,
      })
    );
  });

  it("blocks a signed-in user from updating an existing global stitch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalStitches/single-crochet"), {
        label: "Single Crochet",
        contributorCount: 1,
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      updateDoc(doc(aliceDb, "globalStitches/single-crochet"), {
        contributorCount: 2,
      })
    );
  });

  it("blocks a signed-in user from deleting an existing global stitch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalStitches/treble-crochet"), {
        label: "Treble Crochet",
        contributorCount: 1,
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      deleteDoc(doc(aliceDb, "globalStitches/treble-crochet"))
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm run test:rules`
Expected: the 5 new tests FAIL — `firestore.rules` has no `globalStitches`/`globalColours` match yet, so Firestore's implicit default (deny) rejects even the authenticated read.

- [ ] **Step 3: Implement the global-collection rules**

`firestore.rules` — add inside the `match /databases/{database}/documents {` block, alongside the existing `users/{uid}` match:

```
    match /globalStitches/{itemId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /globalColours/{itemId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS (all 17 tests in this task; 18 when the Projects & Lists plan adds its regression test)

- [ ] **Step 5: Commit**

```bash
git add firestore.rules test/firestore.rules.test.ts
git commit -m "feat: make globalStitches/globalColours read-only for signed-in users"
```

---

## Self-Review Notes

- **Spec coverage:** covers both bullets under "Firestore Security Rules" in the spec's Security & Abuse Prevention section. The `contributeToGlobal` function's own validation/rate-limit/denylist logic is covered by the Global Pool plan, not here — this plan only covers the rules the *client* is bound by.
- **Placeholder scan:** none — every rule and test is complete and runnable.
- **Type consistency:** N/A (no TypeScript interfaces produced by this plan); collection paths used in tests match `src/lib/paths.ts` from the scaffolding plan.
- **Final-review fix pass (2026-09-13):** a whole-branch review found that the original recursive `users/{uid}/{document=**}` rule (with no `meta` exclusion) let a client delete or overwrite `users/{uid}/meta/rateLimit` from the SDK, bypassing the `contributeToGlobal` rate limiter described above — since fixed with the `document[0] != 'meta'` guard. The same pass also added: a test pinning Firestore's implicit default-deny for unmatched top-level paths (no rule change needed — this plan never added a catch-all), delete/list verb coverage for cross-user isolation, update/delete verb coverage for the global collections, a location-independent `readFileSync` for `firestore.rules`, `FIRESTORE_EMULATOR_HOST`-driven host/port instead of hardcoding, and `fileParallelism: false` in `vitest.rules.config.ts` to avoid a future multi-file emulator race. This doc's steps above reflect the fixed version.
