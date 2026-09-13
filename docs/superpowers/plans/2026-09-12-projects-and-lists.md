# Chaos Blanket — Projects & Project Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full CRUD on Projects, per-Project Stitch and Colour lists with bulk-paste add, fair (whole-list) duplicate prevention, row-range validation, and a Cloud Function that cascades a Project's subcollections when the Project is deleted.

**Architecture:** Two small pure-function modules (`lib/normalize.ts`, `lib/bulkPaste.ts`) implement the "what counts as a duplicate" and "what does a pasted block parse into" logic in isolation, fully unit-testable with no Firestore involved. A generic `lib/lists.ts` module wraps those pure functions around actual Firestore reads/writes for any labeled-item subcollection (Project Stitches, Project Colours — and, per [CONTEXT.md](../../../CONTEXT.md), reused as-is by the Account Library and Global-Pool-pull-in flows in later plans). `features/projects/projectsApi.ts` handles Project CRUD and row-range validation. A Firestore-trigger Cloud Function (not callable — doesn't count against the "one callable function" constraint) deletes a Project's `stitches`/`colours`/`history` subcollections when its parent doc is deleted, since the client can't recursively delete a subcollection.

**Tech Stack:** Firestore (client SDK), Cloud Functions v2 (`onDocumentDeleted`), firebase-admin, Vitest, React.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md), sections "Data Model", "Feature Flows" (Bulk add, Add library item to a project, Projects), "Testing".

**Depends on:** [2026-09-12-scaffolding-and-setup.md](./2026-09-12-scaffolding-and-setup.md), [2026-09-12-security-rules.md](./2026-09-12-security-rules.md), [2026-09-12-auth-and-user-bootstrap.md](./2026-09-12-auth-and-user-bootstrap.md).

## Global Constraints

- Database: Firestore, all writes under `users/{uid}/...` go directly from client to Firestore (no function in the path for Projects/Project Lists).
- All Firestore timestamp fields use `serverTimestamp()`.
- A Project's `updatedAt` is bumped only by edits to the Project doc itself (name, row range) — never by subcollection activity (adding/deleting a stitch, colour, or history entry).
- Row range: `rowMin == rowMax` is allowed; `rowMin > rowMax` is blocked client-side only, no Security Rules enforcement.
- No caps on list size, Project count, or History size for this MVP.
- Adds (bulk-paste or single) must be deduped case-insensitively against the *entire* existing target list, not just within one pasted batch — duplicate labels would silently skew Generate's random pick.
- A Colour list's duplicate check is by label alone; hex never makes two same-labeled Colours distinct.
- Duplicate adds are silently skipped — no error or toast.
- No automated e2e suite for this MVP — the Projects/Lists screen itself is verified manually; only the underlying pure functions and Firestore/Function logic are automated.

---

## File Structure

```
chaos-blanket/
├── functions/
│   ├── package.json                          (modified: adds vitest, firebase-admin devDep)
│   └── src/
│       └── cascadeDeleteProject.ts
│   └── test/
│       └── cascadeDeleteProject.emulator.test.ts
├── package.json                                (modified: adds test:functions script)
└── src/
    ├── App.tsx                                 (modified: renders ProjectsPanel)
    ├── lib/
    │   ├── normalize.ts
    │   ├── normalize.test.ts
    │   ├── bulkPaste.ts
    │   ├── bulkPaste.test.ts
    │   ├── lists.ts
    │   └── lists.emulator.test.ts
    └── features/
        └── projects/
            ├── projectsApi.ts
            ├── projectsApi.test.ts
            ├── projectsApi.emulator.test.ts
            ├── ItemListEditor.tsx
            └── ProjectsPanel.tsx
```

---

### Task 1: Label normalization

**Files:**
- Create: `src/lib/normalize.ts`, `src/lib/normalize.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeLabel(label: string): string` — the case-insensitivity primitive every dedup check in this plan (and later plans) builds on

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "./normalize";

