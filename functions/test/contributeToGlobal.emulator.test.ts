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
});
