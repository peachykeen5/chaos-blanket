import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "chaos-blanket-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("users/{uid}/** isolation", () => {
  it("lets a signed-in user read and write their own project doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p1"), { name: "Blanket 1" })
    );
    await assertSucceeds(getDoc(doc(aliceDb, "users/alice/projects/p1")));
  });

  it("lets a signed-in user read and write nested subcollections of their own project", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p1/stitches/s1"), {
        label: "double crochet",
      })
    );
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p1/history/h1"), {
        stitchLabel: "double crochet",
        colourLabel: "Coral",
        rowCount: 5,
      })
    );
  });

  it("blocks a signed-in user from reading another user's project doc", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/bob/projects/p1"), {
        name: "Bob's blanket",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(aliceDb, "users/bob/projects/p1")));
  });

  it("blocks a signed-in user from writing to another user's stitch library", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/bob/stitchLibrary/s1"), { label: "moss stitch" })
    );
  });

  it("blocks an unauthenticated client from reading or writing any users/** doc", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "users/alice/projects/p1")));
    await assertFails(
      setDoc(doc(anonDb, "users/alice/projects/p1"), { name: "hijacked" })
    );
  });
});
