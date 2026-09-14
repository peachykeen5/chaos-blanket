import type { User } from "firebase/auth";
import {
  type WithFieldValue,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { userDocPath } from "../lib/paths";
import type { UserDoc } from "../types";

export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, userDocPath(user.uid));
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  const newUser: WithFieldValue<UserDoc> = {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, newUser);
}
