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
import { normalizeLabel } from "./normalize";

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

/**
 * Reconciles a collection to hold exactly the labels in `stagedText`:
 * adds labels present in `stagedText` but missing from `currentItems`,
 * deletes items in `currentItems` whose label is no longer present in
 * `stagedText` (case-insensitive). Never touches a surviving item's other
 * fields (e.g. `hex`) — it only adds or removes whole documents.
 */
export async function syncLabeledItems(
  collectionPath: string,
  stagedText: string,
  currentItems: LabeledItem[]
): Promise<{ addedLabels: string[] }> {
  const staged = parseBulkPaste(stagedText);
  const currentLabels = currentItems.map((item) => item.label);
  const toAdd = dedupeAgainstExisting(staged, currentLabels);
  const toDelete = currentItems.filter(
    (item) =>
      !staged.some((label) => normalizeLabel(label) === normalizeLabel(item.label))
  );

  await Promise.all([
    ...(toAdd.length > 0 ? [bulkAddLabels(collectionPath, toAdd.join("\n"), currentLabels)] : []),
    ...toDelete.map((item) => deleteItem(collectionPath, item.id)),
  ]);

  return { addedLabels: toAdd };
}

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
