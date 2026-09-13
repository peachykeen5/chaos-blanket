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
└── test/
    └── firestore.rules.test.ts
```

---

### Task 1: Owner-only access under `users/{uid}/**`

**Files:**
- Modify: `firestore.rules`
- Create: `test/firestore.rules.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `firebase.json` emulator config from the scaffolding plan
- Produces: a passing `users/{uid}/**` rule and the `testEnv` / `assertSucceeds` / `assertFails` test-setup pattern Task 2 reuses

- [ ] **Step 1: Install the rules-testing library**

```bash
npm install -D @firebase/rules-unit-testing
```

- [ ] **Step 2: Add a `test:rules` script**

`package.json`, in `"scripts"`:

```json
"test:rules": "firebase emulators:exec --only firestore \"vitest run test/firestore.rules.test.ts\""
```

- [ ] **Step 3: Write the failing test**

`test/firestore.rules.test.ts`:

```ts
import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "chaos-blanket-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
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

  it("blocks an unauthenticated client from reading or writing any users/** doc", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "users/alice/projects/p1")));
    await assertFails(
      setDoc(doc(anonDb, "users/alice/projects/p1"), { name: "hijacked" })
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
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS (all 5 tests)

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
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm run test:rules`
Expected: the 3 new tests FAIL — `firestore.rules` has no `globalStitches`/`globalColours` match yet, so Firestore's implicit default (deny) rejects even the authenticated read.

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
Expected: PASS (all 8 tests)

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
