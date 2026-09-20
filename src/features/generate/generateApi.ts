import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectHistoryCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { ColourItem, HistoryEntry, Project, StitchItem } from "../../types";
import { isValidRowRange } from "../projects/projectsApi";
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

  if (!isValidRowRange(project.rowMin, project.rowMax)) {
    throw new Error("This project's row range is invalid.");
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

export interface HistoryEntryEdits {
  stitchLabel: string;
  colourLabel: string;
  colourHex?: string;
  rowCount: number;
}

export async function updateHistoryEntry(
  uid: string,
  projectId: string,
  entryId: string,
  edits: HistoryEntryEdits
): Promise<void> {
  await updateDoc(
    doc(db, projectHistoryCollectionPath(uid, projectId), entryId),
    {
      stitchLabel: edits.stitchLabel,
      colourLabel: edits.colourLabel,
      colourHex: edits.colourHex ? edits.colourHex : deleteField(),
      rowCount: edits.rowCount,
    }
  );
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
