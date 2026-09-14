import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

const [emulatorHost, emulatorPort] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
).split(":");

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "chaos-blanket-rules-test",
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      host: emulatorHost,
      port: Number(emulatorPort),
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
  it("lets a signed-in user write their own top-level user doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice"), { email: "alice@example.com" })
    );
  });

  it("blocks a signed-in user from writing another user's top-level user doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/bob"), { email: "hijack@example.com" })
    );
  });

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

  it("blocks a signed-in user from deleting another user's project doc", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/bob/projects/p1"), {
        name: "Bob's blanket",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(deleteDoc(doc(aliceDb, "users/bob/projects/p1")));
  });

  it("blocks a signed-in user from listing another user's projects collection", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/bob/projects/p1"), {
        name: "Bob's blanket",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDocs(collection(aliceDb, "users/bob/projects")));
  });

  it("blocks an unauthenticated client from reading or writing any users/** doc", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "users/alice/projects/p1")));
    await assertFails(
      setDoc(doc(anonDb, "users/alice/projects/p1"), { name: "hijacked" })
    );
  });

  it("blocks a signed-in owner from writing to their own users/{uid}/meta/** doc", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/alice/meta/rateLimit"), { count: 0 })
    );
  });

  it("blocks a list query on the owner's own meta collection", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDocs(collection(aliceDb, "users/alice/meta")));
  });

  it("still lets a signed-in owner write to a normal subpath like projects", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/projects/p2"), { name: "Blanket 2" })
    );
  });

  it("allows a list query on the owner's own projects collection", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDocs(collection(aliceDb, "users/alice/projects")));
  });

  it("allows a list query on a nested project subcollection", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      getDocs(collection(aliceDb, "users/alice/projects/p1/colours"))
    );
  });
});

describe("default-deny for unmatched paths", () => {
  it("blocks a signed-in user from reading or writing an unmatched top-level path", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(aliceDb, "hackers/whatever")));
    await assertFails(
      setDoc(doc(aliceDb, "hackers/whatever"), { pwned: true })
    );
  });
});

describe("globalStitches / globalColours", () => {
  it("lets any signed-in user read a global stitch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalStitches/double-crochet"), {
        label: "Double Crochet",
        contributorCount: 1,
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "globalStitches/double-crochet")));
  });

  it("blocks an unauthenticated client from reading global collections", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalColours/ff0000"), {
        label: "Red",
        hex: "#ff0000",
        contributorCount: 1,
      });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "globalColours/ff0000")));
  });

  it("blocks a signed-in user from writing directly to a global collection", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "globalStitches/moss-stitch"), {
        label: "Moss Stitch",
        contributorCount: 1,
      })
    );
  });

  it("blocks a signed-in user from updating an existing global stitch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalStitches/single-crochet"), {
        label: "Single Crochet",
        contributorCount: 1,
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      updateDoc(doc(aliceDb, "globalStitches/single-crochet"), {
        contributorCount: 2,
      })
    );
  });

  it("blocks a signed-in user from deleting an existing global stitch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "globalStitches/treble-crochet"), {
        label: "Treble Crochet",
        contributorCount: 1,
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      deleteDoc(doc(aliceDb, "globalStitches/treble-crochet"))
    );
  });
});
