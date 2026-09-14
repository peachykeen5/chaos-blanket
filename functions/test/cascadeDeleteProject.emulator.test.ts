import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: "demo-chaos-blanket" });
});

describe("cascadeDeleteProject", () => {
  it("deletes stitches, colours, and history when the project doc is deleted", async () => {
    const db = getFirestore();
    const uid = "test-uid";
    const projectId = "test-project";
    const projectRef = db.doc(`users/${uid}/projects/${projectId}`);

    await projectRef.set({ name: "Test" });
    await projectRef.collection("stitches").doc("s1").set({ label: "dc" });
    await projectRef.collection("colours").doc("c1").set({ label: "Red" });
    await projectRef.collection("history").doc("h1").set({
      stitchLabel: "dc",
      colourLabel: "Red",
      rowCount: 5,
    });

    await projectRef.delete();

    // The trigger runs asynchronously — poll briefly.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const [stitch, colour, history] = await Promise.all([
      projectRef.collection("stitches").doc("s1").get(),
      projectRef.collection("colours").doc("c1").get(),
      projectRef.collection("history").doc("h1").get(),
    ]);

    expect(stitch.exists).toBe(false);
    expect(colour.exists).toBe(false);
    expect(history.exists).toBe(false);
  }, 15000);
});
