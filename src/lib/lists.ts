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
  const segments = collectionPath.split("/");
  const coll = collection(db, ...segments) as any;
  const snapshot = await getDocs(coll);
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
  const segments = collectionPath.split("/");
  const coll = collection(db, ...segments) as any;
  await Promise.all(toAdd.map((label) => addDoc(coll, { label })));
  return toAdd.length;
}

export async function deleteItem(
  collectionPath: string,
  itemId: string
): Promise<void> {
  const segments = collectionPath.split("/");
  const docRef = doc(db, ...segments, itemId) as any;
  await deleteDoc(docRef);
}

export async function updateColourHex(
  collectionPath: string,
  itemId: string,
  hex: string
): Promise<void> {
  const segments = collectionPath.split("/");
  const docRef = doc(db, ...segments, itemId) as any;
  await updateDoc(docRef, { hex });
}
