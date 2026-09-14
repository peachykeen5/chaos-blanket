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
