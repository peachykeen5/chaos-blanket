# Chaos Blanket — Generate & History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Generate action — pick one random Stitch, one random Colour, and an inclusive random Row Count, write the resulting Segment straight to History — plus a per-project History list with individual delete, and a disabled Generate button with a helper message when the project isn't ready.

**Architecture:** Two pure, injectable-random functions (`pickRandomInclusive`, `pickRandomItem`) carry all the randomness logic and are fully unit-testable without touching Firestore. `generateApi.ts` wraps them: fetch the project's current Stitch and Colour lists (one-time reads, per the read-pattern decision in [CONTEXT.md](../../../CONTEXT.md)), pick, and `addDoc` the resulting [Segment](../../../CONTEXT.md) into `history` with `serverTimestamp()` — every call creates a new entry, even if it happens to match the previous one exactly (Segments are never merged). The UI is a `GeneratePanel` (button + disabled-reason + error message) and a `HistoryList` (newest-first, individually deletable), composed together so a successful Generate refreshes the History list.

**Tech Stack:** Firestore (client SDK), React.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md), sections "Feature Flows" (Generate, History), "Error Handling" (Generate disabled state), "Testing" (inclusive random row-range picker).

**Depends on:** [2026-09-12-projects-and-lists.md](./2026-09-12-projects-and-lists.md) (`lib/lists.ts`, `projectsApi.ts`'s `isValidRowRange`, `ProjectsPanel`).

## Global Constraints

- Generate is fully client-side: pick from the project's own lists, write immediately to `history` — no save/skip/preview step.
- Every Generate call creates a new History entry; consecutive entries are never merged even if identical.
- `generatedAt` uses `serverTimestamp()`, so "newest first" ordering is correct regardless of client clock skew.
- The Generate button is disabled with a helper message if the project is missing a Stitch, a Colour, or has an invalid row range.
- History entries store `stitchLabel`/`colourLabel`/`colourHex` as a snapshot (not a reference) — editing or deleting the source Item later never changes past History.
- No caps on History size; deletion is one-by-one only, no bulk-clear.
- No automated e2e suite — this plan's final task is the spec's manual golden-path check, since there is no full end-to-end automated coverage.

---

## File Structure

```
chaos-blanket/
├── src/
│   ├── features/
│   │   ├── projects/
│   │   │   └── ProjectsPanel.tsx              (modified: renders GenerateAndHistoryPanel)
│   │   ├── generate/
│   │   │   ├── random.ts
│   │   │   ├── random.test.ts
│   │   │   ├── generateApi.ts
│   │   │   ├── generateApi.emulator.test.ts
│   │   │   ├── GeneratePanel.tsx
│   │   │   └── GenerateAndHistoryPanel.tsx
│   │   └── history/
│   │       └── HistoryList.tsx
```

---

### Task 1: Random pickers

**Files:**
- Create: `src/features/generate/random.ts`, `src/features/generate/random.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `pickRandomInclusive(min: number, max: number, random?: () => number): number`, `pickRandomItem<T>(items: T[], random?: () => number): T` — used by `generateApi.ts` (Task 2)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { pickRandomInclusive, pickRandomItem } from "./random";

describe("pickRandomInclusive", () => {
  it("returns the fixed value when min equals max, regardless of randomness", () => {
    expect(pickRandomInclusive(4, 4, () => 0)).toBe(4);
    expect(pickRandomInclusive(4, 4, () => 0.999)).toBe(4);
  });

  it("returns min when the random source returns 0", () => {
    expect(pickRandomInclusive(2, 6, () => 0)).toBe(2);
  });

  it("returns max when the random source returns just under 1 (inclusive upper bound)", () => {
    expect(pickRandomInclusive(2, 6, () => 0.999999)).toBe(6);
  });
});

describe("pickRandomItem", () => {
  it("picks the item at the index implied by the random source", () => {
    expect(pickRandomItem(["a", "b", "c"], () => 0)).toBe("a");
    expect(pickRandomItem(["a", "b", "c"], () => 0.999)).toBe("c");
  });

  it("throws on an empty list", () => {
    expect(() => pickRandomItem([], () => 0)).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- random.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
export function pickRandomInclusive(
  min: number,
  max: number,
  random: () => number = Math.random
): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pickRandomItem<T>(
  items: T[],
  random: () => number = Math.random
): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }
  return items[Math.floor(random() * items.length)];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- random.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/generate/random.ts src/features/generate/random.test.ts
git commit -m "feat: add inclusive random row-count and item pickers"
```

---

### Task 2: Generate and fetch History

**Files:**
- Create: `src/features/generate/generateApi.ts`, `src/features/generate/generateApi.emulator.test.ts`

**Interfaces:**
- Consumes: `pickRandomInclusive`/`pickRandomItem` (Task 1), `fetchLabeledItems` (Projects & Lists plan), `projectStitchesCollectionPath`/`projectColoursCollectionPath`/`projectHistoryCollectionPath` (scaffolding plan), `StitchItem`/`ColourItem`/`HistoryEntry`/`Project` (scaffolding plan)
- Produces: `generateSegment(uid, project): Promise<void>`, `fetchHistory(uid, projectId): Promise<HistoryEntry[]>` — consumed by `GeneratePanel`/`HistoryList` (Task 3)

- [ ] **Step 1: Write the failing test**

`src/features/generate/generateApi.emulator.test.ts`:

```ts
import { signInAnonymously, signOut } from "firebase/auth";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "../../lib/firebase";
import { bulkAddLabels } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { fetchHistory, generateSegment } from "./generateApi";

afterEach(async () => {
  await signOut(auth);
});

function makeProject(id: string, rowMin: number, rowMax: number): Project {
  return { id, name: "Test", rowMin, rowMax, createdAt: null, updatedAt: null };
}

describe("generateSegment", () => {
  it("writes a history entry using the project's only stitch and colour, with rowCount in range", async () => {
    const { user } = await signInAnonymously(auth);
    const project = makeProject("p1", 2, 4);
    await bulkAddLabels(
      projectStitchesCollectionPath(user.uid, project.id),
      "Double Crochet",
      []
    );
    await bulkAddLabels(
      projectColoursCollectionPath(user.uid, project.id),
      "Coral",
      []
    );

    await generateSegment(user.uid, project);

    const history = await fetchHistory(user.uid, project.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      stitchLabel: "Double Crochet",
      colourLabel: "Coral",
    });
    expect(history[0].rowCount).toBeGreaterThanOrEqual(2);
    expect(history[0].rowCount).toBeLessThanOrEqual(4);
  });

  it("never merges consecutive generates, even when they land on identical values", async () => {
    const { user } = await signInAnonymously(auth);
    const project = makeProject("p2", 3, 3); // fixed row count forces identical Segments
    await bulkAddLabels(
      projectStitchesCollectionPath(user.uid, project.id),
      "Moss Stitch",
      []
    );
    await bulkAddLabels(
      projectColoursCollectionPath(user.uid, project.id),
      "Red",
      []
    );

    await generateSegment(user.uid, project);
    await generateSegment(user.uid, project);

    const history = await fetchHistory(user.uid, project.id);
    expect(history).toHaveLength(2);
  });

  it("throws if the project has no stitches or no colours", async () => {
    const { user } = await signInAnonymously(auth);
    const project = makeProject("p3", 1, 1);
    await expect(generateSegment(user.uid, project)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:emulator`
Expected: FAIL — `./generateApi` module doesn't exist.

- [ ] **Step 3: Implement `generateApi.ts`**

```ts
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectHistoryCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { ColourItem, HistoryEntry, Project, StitchItem } from "../../types";
import { pickRandomInclusive, pickRandomItem } from "./random";

export async function generateSegment(
  uid: string,
  project: Project
): Promise<void> {
  const [stitches, colours] = await Promise.all([
    fetchLabeledItems<StitchItem>(projectStitchesCollectionPath(uid, project.id)),
    fetchLabeledItems<ColourItem>(projectColoursCollectionPath(uid, project.id)),
  ]);

  if (stitches.length === 0 || colours.length === 0) {
    throw new Error(
      "This project needs at least one stitch and one colour to generate."
    );
  }

  const stitch = pickRandomItem(stitches);
  const colour = pickRandomItem(colours);
  const rowCount = pickRandomInclusive(project.rowMin, project.rowMax);

  await addDoc(collection(db, projectHistoryCollectionPath(uid, project.id)), {
    stitchLabel: stitch.label,
    colourLabel: colour.label,
    ...(colour.hex ? { colourHex: colour.hex } : {}),
    rowCount,
    generatedAt: serverTimestamp(),
  });
}

export async function fetchHistory(
  uid: string,
  projectId: string
): Promise<HistoryEntry[]> {
  const snapshot = await getDocs(
    query(
      collection(db, projectHistoryCollectionPath(uid, projectId)),
      orderBy("generatedAt", "desc")
    )
  );
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...(d.data() as object) } as HistoryEntry)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:emulator`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/generate/generateApi.ts src/features/generate/generateApi.emulator.test.ts
git commit -m "feat: add Generate and History fetch, snapshotting labels at generate time"
```

---

### Task 3: Generate and History UI

**Files:**
- Create: `src/features/generate/GeneratePanel.tsx`, `src/features/generate/GenerateAndHistoryPanel.tsx`, `src/features/history/HistoryList.tsx`
- Modify: `src/features/projects/ProjectsPanel.tsx`

**Interfaces:**
- Consumes: `generateSegment`/`fetchHistory` (Task 2), `isValidRowRange` (Projects & Lists plan), `fetchLabeledItems`/`deleteItem` (Projects & Lists plan), `Project`/`HistoryEntry` (scaffolding plan)
- Produces: `<GenerateAndHistoryPanel uid project />`, rendered by `ProjectsPanel` for the selected project

- [ ] **Step 1: Implement `GeneratePanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import { fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { isValidRowRange } from "../projects/projectsApi";
import { generateSegment } from "./generateApi";

interface GeneratePanelProps {
  uid: string;
  project: Project;
  onGenerated: () => Promise<void>;
}

export function GeneratePanel({ uid, project, onGenerated }: GeneratePanelProps) {
  const [stitchCount, setStitchCount] = useState<number | null>(null);
  const [colourCount, setColourCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reloadCounts() {
    const [stitches, colours] = await Promise.all([
      fetchLabeledItems(projectStitchesCollectionPath(uid, project.id)),
      fetchLabeledItems(projectColoursCollectionPath(uid, project.id)),
    ]);
    setStitchCount(stitches.length);
    setColourCount(colours.length);
  }

  useEffect(() => {
    void reloadCounts();
  }, [uid, project.id]);

  const disabledReason =
    stitchCount === null || colourCount === null
      ? "Loading…"
      : stitchCount === 0
      ? "Add at least one stitch first."
      : colourCount === 0
      ? "Add at least one colour first."
      : !isValidRowRange(project.rowMin, project.rowMax)
      ? "Fix this project's row range first."
      : null;

  async function handleClick() {
    setError(null);
    try {
      await generateSegment(uid, project);
      await reloadCounts();
      await onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabledReason !== null}
        className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Generate
      </button>
      {disabledReason && (
        <p className="mt-1 text-xs text-gray-500">{disabledReason}</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

`disabledReason` is a soft UX hint computed from a one-time fetch (per the read-pattern decision, no live listeners) — it can lag behind edits made in the Stitches/Colours editors above until this panel re-fetches. That's fine: `generateSegment` itself always re-fetches fresh lists and throws its own clear error if they're empty, so a stale "enabled" button never produces a bad write, only a caught, displayed error.

- [ ] **Step 2: Implement `HistoryList.tsx`**

```tsx
import { useEffect, useState } from "react";
import { deleteItem } from "../../lib/lists";
import { projectHistoryCollectionPath } from "../../lib/paths";
import type { HistoryEntry } from "../../types";
import { fetchHistory } from "../generate/generateApi";

interface HistoryListProps {
  uid: string;
  projectId: string;
  refreshKey: number;
}

export function HistoryList({ uid, projectId, refreshKey }: HistoryListProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  async function reload() {
    setEntries(await fetchHistory(uid, projectId));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, projectId, refreshKey]);

  async function handleDelete(entryId: string) {
    await deleteItem(projectHistoryCollectionPath(uid, projectId), entryId);
    await reload();
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-900">History</h3>
      <ul className="mt-2 space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-sm">
            <span>
              {entry.rowCount} rows of {entry.stitchLabel} in {entry.colourLabel}
              {entry.colourHex ? ` (${entry.colourHex})` : ""}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(entry.id)}
              className="text-xs text-red-600 underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Implement `GenerateAndHistoryPanel.tsx`**

```tsx
import { useState } from "react";
import type { Project } from "../../types";
import { HistoryList } from "../history/HistoryList";
import { GeneratePanel } from "./GeneratePanel";

interface GenerateAndHistoryPanelProps {
  uid: string;
  project: Project;
}

export function GenerateAndHistoryPanel({
  uid,
  project,
}: GenerateAndHistoryPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <GeneratePanel
        uid={uid}
        project={project}
        onGenerated={async () => setRefreshKey((k) => k + 1)}
      />
      <HistoryList uid={uid} projectId={project.id} refreshKey={refreshKey} />
    </div>
  );
}
```

- [ ] **Step 4: Wire into `ProjectsPanel`**

In `src/features/projects/ProjectsPanel.tsx`, import and render it inside the `{selected && (...)}` block, after the two `ItemListEditor`s:

```tsx
import { GenerateAndHistoryPanel } from "../generate/GenerateAndHistoryPanel";

// ...
<GenerateAndHistoryPanel uid={uid} project={selected} />
```

- [ ] **Step 5: Verify manually against the emulator**

With emulators and the dev server running: select a project with no stitches — confirm Generate is disabled with "Add at least one stitch first." Add a stitch and a colour — confirm Generate becomes enabled (after the panel's own fetch catches up; reselecting the project if needed). Click Generate several times — confirm new History rows appear newest-first, each independently deletable, and that deleting one doesn't affect the others.

- [ ] **Step 6: Commit**

```bash
git add src/features/generate/GeneratePanel.tsx src/features/generate/GenerateAndHistoryPanel.tsx src/features/history/HistoryList.tsx src/features/projects/ProjectsPanel.tsx
git commit -m "feat: add Generate and History UI"
```

---

### Task 4: Manual golden-path verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run the full golden path against the emulator**

With `firebase emulators:start` and `npm run dev` running:

1. Sign in with Google (via the Auth emulator's fake picker).
2. Create a project named "Test Blanket" with row range 2–5.
3. Bulk-paste 3 stitches and 3 colours (one with a hex, two without).
4. Save one stitch and one colour to the Account Library; confirm both appear under "Your library."
5. From the Library, add a different Colour to a second, newly-created project.
6. Click Generate 5 times on "Test Blanket"; confirm 5 History rows, newest first, each with a stitch label, colour label, and a row count between 2 and 5.
7. Delete one History row; confirm only that row disappears.
8. Delete "Test Blanket" entirely; confirm (via the Emulator UI's Firestore tab) that its `stitches`, `colours`, and `history` subcollections are gone too (cascade delete).

- [ ] **Step 2: Run the full edge-case pass**

1. Try to create a project with `rowMin > rowMax` — confirm the inline error and no project created.
2. Bulk-paste a duplicate stitch (same label, different case) into an existing list — confirm it's silently skipped, list count unchanged.
3. Delete the only stitch in a project with existing History — confirm Generate becomes disabled again, but the existing History entries still display their original stitch label (a snapshot, not a live reference).
4. Cancel the Google sign-in popup (or dismiss the Auth emulator's account picker) — confirm the inline "Sign-in was cancelled or blocked" message and that "Retry" works.

- [ ] **Step 3: Report results**

No commit for this task — if every check in Steps 1–2 passes, the MVP's golden path and stated edge cases (per the spec's Testing section) are confirmed working end-to-end.

---

## Self-Review Notes

- **Spec coverage:** Feature Flows' "Generate" and "History," Error Handling's Generate-disabled bullet, and the Testing section's "inclusive random row-range picker" (Task 1) and manual golden-path/edge-case bullet (Task 4). Together with the other six plans, every bullet in the spec now has a corresponding task.
- **Placeholder scan:** none — all code is complete; Task 4 is verification-only by design (matches the spec's own "manual testing" testing strategy, not a gap).
- **Type consistency:** `generateSegment(uid: string, project: Project): Promise<void>` and `fetchHistory(uid: string, projectId: string): Promise<HistoryEntry[]>` match their only call sites in `GeneratePanel`/`HistoryList`; `HistoryEntry` fields (`stitchLabel`, `colourLabel`, `colourHex`, `rowCount`, `generatedAt`) match `src/types.ts` from the scaffolding plan exactly.
