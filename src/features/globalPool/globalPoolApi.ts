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
  const constraints: QueryConstraint[] = [orderBy("label"), limit(PAGE_SIZE)];

  if (options.after) {
    constraints.push(startAfter(options.after));
  } else if (options.prefix) {
    constraints.push(startAt(options.prefix));
  }
  if (options.prefix) {
    constraints.push(endAt(options.prefix + ""));
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
