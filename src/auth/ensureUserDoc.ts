import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { userDocPath } from "../lib/paths";

export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, userDocPath(user.uid));
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  await setDoc(ref, {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    createdAt: serverTimestamp(),
  });
}
