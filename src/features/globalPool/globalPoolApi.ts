import {
  type QueryConstraint,
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
import { bulkAddLabels, fetchLabeledItems } from "../../lib/lists";
import type { GlobalItemDoc } from "../../types";
import { contributeItem } from "../../lib/contribute";

export const PAGE_SIZE = 30;

export interface GlobalPoolPage {
  items: GlobalItemDoc[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function fetchGlobalPoolPage(
  globalCollectionPath: string,
  options: { prefix?: string; after?: QueryDocumentSnapshot | null } = {}
): Promise<GlobalPoolPage> {
  const constraints: QueryConstraint[] = [orderBy("label"), limit(PAGE_SIZE)];

  if (options.after) {
    constraints.push(startAfter(options.after));
  } else if (options.prefix) {
    constraints.push(startAt(options.prefix));
  }
  if (options.prefix) {
    constraints.push(endAt(options.prefix + "\uf8ff"));
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
  item: GlobalItemDoc
): Promise<void> {
  const existing = await fetchLabeledItems<{ id: string; label: string }>(
    libraryCollectionPath
  );
  await bulkAddLabels(
    libraryCollectionPath,
    item.label,
    existing.map((i) => i.label)
  );

  void contributeItem(item.label);
}
