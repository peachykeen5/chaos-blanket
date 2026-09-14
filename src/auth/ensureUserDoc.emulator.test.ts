import { signInAnonymously, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { afterEach, describe, expect, it } from "vitest";
import { auth, db } from "../lib/firebase";
import { userDocPath } from "../lib/paths";
import { ensureUserDoc } from "./ensureUserDoc";

// Anonymous sign-in stands in for a real Google sign-in here — it gives us
// a real, emulator-issued auth session (so Security Rules see a genuine
// request.auth.uid) without driving an actual Google OAuth popup.
afterEach(async () => {
  await signOut(auth);
});

describe("ensureUserDoc", () => {
  it("creates users/{uid} the first time it's called for a uid", async () => {
    const { user } = await signInAnonymously(auth);

    await ensureUserDoc(user);

    const snapshot = await getDoc(doc(db, userDocPath(user.uid)));
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()?.email).toBe(user.email ?? "");
    expect(snapshot.data()?.displayName).toBe(user.displayName ?? "");
    expect(snapshot.data()?.createdAt).toBeTruthy();
  });

  it("does not overwrite an existing users/{uid} doc on a second call", async () => {
    const { user } = await signInAnonymously(auth);

    await ensureUserDoc(user);
    const first = await getDoc(doc(db, userDocPath(user.uid)));
    const firstCreatedAt = first.data()?.createdAt;
    expect(firstCreatedAt).toBeTruthy();

    await ensureUserDoc(user);
    const second = await getDoc(doc(db, userDocPath(user.uid)));

    expect(second.data()?.createdAt).toEqual(firstCreatedAt);
  });
});
