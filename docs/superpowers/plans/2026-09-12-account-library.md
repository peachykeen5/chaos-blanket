# Chaos Blanket — Account Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Account Library screen (bulk-add, delete, hex-edit — reusing the existing Project List UI as-is), plus the two cross-collection copy flows: "save a Project List item to the Account Library" (firing a background Global Pool contribution) and "add an Account Library item to a Project."

**Architecture:** The Account Library is structurally identical to a Project List (a labeled-item subcollection with optional hex on Colours), so it reuses `ItemListEditor` from the Projects & Lists plan unchanged for display/bulk-add/delete/hex-edit. The two copy flows are small components rendered via a new optional `renderExtraAction` slot on `ItemListEditor`: `SaveToLibraryButton` (Project List → Account Library, then `contributeItem`) and `AddToProjectPicker` (Account Library → a chosen Project List). Both funnel through a new shared `addLabeledItemWithHex` helper in `lib/lists.ts` so the hex on a Colour survives the copy, not just the label.

**Tech Stack:** Firestore (client SDK), React.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md), section "Feature Flows" (Save a project item to account library, Add library item to a project).

**Depends on:** [2026-09-12-projects-and-lists.md](./2026-09-12-projects-and-lists.md) (`ItemListEditor`, `lib/lists.ts`, `projectsApi.ts`) and [2026-09-12-global-pool.md](./2026-09-12-global-pool.md) (`lib/contribute.ts`'s `contributeItem`). **Build this plan after both.**

## Global Constraints

- Database: Firestore, direct client writes for Account Library (no function in the path).
- Copying an item between a Project List, the Account Library, and the Global Pool always duplicates it into a new document — never a shared reference.
- Adds are deduped case-insensitively against the whole target list (not just a batch), silently skipping duplicates.
- "Save to library" fires `contributeItem` in the background — non-blocking, silent on failure.
- No caps on Account Library size.
- No automated e2e suite for this MVP — this plan's UI wiring is verified manually; the one new piece of copy logic (`addLabeledItemWithHex`) gets an emulator test.

---

## File Structure

```
chaos-blanket/
├── src/
│   ├── App.tsx                                        (modified: renders LibraryPanel)
│   ├── lib/
│   │   ├── lists.ts                                    (modified: adds addLabeledItemWithHex)
│   │   └── lists.emulator.test.ts                      (modified: tests addLabeledItemWithHex)
│   └── features/
│       ├── projects/
│       │   ├── ItemListEditor.tsx                      (modified: adds renderExtraAction slot)
│       │   ├── ProjectsPanel.tsx                        (modified: passes SaveToLibraryButton)
│       │   └── SaveToLibraryButton.tsx
│       └── library/
│           ├── AddToProjectPicker.tsx
│           └── LibraryPanel.tsx
```

---

### Task 1: `addLabeledItemWithHex` — copy one item, hex included

**Files:**
- Modify: `src/lib/lists.ts`, `src/lib/lists.emulator.test.ts`

**Interfaces:**
- Consumes: `bulkAddLabels`, `fetchLabeledItems`, `updateColourHex` (all already in `lib/lists.ts`), `normalizeLabel`
- Produces: `addLabeledItemWithHex(collectionPath, item: { label: string; hex?: string }, existingLabels: string[]): Promise<void>` — used by both `SaveToLibraryButton` and `AddToProjectPicker` (this plan)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/lists.emulator.test.ts`:

```ts
import { addLabeledItemWithHex } from "./lists";

// ...inside the existing `describe("lists", ...)` block, add:
it("addLabeledItemWithHex copies the hex along with the label, and skips a duplicate", async () => {
  const { user } = await signInAnonymously(auth);
  const collectionPath = `users/${user.uid}/projects/p1/colours`;

  await addLabeledItemWithHex(
    collectionPath,
    { label: "Coral", hex: "#FF7F50" },
    []
  );
  let items = await fetchLabeledItems<Item>(collectionPath);
  expect(items).toEqual([
    expect.objectContaining({ label: "Coral", hex: "#FF7F50" }),
  ]);

  await addLabeledItemWithHex(
    collectionPath,
    { label: "coral", hex: "#000000" },
    items.map((i) => i.label)
  );
  items = await fetchLabeledItems<Item>(collectionPath);
  expect(items).toHaveLength(1); // duplicate skipped, original hex untouched
  expect(items[0].hex).toBe("#FF7F50");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:emulator`
Expected: FAIL — `addLabeledItemWithHex` doesn't exist.

- [ ] **Step 3: Implement**

Append to `src/lib/lists.ts`:

```ts
export async function addLabeledItemWithHex(
  collectionPath: string,
  item: { label: string; hex?: string },
  existingLabels: string[]
): Promise<void> {
  const added = await bulkAddLabels(collectionPath, item.label, existingLabels);
  if (added > 0 && item.hex) {
    const refreshed = await fetchLabeledItems<LabeledItem & { hex?: string }>(
      collectionPath
    );
    const created = refreshed.find(
      (i) => normalizeLabel(i.label) === normalizeLabel(item.label)
    );
    if (created) await updateColourHex(collectionPath, created.id, item.hex);
  }
}
```

(`normalizeLabel` is already imported indirectly via `bulkPaste.ts` — add a direct `import { normalizeLabel } from "./normalize";` at the top of `lists.ts`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:emulator`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lists.ts src/lib/lists.emulator.test.ts
git commit -m "feat: add addLabeledItemWithHex for cross-list item copies"
```

---

### Task 2: `ItemListEditor` extra-action slot

**Files:**
- Modify: `src/features/projects/ItemListEditor.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: an optional `renderExtraAction?: (item: Item, reload: () => Promise<void>) => React.ReactNode` prop — backward compatible, existing `ProjectsPanel` call sites from the Projects & Lists plan keep working unchanged since the prop is optional

- [ ] **Step 1: Add the prop and render slot**

In `src/features/projects/ItemListEditor.tsx`, add to the props interface:

```tsx
interface ItemListEditorProps {
  title: string;
  collectionPath: string;
  supportsHex: boolean;
  renderExtraAction?: (item: Item, reload: () => Promise<void>) => React.ReactNode;
}
```

Update the function signature to destructure it: `{ title, collectionPath, supportsHex, renderExtraAction }`.

In the `<li>` for each item, after the existing "Delete" button, add:

```tsx
{renderExtraAction?.(item, reload)}
```

- [ ] **Step 2: Verify existing usage still typechecks**

Run: `npm run typecheck`
Expected: no errors — `ProjectsPanel`'s two existing `<ItemListEditor>` calls (Projects & Lists plan) don't pass `renderExtraAction`, which is fine since it's optional.

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/ItemListEditor.tsx
git commit -m "feat: add optional per-item extra-action slot to ItemListEditor"
```

---

### Task 3: Save a Project List item to the Account Library

**Files:**
- Create: `src/features/projects/SaveToLibraryButton.tsx`
- Modify: `src/features/projects/ProjectsPanel.tsx`

**Interfaces:**
- Consumes: `addLabeledItemWithHex`, `fetchLabeledItems` (Task 1), `contributeItem` (Global Pool plan), `stitchLibraryCollectionPath`/`colourLibraryCollectionPath` (scaffolding plan)
- Produces: `<SaveToLibraryButton uid kind item onDone />`, passed into `ItemListEditor`'s `renderExtraAction` from `ProjectsPanel`

- [ ] **Step 1: Implement `SaveToLibraryButton.tsx`**

```tsx
import { addLabeledItemWithHex, fetchLabeledItems } from "../../lib/lists";
import { contributeItem } from "../../lib/contribute";
import {
  colourLibraryCollectionPath,
  stitchLibraryCollectionPath,
} from "../../lib/paths";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface SaveToLibraryButtonProps {
  uid: string;
  kind: "stitch" | "colour";
  item: Item;
  onDone: () => Promise<void>;
}

export function SaveToLibraryButton({
  uid,
  kind,
  item,
  onDone,
}: SaveToLibraryButtonProps) {
  const libraryPath =
    kind === "stitch"
      ? stitchLibraryCollectionPath(uid)
      : colourLibraryCollectionPath(uid);

  async function handleClick() {
    const existing = await fetchLabeledItems<Item>(libraryPath);
    await addLabeledItemWithHex(
      libraryPath,
      item,
      existing.map((i) => i.label)
    );
    void contributeItem(kind, item.label, item.hex);
    await onDone();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-green-700 underline"
    >
      Save to library
    </button>
  );
}
```

- [ ] **Step 2: Wire it into `ProjectsPanel`'s two `ItemListEditor`s**

In `src/features/projects/ProjectsPanel.tsx`:

```tsx
import { SaveToLibraryButton } from "./SaveToLibraryButton";

// ...
<ItemListEditor
  title="Stitches"
  collectionPath={projectStitchesCollectionPath(uid, selected.id)}
  supportsHex={false}
  renderExtraAction={(item, reload) => (
    <SaveToLibraryButton uid={uid} kind="stitch" item={item} onDone={reload} />
  )}
/>
<ItemListEditor
  title="Colours"
  collectionPath={projectColoursCollectionPath(uid, selected.id)}
  supportsHex
  renderExtraAction={(item, reload) => (
    <SaveToLibraryButton uid={uid} kind="colour" item={item} onDone={reload} />
  )}
/>
```

- [ ] **Step 3: Verify manually against the emulator**

With emulators and the dev server running, sign in, create a project, add a stitch, click "Save to library." Open the Emulator UI's Firestore tab — confirm `users/{uid}/stitchLibrary` now has that item, and (since no Global Pool entry exists yet for it) `globalStitches` gained a new doc via the background `contributeToGlobal` call.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/SaveToLibraryButton.tsx src/features/projects/ProjectsPanel.tsx
git commit -m "feat: add save-project-item-to-library flow"
```

---

### Task 4: Account Library screen and "add to project"

**Files:**
- Create: `src/features/library/AddToProjectPicker.tsx`, `src/features/library/LibraryPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ItemListEditor` (Projects & Lists plan, now with `renderExtraAction`), `listProjects` (Projects & Lists plan), `addLabeledItemWithHex`/`fetchLabeledItems` (Task 1), `stitchLibraryCollectionPath`/`colourLibraryCollectionPath`/`projectStitchesCollectionPath`/`projectColoursCollectionPath` (scaffolding plan)
- Produces: `<LibraryPanel uid />`, rendered in `App.tsx`

- [ ] **Step 1: Implement `AddToProjectPicker.tsx`**

```tsx
import { useEffect, useState } from "react";
import { addLabeledItemWithHex, fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { listProjects } from "../projects/projectsApi";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface AddToProjectPickerProps {
  uid: string;
  kind: "stitch" | "colour";
  item: Item;
  onDone: () => Promise<void>;
}

export function AddToProjectPicker({
  uid,
  kind,
  item,
  onDone,
}: AddToProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    void listProjects(uid).then(setProjects);
  }, [uid]);

  async function handleAdd() {
    if (!selectedProjectId) return;
    const collectionPath =
      kind === "stitch"
        ? projectStitchesCollectionPath(uid, selectedProjectId)
        : projectColoursCollectionPath(uid, selectedProjectId);
    const existing = await fetchLabeledItems<Item>(collectionPath);
    await addLabeledItemWithHex(
      collectionPath,
      item,
      existing.map((i) => i.label)
    );
    await onDone();
  }

  return (
    <span className="flex items-center gap-1 text-xs">
      <select
        value={selectedProjectId}
        onChange={(e) => setSelectedProjectId(e.target.value)}
        className="rounded border border-gray-300 text-xs"
      >
        <option value="">Add to project…</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        className="text-blue-600 underline"
      >
        Add
      </button>
    </span>
  );
}
```

- [ ] **Step 2: Implement `LibraryPanel.tsx`**

```tsx
import {
  colourLibraryCollectionPath,
  stitchLibraryCollectionPath,
} from "../../lib/paths";
import { ItemListEditor } from "../projects/ItemListEditor";
import { AddToProjectPicker } from "./AddToProjectPicker";

interface LibraryPanelProps {
  uid: string;
}

export function LibraryPanel({ uid }: LibraryPanelProps) {
  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h2 className="font-semibold text-gray-900">Your library</h2>
      <ItemListEditor
        title="Stitches"
        collectionPath={stitchLibraryCollectionPath(uid)}
        supportsHex={false}
        renderExtraAction={(item, reload) => (
          <AddToProjectPicker uid={uid} kind="stitch" item={item} onDone={reload} />
        )}
      />
      <ItemListEditor
        title="Colours"
        collectionPath={colourLibraryCollectionPath(uid)}
        supportsHex
        renderExtraAction={(item, reload) => (
          <AddToProjectPicker uid={uid} kind="colour" item={item} onDone={reload} />
        )}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```tsx
import { LibraryPanel } from "./features/library/LibraryPanel";

// ...inside the signed-in return block, after <ProjectsPanel uid={user.uid} />:
<LibraryPanel uid={user.uid} />
```

- [ ] **Step 4: Verify manually against the emulator**

With emulators and the dev server running: bulk-add a colour directly into the Library panel, set its hex. Create two projects. Use "Add to project," pick one, confirm the colour (with its hex) appears in that project's Colours list. Confirm picking the same project again for the same colour is silently skipped (list stays at one entry).

- [ ] **Step 5: Commit**

```bash
git add src/features/library/AddToProjectPicker.tsx src/features/library/LibraryPanel.tsx src/App.tsx
git commit -m "feat: add Account Library screen and add-to-project flow"
```

---

## Self-Review Notes

- **Spec coverage:** both Feature Flows bullets ("Save a project item to account library," "Add library item to a project") and the Data Model's `stitchLibrary`/`colourLibrary` collections.
- **Placeholder scan:** none — every step has complete code or a concrete manual-verification script.
- **Type consistency:** `Item { id, label, hex? }` is used identically across `SaveToLibraryButton`, `AddToProjectPicker`, and `ItemListEditor`'s `renderExtraAction` signature; `kind: "stitch" | "colour"` matches the same union used throughout the Global Pool plan.
