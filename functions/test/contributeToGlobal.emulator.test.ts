import { initializeApp as initializeClientApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import {
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-chaos-blanket";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

beforeAll(() => {
  if (!getAdminApps().length) initializeAdminApp({ projectId: PROJECT_ID });
});

let clientCount = 0;
function makeClient() {
  const app = initializeClientApp(
    { apiKey: "fake-api-key", projectId: PROJECT_ID },
    `client-${clientCount++}`
  );
  const auth = getAuth(app);
  const functions = getFunctions(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return { auth, functions };
}

describe("contributeToGlobal", () => {
  it("creates a new global stitch on first contribution", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    const result = await contribute({ kind: "stitch", label: "Double Crochet" });
    expect((result.data as { key: string }).key).toBe("double-crochet");

    const snapshot = await getAdminFirestore()
      .doc("globalStitches/double-crochet")
      .get();
    expect(snapshot.data()).toMatchObject({
      label: "Double Crochet",
      contributorCount: 1,
    });
  });

  it("increments contributorCount instead of duplicating on a repeat key, keeping the first label", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await contribute({ kind: "colour", label: "Coral", hex: "#FF7F50" });
    await contribute({ kind: "colour", label: "Coral (again)", hex: "#FF7F50" });

    const snapshot = await getAdminFirestore().doc("globalColours/ff7f50").get();
    expect(snapshot.data()?.contributorCount).toBe(2);
    expect(snapshot.data()?.label).toBe("Coral");
  });

  it("rejects a label over 60 characters", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "x".repeat(61) })
    ).rejects.toThrow();
  });

  it("rejects a denylisted label", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "visit http://spam.example" })
    ).rejects.toThrow();
  });

  it("rejects an unauthenticated call", async () => {
    const { functions } = makeClient();
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "Anonymous Attempt" })
    ).rejects.toThrow();
  });

  it("rate-limits after 20 contributions in the same calendar day", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    for (let i = 0; i < 20; i++) {
      await contribute({ kind: "stitch", label: `Rate Limit Stitch ${i}` });
    }

    await expect(
      contribute({ kind: "stitch", label: "One too many" })
    ).rejects.toThrow();
  }, 30000);

  it("rejects a colour contribution with an invalid hex and creates no document", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "colour", label: "Not A Colour", hex: "not-a-colour" })
    ).rejects.toThrow();

    const snapshot = await getAdminFirestore().doc("globalColours/not-a-colour").get();
    expect(snapshot.exists).toBe(false);
  });

  it("normalizes hex without a leading # and mixed case to canonical #rrggbb", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await contribute({ kind: "colour", label: "AB Colour", hex: "AB12CD" });

    const snapshot = await getAdminFirestore().doc("globalColours/ab12cd").get();
    expect(snapshot.data()).toMatchObject({ hex: "#ab12cd" });
  });

  it("rejects a stitch contribution that includes a hex field", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "Bad Stitch", hex: "#ff7f50" })
    ).rejects.toThrow();
  });

  it('rejects kind: "not-a-real-kind" with invalid-argument', async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "not-a-real-kind", label: "Whatever" })
    ).rejects.toThrow();
  });

  it("rejects a label that is a number instead of an internal error", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: 12345 })
    ).rejects.toThrow();
  });

  it("rejects a label that normalizes to an empty key", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    await expect(
      contribute({ kind: "stitch", label: "🧶🧶" })
    ).rejects.toThrow();
  });

  it("strips a newline from a label before storing it", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    const result = await contribute({
      kind: "stitch",
      label: "Alpha\nBravo",
    });
    const key = (result.data as { key: string }).key;

    const snapshot = await getAdminFirestore().doc(`globalStitches/${key}`).get();
    expect(snapshot.data()?.label).not.toContain("\n");
  });

  it("does not increment the caller's rate-limit count on an invalid-argument rejection", async () => {
    const { auth, functions } = makeClient();
    await signInAnonymously(auth);
    const contribute = httpsCallable(functions, "contributeToGlobal");

    const rateLimitRef = getAdminFirestore().doc(
      `users/${auth.currentUser!.uid}/meta/rateLimit`
    );
    const before = await rateLimitRef.get();
    const countBefore = before.exists ? before.data()?.count : undefined;

    await expect(
      contribute({ kind: "colour", label: "Bad Hex Colour", hex: "not-a-colour" })
    ).rejects.toThrow();

    const after = await rateLimitRef.get();
    if (countBefore === undefined) {
      expect(after.exists).toBe(false);
    } else {
      expect(after.data()?.count).toBe(countBefore);
    }
  });
});
