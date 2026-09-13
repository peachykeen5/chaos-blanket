# Chaos Blanket — Global Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `contributeToGlobal` callable Cloud Function (validation, denylist, per-user daily rate-limit, Global Key dedup with atomic `contributorCount`), plus a client-side browse panel (paginated, alphabetical, prefix search) that lets any signed-in user pull a Global Pool item into their own Account Library.

**Architecture:** Per [docs/adr/0001-global-pool-key-scheme.md](../../adr/0001-global-pool-key-scheme.md), a pure `computeGlobalKey(label, hex?)` function derives the Firestore doc ID — hex-when-present, else normalized label — so "does this doc already exist" is the whole dedup check, done inside a transaction that also atomically bumps `contributorCount`. The function is the *only* writer to `globalStitches`/`globalColours` (enforced by the Security Rules plan); every other write in the app goes client → Firestore directly. On the client, `src/lib/contribute.ts` wraps the callable in a fire-and-forget, error-swallowing call (per spec: contribution failures never block or surface to the user), reused here for "pull into library" and reused again by the Account Library plan for "save to library".

**Tech Stack:** Cloud Functions v2 (`onCall`), firebase-admin (Firestore transactions, `FieldValue.increment`), Firebase JS SDK (`httpsCallable`, Firestore queries with cursor pagination), Vitest, Firebase Emulator Suite.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md), sections "Data Model" (`globalStitches`/`globalColours`), "Feature Flows" (Browse global pool), "Security & Abuse Prevention" (`contributeToGlobal`), "Testing" (Cloud Function tests).

**Depends on:** [2026-09-12-scaffolding-and-setup.md](./2026-09-12-scaffolding-and-setup.md), [2026-09-12-security-rules.md](./2026-09-12-security-rules.md), [2026-09-12-projects-and-lists.md](./2026-09-12-projects-and-lists.md) (reuses `lib/lists.ts`'s `bulkAddLabels`/`fetchLabeledItems`/`updateColourHex` and `lib/normalize.ts`'s `normalizeLabel` for writing a pulled item into the Account Library).

**Note on execution order:** this plan does not depend on the Account Library plan — it writes into `stitchLibrary`/`colourLibrary` using the generic list helpers from the Projects & Lists plan directly. Build this plan *before* Account Library, since Account Library's "save to library" flow calls `contributeItem` from this plan.

## Global Constraints

