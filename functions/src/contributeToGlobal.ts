import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { computeGlobalKey } from "./normalize";
import { isDenylisted, isValidLabel, sanitizeLabel } from "./validation";

if (!getApps().length) initializeApp();

const DAILY_LIMIT = 20;

interface ContributeInput {
  kind: "stitch" | "colour";
  label: string;
  hex?: string;
}

export const contributeToGlobal = onCall<ContributeInput>(
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const label = sanitizeLabel(request.data.label ?? "");
    const { kind, hex } = request.data;

    if (!isValidLabel(label)) {
      throw new HttpsError(
        "invalid-argument",
        "Label must be 1-60 characters."
      );
    }
    if (isDenylisted(label)) {
      throw new HttpsError("invalid-argument", "Label not allowed.");
    }

    const db = getFirestore();
    await enforceRateLimit(db, request.auth.uid);

    const collectionName = kind === "stitch" ? "globalStitches" : "globalColours";
    const key = computeGlobalKey(label, hex);
    const ref = db.collection(collectionName).doc(key);

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists) {
        tx.update(ref, { contributorCount: FieldValue.increment(1) });
      } else {
        tx.set(ref, {
          label,
          ...(hex ? { hex } : {}),
          createdAt: FieldValue.serverTimestamp(),
          contributorCount: 1,
        });
      }
    });

    return { key };
  }
);

async function enforceRateLimit(
  db: FirebaseFirestore.Firestore,
  uid: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // UTC calendar day
  const ref = db.doc(`users/${uid}/meta/rateLimit`);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();

    if (!snapshot.exists || data?.date !== today) {
      tx.set(ref, { date: today, count: 1 });
      return;
    }
    if (data.count >= DAILY_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "Daily contribution limit reached."
      );
    }
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}