describe("normalizeLabel", () => {
  it("lowercases and trims", () => {
    expect(normalizeLabel("  Red  ")).toBe("red");
  });

  it("treats differently-cased, differently-spaced labels as equal", () => {
    expect(normalizeLabel("Double Crochet")).toBe(
      normalizeLabel("  double crochet ")
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- normalize.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalize.ts src/lib/normalize.test.ts
git commit -m "feat: add label normalization for case-insensitive dedup"
```

---

### Task 2: Bulk-paste parsing and whole-list dedup

**Files:**
- Create: `src/lib/bulkPaste.ts`, `src/lib/bulkPaste.test.ts`

**Interfaces:**
- Consumes: `normalizeLabel` from Task 1
- Produces: `parseBulkPaste(text: string): string[]`, `dedupeAgainstExisting(candidates: string[], existingLabels: string[]): string[]` — used by `lib/lists.ts` (Task 3) for every add flow in the app

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { dedupeAgainstExisting, parseBulkPaste } from "./bulkPaste";

describe("parseBulkPaste", () => {
  it("splits on newlines, trims, and drops blank lines", () => {
    expect(parseBulkPaste("Red\n  Blue  \n\nGreen")).toEqual([
      "Red",
      "Blue",
      "Green",
    ]);
  });

  it("drops duplicates within the pasted batch, case-insensitively, keeping the first occurrence", () => {
    expect(parseBulkPaste("Red\nred\nRED\nBlue")).toEqual(["Red", "Blue"]);
  });
});

describe("dedupeAgainstExisting", () => {
  it("filters out candidates already present in the existing list, case-insensitively", () => {
    expect(
      dedupeAgainstExisting(["Red", "Green", "blue"], ["red", "Blue"])
    ).toEqual(["Green"]);
  });

  it("returns all candidates when nothing overlaps", () => {
    expect(dedupeAgainstExisting(["Red"], ["Green"])).toEqual(["Red"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- bulkPaste.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
import { normalizeLabel } from "./normalize";

export function parseBulkPaste(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawLine of text.split("\n")) {
    const label = rawLine.trim();
    if (!label) continue;
    const key = normalizeLabel(label);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

export function dedupeAgainstExisting(
  candidates: string[],
  existingLabels: string[]
): string[] {
  const existingKeys = new Set(existingLabels.map(normalizeLabel));
  return candidates.filter((label) => !existingKeys.has(normalizeLabel(label)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- bulkPaste.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bulkPaste.ts src/lib/bulkPaste.test.ts
git commit -m "feat: add bulk-paste parser with whole-list dedup"
```

---

### Task 3: Generic labeled-item list operations (Firestore)

**Files:**
- Create: `src/lib/lists.ts`, `src/lib/lists.emulator.test.ts`

**Interfaces:**
- Consumes: `db` (scaffolding plan), `parseBulkPaste`/`dedupeAgainstExisting` (Task 2)
- Produces: `fetchLabeledItems<T>(collectionPath): Promise<T[]>`, `bulkAddLabels(collectionPath, text, existingLabels): Promise<number>`, `deleteItem(collectionPath, itemId): Promise<void>`, `updateColourHex(collectionPath, itemId, hex): Promise<void>` — the only way any feature (Project Lists here, Account Library and Global Pool pull-in in later plans) touches a Stitch/Colour subcollection

- [ ] **Step 1: Write the failing test**

`src/lib/lists.emulator.test.ts`:

```ts
import { signInAnonymously, signOut } from "firebase/auth";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "./firebase";
import {
  bulkAddLabels,
  deleteItem,
  fetchLabeledItems,
  updateColourHex,
} from "./lists";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

afterEach(async () => {
  await signOut(auth);
});

describe("lists", () => {
  it("bulk-adds only labels not already in the list, and fetch reflects them", async () => {
    const { user } = await signInAnonymously(auth);
    const collectionPath = `users/${user.uid}/projects/p1/colours`;

    const firstAdded = await bulkAddLabels(collectionPath, "Red\nBlue", []);
    expect(firstAdded).toBe(2);

    const secondAdded = await bulkAddLabels(
      collectionPath,
      "red\nGreen",
      ["Red", "Blue"]
    );
    expect(secondAdded).toBe(1); // "red" skipped as a duplicate of "Red"

    const items = await fetchLabeledItems<Item>(collectionPath);
    expect(items.map((i) => i.label).sort()).toEqual(["Blue", "Green", "Red"]);
  });

  it("deletes an item and updates a colour's hex", async () => {
    const { user } = await signInAnonymously(auth);
    const collectionPath = `users/${user.uid}/projects/p1/colours`;

    await bulkAddLabels(collectionPath, "Coral", []);
    const [item] = await fetchLabeledItems<Item>(collectionPath);

    await updateColourHex(collectionPath, item.id, "#FF7F50");
    const [updated] = await fetchLabeledItems<Item>(collectionPath);
    expect(updated.hex).toBe("#FF7F50");

    await deleteItem(collectionPath, item.id);
    expect(await fetchLabeledItems<Item>(collectionPath)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:emulator`
Expected: FAIL — `./lists` module doesn't exist.

- [ ] **Step 3: Implement `src/lib/lists.ts`**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { dedupeAgainstExisting, parseBulkPaste } from "./bulkPaste";

export interface LabeledItem {
  id: string;
  label: string;
}

export async function fetchLabeledItems<T extends LabeledItem>(
  collectionPath: string
): Promise<T[]> {
  const snapshot = await getDocs(collection(db, collectionPath));
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...(d.data() as object) } as T)
  );
}

export async function bulkAddLabels(
  collectionPath: string,
  text: string,
  existingLabels: string[]
): Promise<number> {
  const candidates = parseBulkPaste(text);
  const toAdd = dedupeAgainstExisting(candidates, existingLabels);
  await Promise.all(
    toAdd.map((label) => addDoc(collection(db, collectionPath), { label }))
  );
  return toAdd.length;
}

export async function deleteItem(
  collectionPath: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(db, collectionPath, itemId));
}

export async function updateColourHex(
  collectionPath: string,
  itemId: string,
  hex: string
): Promise<void> {
  await updateDoc(doc(db, collectionPath, itemId), { hex });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:emulator`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lists.ts src/lib/lists.emulator.test.ts
git commit -m "feat: add generic labeled-item list operations with whole-list dedup"
```

---

### Task 4: Row-range validation and Project CRUD

**Files:**
- Create: `src/features/projects/projectsApi.ts`, `src/features/projects/projectsApi.test.ts`, `src/features/projects/projectsApi.emulator.test.ts`

**Interfaces:**
- Consumes: `db`, `Project` type, `projectDocPath`/`projectsCollectionPath` (scaffolding plan)
- Produces: `isValidRowRange(rowMin, rowMax): boolean`, `createProject(uid, input): Promise<string>`, `listProjects(uid): Promise<Project[]>`, `renameProject(uid, projectId, name): Promise<void>`, `updateRowRange(uid, projectId, rowMin, rowMax): Promise<void>`, `deleteProject(uid, projectId): Promise<void>` — consumed by `ProjectsPanel` (Task 6) and, for `deleteProject`, exercised indirectly by Task 5's cascade trigger test

- [ ] **Step 1: Write the failing unit test for `isValidRowRange`**

`src/features/projects/projectsApi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidRowRange } from "./projectsApi";

describe("isValidRowRange", () => {
  it("allows rowMin < rowMax", () => {
    expect(isValidRowRange(2, 6)).toBe(true);
  });

  it("allows rowMin == rowMax (a fixed row count)", () => {
    expect(isValidRowRange(4, 4)).toBe(true);
  });

  it("rejects rowMin > rowMax", () => {
    expect(isValidRowRange(6, 2)).toBe(false);
  });

  it("rejects non-integer or non-positive values", () => {
    expect(isValidRowRange(0, 4)).toBe(false);
    expect(isValidRowRange(1.5, 4)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- projectsApi.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the failing emulator test for CRUD**

`src/features/projects/projectsApi.emulator.test.ts`:

```ts
import { signInAnonymously, signOut } from "firebase/auth";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "../../lib/firebase";
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
  updateRowRange,
} from "./projectsApi";

afterEach(async () => {
  await signOut(auth);
});

describe("projectsApi", () => {
  it("creates, lists, renames, updates the row range of, and deletes a project", async () => {
    const { user } = await signInAnonymously(auth);

    const projectId = await createProject(user.uid, {
      name: "Blanket 1",
      rowMin: 2,
      rowMax: 6,
    });

    let projects = await listProjects(user.uid);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: "Blanket 1", rowMin: 2, rowMax: 6 });

    await renameProject(user.uid, projectId, "Renamed Blanket");
    await updateRowRange(user.uid, projectId, 3, 3);
    projects = await listProjects(user.uid);
    expect(projects[0]).toMatchObject({
      name: "Renamed Blanket",
      rowMin: 3,
      rowMax: 3,
    });

    await deleteProject(user.uid, projectId);
    expect(await listProjects(user.uid)).toEqual([]);
  });

  it("rejects creating a project with an invalid row range", async () => {
    const { user } = await signInAnonymously(auth);
    await expect(
      createProject(user.uid, { name: "Bad", rowMin: 6, rowMax: 2 })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run both tests to verify they fail**

Run: `npm run test -- projectsApi.test.ts` — FAIL (module missing)
Run: `npm run test:emulator` — FAIL (module missing)

- [ ] **Step 5: Implement `src/features/projects/projectsApi.ts`**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { projectDocPath, projectsCollectionPath } from "../../lib/paths";
import type { Project } from "../../types";

export interface NewProjectInput {
  name: string;
  rowMin: number;
  rowMax: number;
}

export function isValidRowRange(rowMin: number, rowMax: number): boolean {
  return (
    Number.isInteger(rowMin) &&
    Number.isInteger(rowMax) &&
    rowMin >= 1 &&
    rowMin <= rowMax
  );
}

export async function createProject(
  uid: string,
  input: NewProjectInput
): Promise<string> {
  if (!isValidRowRange(input.rowMin, input.rowMax)) {
    throw new Error("rowMin must be a positive integer no greater than rowMax");
  }
  const ref = await addDoc(collection(db, projectsCollectionPath(uid)), {
    name: input.name,
    rowMin: input.rowMin,
    rowMax: input.rowMax,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listProjects(uid: string): Promise<Project[]> {
  const snapshot = await getDocs(collection(db, projectsCollectionPath(uid)));
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...(d.data() as object) } as Project)
  );
}

export async function renameProject(
  uid: string,
  projectId: string,
  name: string
): Promise<void> {
  await updateDoc(doc(db, projectDocPath(uid, projectId)), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function updateRowRange(
  uid: string,
  projectId: string,
  rowMin: number,
  rowMax: number
): Promise<void> {
  if (!isValidRowRange(rowMin, rowMax)) {
    throw new Error("rowMin must be a positive integer no greater than rowMax");
  }
  await updateDoc(doc(db, projectDocPath(uid, projectId)), {
    rowMin,
    rowMax,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(
  uid: string,
  projectId: string
): Promise<void> {
  await deleteDoc(doc(db, projectDocPath(uid, projectId)));
}
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `npm run test -- projectsApi.test.ts` — PASS (4 tests)
Run: `npm run test:emulator` — PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/projects/projectsApi.ts src/features/projects/projectsApi.test.ts src/features/projects/projectsApi.emulator.test.ts
git commit -m "feat: add Project CRUD with client-side row-range validation"
```

---

### Task 5: Cascade-delete Cloud Function

**Files:**
- Create: `functions/src/cascadeDeleteProject.ts`, `functions/test/cascadeDeleteProject.emulator.test.ts`, `functions/vitest.config.ts`, `functions/vitest.emulator.config.ts`
- Modify: `functions/src/index.ts`, `functions/package.json`, `package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks (a pure Firestore-trigger function using firebase-admin, independent of the client SDK)
- Produces: the `cascadeDeleteProject` export, deployed alongside `contributeToGlobal` (Global Pool plan) as the app's two Cloud Functions

- [ ] **Step 1: Install test dependencies in `functions/`**

```bash
npm --prefix functions install -D vitest
```

- [ ] **Step 2: Split `functions/`'s tests into plain (no emulator needed) and emulator-backed**

Later plans (Global Pool) add pure-function unit tests to `functions/` — e.g. the Global Key computation — that must run without the emulator. Keep those separate from this task's emulator-dependent trigger test via two Vitest configs and the same `*.emulator.test.ts` naming convention used in the root project.

`functions/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/*.emulator.test.ts"],
  },
});
```

`functions/vitest.emulator.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.emulator.test.ts"],
  },
});
```

`functions/package.json`, in `"scripts"`:

```json
"test": "vitest run",
"test:emulator": "vitest run --config vitest.emulator.config.ts"
```

Root `package.json`, in `"scripts"`:

```json
"test:functions": "firebase emulators:exec --only firestore,functions \"npm --prefix functions run test:emulator\""
```

- [ ] **Step 3: Write the failing test**

`functions/test/cascadeDeleteProject.emulator.test.ts`:

```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: "demo-chaos-blanket" });
});

describe("cascadeDeleteProject", () => {
  it("deletes stitches, colours, and history when the project doc is deleted", async () => {
    const db = getFirestore();
    const uid = "test-uid";
    const projectId = "test-project";
    const projectRef = db.doc(`users/${uid}/projects/${projectId}`);

    await projectRef.set({ name: "Test" });
    await projectRef.collection("stitches").doc("s1").set({ label: "dc" });
    await projectRef.collection("colours").doc("c1").set({ label: "Red" });
    await projectRef.collection("history").doc("h1").set({
      stitchLabel: "dc",
      colourLabel: "Red",
      rowCount: 5,
    });

    await projectRef.delete();

    // The trigger runs asynchronously — poll briefly.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const [stitch, colour, history] = await Promise.all([
      projectRef.collection("stitches").doc("s1").get(),
      projectRef.collection("colours").doc("c1").get(),
      projectRef.collection("history").doc("h1").get(),
    ]);

    expect(stitch.exists).toBe(false);
    expect(colour.exists).toBe(false);
    expect(history.exists).toBe(false);
  }, 15000);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test:functions`
Expected: FAIL — the subcollection docs still exist (no trigger deployed yet).

- [ ] **Step 5: Implement the trigger**

`functions/src/cascadeDeleteProject.ts`:

```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";

if (!getApps().length) initializeApp();

const SUBCOLLECTIONS = ["stitches", "colours", "history"] as const;

export const cascadeDeleteProject = onDocumentDeleted(
  "users/{uid}/projects/{projectId}",
  async (event) => {
    const db = getFirestore();
    const { uid, projectId } = event.params;

    for (const subcollection of SUBCOLLECTIONS) {
      const snapshot = await db
        .collection(`users/${uid}/projects/${projectId}/${subcollection}`)
        .get();
      const batch = db.batch();
      snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
      await batch.commit();
    }
  }
);
```

`functions/src/index.ts`:

```ts
export { cascadeDeleteProject } from "./cascadeDeleteProject";
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test:functions`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add functions/src/cascadeDeleteProject.ts functions/src/index.ts functions/test/cascadeDeleteProject.emulator.test.ts functions/vitest.config.ts functions/vitest.emulator.config.ts functions/package.json package.json
git commit -m "feat: cascade-delete a project's stitches, colours, and history subcollections"
```

---

### Task 6: Projects & Lists UI

**Files:**
- Create: `src/features/projects/ItemListEditor.tsx`, `src/features/projects/ProjectsPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `bulkAddLabels`/`fetchLabeledItems`/`deleteItem`/`updateColourHex` (Task 3), `createProject`/`listProjects`/`renameProject`/`deleteProject`/`isValidRowRange` (Task 4), `projectStitchesCollectionPath`/`projectColoursCollectionPath` (scaffolding plan)
- Produces: `<ProjectsPanel uid={string} />`, rendered by `App.tsx` in the authenticated shell — the mount point later plans (Account Library, Global Pool, Generate, History) add panels alongside

- [ ] **Step 1: Write `ItemListEditor`**

```tsx
import { useEffect, useState } from "react";
import {
  bulkAddLabels,
  deleteItem,
  fetchLabeledItems,
  updateColourHex,
} from "../../lib/lists";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface ItemListEditorProps {
  title: string;
  collectionPath: string;
  supportsHex: boolean;
}

export function ItemListEditor({
  title,
  collectionPath,
  supportsHex,
}: ItemListEditorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [writeError, setWriteError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setItems(await fetchLabeledItems<Item>(collectionPath));
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [collectionPath]);

  // Every write below keeps the textarea/list untouched on failure (there's
  // no optimistic local update to roll back — reload() only runs after a
  // write succeeds) and surfaces an inline message next to this list, per
  // the spec's Error Handling section.
  async function handleBulkAdd() {
    setWriteError(null);
    try {
      await bulkAddLabels(
        collectionPath,
        bulkText,
        items.map((item) => item.label)
      );
      setBulkText("");
      await reload();
    } catch {
      setWriteError("Couldn't save that — check your connection and try again.");
    }
  }

  async function handleDelete(itemId: string) {
    setWriteError(null);
    try {
      await deleteItem(collectionPath, itemId);
      await reload();
    } catch {
      setWriteError("Couldn't delete that — check your connection and try again.");
    }
  }

  async function handleHexChange(itemId: string, hex: string) {
    setWriteError(null);
    try {
      await updateColourHex(collectionPath, itemId, hex);
      await reload();
    } catch {
      setWriteError("Couldn't save that hex — check your connection and try again.");
    }
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <textarea
        className="mt-2 w-full rounded border border-gray-300 p-2 text-sm"
        rows={3}
        placeholder="Paste one per line"
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
      />
      <button
        type="button"
        onClick={handleBulkAdd}
        className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
      >
        Add
      </button>
      {writeError && <p className="mt-1 text-sm text-red-600">{writeError}</p>}
      {loading ? (
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span>{item.label}</span>
              {supportsHex && (
                <input
                  type="text"
                  placeholder="#hex"
                  defaultValue={item.hex ?? ""}
                  onBlur={(e) => {
                    if (e.target.value)
                      void handleHexChange(item.id, e.target.value);
                  }}
                  className="w-20 rounded border border-gray-300 px-1 text-xs"
                />
              )}
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="text-xs text-red-600 underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `ProjectsPanel`**

```tsx
import { useEffect, useState } from "react";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { ItemListEditor } from "./ItemListEditor";
import {
  createProject,
  deleteProject,
  isValidRowRange,
  listProjects,
} from "./projectsApi";

interface ProjectsPanelProps {
  uid: string;
}

export function ProjectsPanel({ uid }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rowMin, setRowMin] = useState(2);
  const [rowMax, setRowMax] = useState(6);
  const [formError, setFormError] = useState<string | null>(null);

  async function reload() {
    setProjects(await listProjects(uid));
  }

  useEffect(() => {
    void reload();
  }, [uid]);

  async function handleCreate() {
    if (!isValidRowRange(rowMin, rowMax)) {
      setFormError("Row min must be a whole number no greater than row max.");
      return;
    }
    setFormError(null);
    await createProject(uid, { name, rowMin, rowMax });
    setName("");
    await reload();
  }

  async function handleDelete(projectId: string) {
    await deleteProject(uid, projectId);
    if (selectedId === projectId) setSelectedId(null);
    await reload();
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-gray-900">Projects</h2>
      <ul className="mt-2 space-y-1">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSelectedId(project.id)}
              className="underline"
            >
              {project.name}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(project.id)}
              className="text-xs text-red-600 underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={rowMin}
          onChange={(e) => setRowMin(Number(e.target.value))}
          className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={rowMax}
          onChange={(e) => setRowMax(Number(e.target.value))}
          className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          Create project
        </button>
      </div>
      {formError && <p className="mt-1 text-sm text-red-600">{formError}</p>}

      {selected && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="font-semibold text-gray-900">{selected.name}</h3>
          <ItemListEditor
            title="Stitches"
            collectionPath={projectStitchesCollectionPath(uid, selected.id)}
            supportsHex={false}
          />
          <ItemListEditor
            title="Colours"
            collectionPath={projectColoursCollectionPath(uid, selected.id)}
            supportsHex
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire `ProjectsPanel` into `App.tsx`**

In `App.tsx`, inside the authenticated branch (after the "Signed in as …" paragraph):

```tsx
import { ProjectsPanel } from "./features/projects/ProjectsPanel";

// ...inside the signed-in return block, after the existing <p>:
<ProjectsPanel uid={user.uid} />
```

- [ ] **Step 4: Verify manually against the emulator**

Run `firebase emulators:start` and `npm run dev`, sign in. Create a project with row range 2–6. Bulk-paste `Double Crochet\nMoss Stitch\ndouble crochet` into Stitches — confirm only 2 items appear (the third is a case-insensitive duplicate, silently skipped). Add a Colour, set its hex via the inline field, delete a Colour, delete the project — confirm the Emulator UI's Firestore tab shows the project and all its subcollections gone.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/ItemListEditor.tsx src/features/projects/ProjectsPanel.tsx src/App.tsx
git commit -m "feat: add Projects and Project Lists UI"
```

---

## Self-Review Notes

- **Spec coverage:** Data Model's `projects`/`stitches`/`colours` subcollections, Feature Flows' "Bulk add to a list" and "Projects" (CRUD + cascade delete), and Error Handling's "Firestore write failures: inline error near the affected UI" (Task 6's `writeError` state on `ItemListEditor`). The Testing section's "inclusive random row-range picker" is *not* here (that's Generate, in the Generate & History plan) — this plan covers row-*range validation*, a different function, not the random picker itself.
- **Placeholder scan:** none — every step has runnable code or a concrete manual-verification script.
- **Type consistency:** `LabeledItem { id, label }` (Task 3) is a structural subset of both `StitchItem` and `ColourItem` from `src/types.ts`; `Project` fields (`name`, `rowMin`, `rowMax`, `createdAt`, `updatedAt`) match Task 4's Firestore writes exactly.