- Backend: `contributeToGlobal` is the sole callable Cloud Function and the sole write path into the global pool.
- Abuse protection: Firebase App Check in front of both Firestore and the Cloud Functions. The Cloud Functions emulator does not enforce App Check locally (it can't reach the live App Check backend) — it logs a warning and allows the call through, so `enforceAppCheck: true` stays in the deployed code without blocking the automated emulator tests in this plan. App Check itself is verified manually against the deployed app, not by these tests.
- `contributeToGlobal` requires `context.auth` and a valid App Check token; validates label length 1–60; strips disallowed characters; rejects empty/whitespace-only input; runs a denylist check; rate-limits per user (~20/day, calendar-day UTC, per `users/{uid}/meta/rateLimit`).
- Global Key: hex-when-present (lowercased, `#` stripped) else normalized label — see ADR 0001. First contributor's label wins on a key collision.
- Never re-fires from an edit — only from "save to library" and "pull from Global Pool," both outside this function's own code (the function itself has no way to know why it was called, so this constraint is enforced by which client code paths call it, not by the function).
- The background contribute call is silent and best-effort: failures are caught, logged, and never surfaced to the user or allowed to affect the write that triggered them.
- No caps beyond the stated rate limit.

---

## File Structure

```
chaos-blanket/
├── functions/
│   ├── package.json                       (modified: adds firebase client SDK as a devDependency, for emulator tests)
│   └── src/
│       ├── index.ts                        (modified: also exports contributeToGlobal)
│       ├── normalize.ts
│       ├── normalize.test.ts
│       ├── denylist.ts
│       ├── validation.ts
│       ├── validation.test.ts
│       ├── contributeToGlobal.ts
│   └── test/
│       └── contributeToGlobal.emulator.test.ts
└── src/
    ├── App.tsx                             (modified: renders GlobalPoolBrowser)
    ├── lib/
    │   └── contribute.ts
    └── features/
        └── globalPool/
            ├── globalPoolApi.ts
            └── GlobalPoolBrowser.tsx
```

---

### Task 1: Global Key computation

**Files:**
- Create: `functions/src/normalize.ts`, `functions/src/normalize.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `computeGlobalKey(label: string, hex?: string): string` — used by `contributeToGlobal` (Task 3) as the Firestore doc ID

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { computeGlobalKey } from "./normalize";

describe("computeGlobalKey", () => {
  it("normalizes a label with no hex: lowercase, trim, spaces to hyphens", () => {
    expect(computeGlobalKey("  Double Crochet  ")).toBe("double-crochet");
  });

  it("strips punctuation from a label-only key", () => {
    expect(computeGlobalKey("Moss-Stitch!!")).toBe("moss-stitch");
  });

  it("keys on hex, ignoring the label entirely, when hex is present", () => {
    expect(computeGlobalKey("Coral", "#FF7F50")).toBe("ff7f50");
    expect(computeGlobalKey("Sunset Orange", "#FF7F50")).toBe("ff7f50");
  });

  it("keys two different hexes for the same label as different entries", () => {
    expect(computeGlobalKey("Coral", "#FF7F50")).not.toBe(
      computeGlobalKey("Coral", "#FF6F61")
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix functions test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
export function computeGlobalKey(label: string, hex?: string): string {
  if (hex) {
    return hex.trim().replace(/^#/, "").toLowerCase();
  }
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix functions test`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/normalize.ts functions/src/normalize.test.ts
git commit -m "feat: add Global Key computation (hex-when-present, else normalized label)"
```

---

### Task 2: Label validation and denylist

**Files:**
- Create: `functions/src/denylist.ts`, `functions/src/validation.ts`, `functions/src/validation.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `sanitizeLabel(raw: string): string`, `isValidLabel(label: string): boolean`, `isDenylisted(label: string): boolean` — used by `contributeToGlobal` (Task 3)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { isDenylisted, isValidLabel, sanitizeLabel } from "./validation";

describe("sanitizeLabel", () => {
  it("strips angle brackets and braces and trims", () => {
    expect(sanitizeLabel("  <b>Red</b>  ")).toBe("bRed/b");
  });
});

describe("isValidLabel", () => {
  it("accepts 1-60 characters", () => {
    expect(isValidLabel("Red")).toBe(true);
    expect(isValidLabel("x".repeat(60))).toBe(true);
  });

  it("rejects empty or over-length labels", () => {
    expect(isValidLabel("")).toBe(false);
    expect(isValidLabel("x".repeat(61))).toBe(false);
  });
});

describe("isDenylisted", () => {
  it("flags a label containing a denylisted term, case-insensitively", () => {
    expect(isDenylisted("Visit HTTP://spam.example now")).toBe(true);
  });

  it("allows an ordinary label", () => {
    expect(isDenylisted("Double Crochet")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix functions test`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

`functions/src/denylist.ts` (starter list — extend with real spam/profanity terms as a content-moderation decision, separate from this engineering task):

```ts
export const DENYLIST: readonly string[] = [
  "http://",
  "https://",
  "www.",
  "viagra",
];
```

`functions/src/validation.ts`:

```ts
import { DENYLIST } from "./denylist";

export const MAX_LABEL_LENGTH = 60;

export function sanitizeLabel(raw: string): string {
  return raw.replace(/[<>{}[\]\\]/g, "").trim();
}

export function isValidLabel(label: string): boolean {
  return label.length >= 1 && label.length <= MAX_LABEL_LENGTH;
}

export function isDenylisted(label: string): boolean {
  const normalized = label.toLowerCase();
  return DENYLIST.some((term) => normalized.includes(term));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix functions test`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/denylist.ts functions/src/validation.ts functions/src/validation.test.ts
git commit -m "feat: add label validation and denylist check"
```

---

### Task 3: `contributeToGlobal` Cloud Function

**Files:**
- Create: `functions/src/contributeToGlobal.ts`, `functions/test/contributeToGlobal.emulator.test.ts`
- Modify: `functions/src/index.ts`, `functions/package.json`

**Interfaces:**
- Consumes: `computeGlobalKey` (Task 1), `sanitizeLabel`/`isValidLabel`/`isDenylisted` (Task 2)
- Produces: the deployed `contributeToGlobal` callable, invoked as `httpsCallable(functions, "contributeToGlobal")({ kind: "stitch" | "colour", label: string, hex?: string })` returning `{ key: string }` — the shape `src/lib/contribute.ts` (Task 4) calls

- [ ] **Step 1: Install the client SDK as a test-only dependency in `functions/`**

```bash
npm --prefix functions install -D firebase
```

- [ ] **Step 2: Write the failing test**

`functions/test/contributeToGlobal.emulator.test.ts`:

```ts
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import {
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-chaos-blanket";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

beforeAll(() => {
  if (!getAdminApps().length) initializeAdminApp({ projectId: PROJECT_ID });
});

let clientCount = 0;
function makeClient() {
  const app = initializeClientApp({ projectId: PROJECT_ID }, `client-${clientCount++}`);
  const auth = getAuth(app);
  const functions = getFunctions(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return { auth, functions };
}

describe("contributeToGlobal", () => {
  it("creates a new global stitch on first contribution", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    const result = await contribute({ kind: "stitch", label: "Double Crochet" });
    expect((result.data as { key: string }).key).toBe("double-crochet");

    const snapshot = await getAdminFirestore()
      .doc("globalStitches/double-crochet")
      .get();
    expect(snapshot.data()).toMatchObject({
      label: "Double Crochet",
      contributorCount: 1,
    });
  });

  it("increments contributorCount instead of duplicating on a repeat key, keeping the first label", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await contribute({ kind: "colour", label: "Coral", hex: "#FF7F50" });
    await contribute({ kind: "colour", label: "Coral (again)", hex: "#FF7F50" });

    const snapshot = await getAdminFirestore().doc("globalColours/ff7f50").get();
    expect(snapshot.data()?.contributorCount).toBe(2);
    expect(snapshot.data()?.label).toBe("Coral");
  });

  it("rejects a label over 60 characters", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "x".repeat(61) })
    ).rejects.toThrow();
  });

  it("rejects a denylisted label", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "visit http://spam.example" })
    ).rejects.toThrow();
  });

  it("rejects an unauthenticated call", async () => {
    const { functions } = makeClient();
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "Anonymous Attempt" })
    ).rejects.toThrow();
  });

  it("rate-limits after 20 contributions in the same calendar day", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    for (let i = 0; i < 20; i++) {
      await contribute({ kind: "stitch", label: `Rate Limit Stitch ${i}` });
    }

    await expect(
      contribute({ kind: "stitch", label: "One too many" })
    ).rejects.toThrow();
  }, 30000);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:functions` (from the repo root — this starts the Firestore + Functions emulators)
Expected: FAIL — `contributeToGlobal` isn't exported yet.

- [ ] **Step 4: Implement `contributeToGlobal`**

```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { computeGlobalKey } from "./normalize";
import { isDenylisted, isValidLabel, sanitizeLabel } from "./validation";

if (!getApps().length) initializeApp();

const DAILY_LIMIT = 20;

interface ContributeInput {
  kind: "stitch" | "colour";
  label: string;
  hex?: string;
}

export const contributeToGlobal = onCall<ContributeInput>(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const label = sanitizeLabel(request.data.label ?? "");
    const { kind, hex } = request.data;

    if (!isValidLabel(label)) {
      throw new HttpsError(
        "invalid-argument",
        "Label must be 1-60 characters."
      );
    }
    if (isDenylisted(label)) {
      throw new HttpsError("invalid-argument", "Label not allowed.");
    }

    const db = getFirestore();
    await enforceRateLimit(db, request.auth.uid);

    const collectionName = kind === "stitch" ? "globalStitches" : "globalColours";
    const key = computeGlobalKey(label, hex);
    const ref = db.collection(collectionName).doc(key);

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists) {
        tx.update(ref, { contributorCount: FieldValue.increment(1) });
      } else {
        tx.set(ref, {
          label,
          ...(hex ? { hex } : {}),
          createdAt: FieldValue.serverTimestamp(),
          contributorCount: 1,
        });
      }
    });

    return { key };
  }
);

async function enforceRateLimit(
  db: FirebaseFirestore.Firestore,
  uid: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // UTC calendar day
  const ref = db.doc(`users/${uid}/meta/rateLimit`);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();

    if (!snapshot.exists || data?.date !== today) {
      tx.set(ref, { date: today, count: 1 });
      return;
    }
    if (data.count >= DAILY_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "Daily contribution limit reached."
      );
    }
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}
```

`functions/src/index.ts`:

```ts
export { cascadeDeleteProject } from "./cascadeDeleteProject";
export { contributeToGlobal } from "./contributeToGlobal";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:functions`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add functions/src/contributeToGlobal.ts functions/src/index.ts functions/test/contributeToGlobal.emulator.test.ts functions/package.json functions/package-lock.json
git commit -m "feat: add contributeToGlobal Cloud Function"
```

---

### Task 4: Client-side background contribute wrapper

**Files:**
- Create: `src/lib/contribute.ts`

**Interfaces:**
- Consumes: `functions` from `src/lib/firebase.ts`
- Produces: `contributeItem(kind, label, hex?): Promise<void>` — fire-and-forget, never throws; used by `GlobalPoolBrowser` (Task 5, this plan) and by "save to library" (Account Library plan)

- [ ] **Step 1: Implement**

```ts
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function contributeItem(
  kind: "stitch" | "colour",
  label: string,
  hex?: string
): Promise<void> {
  try {
    const contribute = httpsCallable(functions, "contributeToGlobal");
    await contribute({ kind, label, ...(hex ? { hex } : {}) });
  } catch (error) {
    // Best-effort and silent per spec: never blocks or surfaces to the user.
    console.error("contributeToGlobal failed (non-blocking)", error);
  }
}
```

No automated test here — this is a thin, side-effecting wrapper whose only job is "call the function, swallow errors," and its actual behavior (validation, dedup, rate-limiting) is already covered by Task 3's emulator tests. It's exercised manually in Task 5.

- [ ] **Step 2: Commit**

```bash
git add src/lib/contribute.ts
git commit -m "feat: add fire-and-forget contributeToGlobal client wrapper"
```

---

### Task 5: Global Pool browse UI

**Files:**
- Create: `src/features/globalPool/globalPoolApi.ts`, `src/features/globalPool/GlobalPoolBrowser.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `globalStitchesCollectionPath`/`globalColoursCollectionPath` (scaffolding plan), `fetchLabeledItems`/`bulkAddLabels`/`updateColourHex` (Projects & Lists plan), `normalizeLabel` (Projects & Lists plan), `contributeItem` (Task 4), `GlobalItemDoc` (scaffolding plan)
- Produces: `<GlobalPoolBrowser uid kind collectionPath />`, rendered in `App.tsx`

- [ ] **Step 1: Implement `globalPoolApi.ts`**

```ts
import {
  type QueryDocumentSnapshot,
  collection,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  startAt,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  bulkAddLabels,
  fetchLabeledItems,
  updateColourHex,
} from "../../lib/lists";
import { normalizeLabel } from "../../lib/normalize";
import type { GlobalItemDoc } from "../../types";
import { contributeItem } from "../../lib/contribute";

const PAGE_SIZE = 30;

export interface GlobalPoolPage {
  items: GlobalItemDoc[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function fetchGlobalPoolPage(
  globalCollectionPath: string,
  options: { prefix?: string; after?: QueryDocumentSnapshot | null } = {}
): Promise<GlobalPoolPage> {
  const constraints = [orderBy("label"), limit(PAGE_SIZE)];

  if (options.after) {
    constraints.push(startAfter(options.after));
  } else if (options.prefix) {
    constraints.push(startAt(options.prefix));
  }
  if (options.prefix) {
    constraints.push(endAt(options.prefix + ""));
  }

  const snapshot = await getDocs(
    query(collection(db, globalCollectionPath), ...constraints)
  );
  return {
    items: snapshot.docs.map(
      (d) => ({ id: d.id, ...(d.data() as object) } as GlobalItemDoc)
    ),
    lastDoc: snapshot.docs.at(-1) ?? null,
  };
}

/**
 * Copies a Global Pool item into the user's Account Library (direct write,
 * skipped if already present), then fires the same background contribute
 * call as "save to library" — a no-op contributorCount bump since the item
 * already exists under this Global Key.
 */
export async function pullIntoLibrary(
  libraryCollectionPath: string,
  kind: "stitch" | "colour",
  item: GlobalItemDoc
): Promise<void> {
  const existing = await fetchLabeledItems<{ id: string; label: string }>(
    libraryCollectionPath
  );
  const added = await bulkAddLabels(
    libraryCollectionPath,
    item.label,
    existing.map((i) => i.label)
  );

  if (added > 0 && kind === "colour" && item.hex) {
    const refreshed = await fetchLabeledItems<{ id: string; label: string }>(
      libraryCollectionPath
    );
    const created = refreshed.find(
      (i) => normalizeLabel(i.label) === normalizeLabel(item.label)
    );
    if (created) await updateColourHex(libraryCollectionPath, created.id, item.hex);
  }

  void contributeItem(kind, item.label, item.hex);
}
```

- [ ] **Step 2: Implement `GlobalPoolBrowser.tsx`**

```tsx
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useState } from "react";
import type { GlobalItemDoc } from "../../types";
import { fetchGlobalPoolPage, pullIntoLibrary } from "./globalPoolApi";

interface GlobalPoolBrowserProps {
  kind: "stitch" | "colour";
  globalCollectionPath: string;
  libraryCollectionPath: string;
}

export function GlobalPoolBrowser({
  kind,
  globalCollectionPath,
  libraryCollectionPath,
}: GlobalPoolBrowserProps) {
  const [prefix, setPrefix] = useState("");
  const [items, setItems] = useState<GlobalItemDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function search(reset: boolean) {
    const page = await fetchGlobalPoolPage(globalCollectionPath, {
      prefix: prefix || undefined,
      after: reset ? null : lastDoc,
    });
    setItems(reset ? page.items : [...items, ...page.items]);
    setLastDoc(page.lastDoc);
    setHasMore(page.items.length === 30);
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search…"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => search(true)}
          className="text-sm underline"
        >
          Search
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span>{item.label}</span>
            <button
              type="button"
              onClick={() => pullIntoLibrary(libraryCollectionPath, kind, item)}
              className="text-xs text-blue-600 underline"
            >
              Add to my library
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => search(false)}
          className="mt-2 text-sm underline"
        >
          Load more
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```tsx
import { GlobalPoolBrowser } from "./features/globalPool/GlobalPoolBrowser";
import {
  colourLibraryCollectionPath,
  globalColoursCollectionPath,
  globalStitchesCollectionPath,
  stitchLibraryCollectionPath,
} from "./lib/paths";

// ...inside the signed-in return block, after <ProjectsPanel uid={user.uid} />:
<div className="mt-6 border-t border-gray-200 pt-4">
  <h2 className="font-semibold text-gray-900">Browse global stitches</h2>
  <GlobalPoolBrowser
    kind="stitch"
    globalCollectionPath={globalStitchesCollectionPath()}
    libraryCollectionPath={stitchLibraryCollectionPath(user.uid)}
  />
  <h2 className="mt-6 font-semibold text-gray-900">Browse global colours</h2>
  <GlobalPoolBrowser
    kind="colour"
    globalCollectionPath={globalColoursCollectionPath()}
    libraryCollectionPath={colourLibraryCollectionPath(user.uid)}
  />
</div>
```

- [ ] **Step 4: Verify manually against the emulator**

With `firebase emulators:start` and `npm run dev` running, sign in as one fake account and use the Projects panel's "save to library" placeholder isn't built yet (Account Library plan) — instead, seed the Global Pool directly via the Emulator UI's Firestore tab (add a `globalStitches/double-crochet` doc with `label: "Double Crochet"`, `contributorCount: 1`). Confirm it appears in the browse list, search-by-prefix narrows to it, and clicking "Add to my library" creates a `users/{uid}/stitchLibrary` doc (visible in the Emulator UI) without erroring.

- [ ] **Step 5: Commit**

```bash
git add src/features/globalPool/globalPoolApi.ts src/features/globalPool/GlobalPoolBrowser.tsx src/App.tsx
git commit -m "feat: add Global Pool browse and pull-into-library UI"
```

---

## Self-Review Notes

- **Spec coverage:** Data Model's `globalStitches`/`globalColours`, Feature Flows' "Browse global pool," and the full `contributeToGlobal` bullet list under Security & Abuse Prevention (auth+App Check, validation, denylist, rate-limit, dedup-via-doc-ID). "Save a project item to account library" (the other flow that calls `contributeItem`) is covered by the Account Library plan, which now has `contributeItem` available to import.
- **Placeholder scan:** none — every step has complete code; the one manual-verification step (Task 5, Step 4) spells out exact actions since the Account Library "save" button doesn't exist yet at this point in the build order.
- **Type consistency:** `contributeToGlobal`'s input shape (`{ kind, label, hex? }`) and output (`{ key }`) match exactly between the Cloud Function (Task 3) and `contributeItem`'s call (Task 4). `pullIntoLibrary`'s `kind` parameter (`"stitch" | "colour"`) matches `GlobalPoolBrowser`'s prop and `contributeItem`'s first argument throughout.
