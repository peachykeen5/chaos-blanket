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
