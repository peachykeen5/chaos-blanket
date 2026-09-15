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
