import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { computeGlobalKey } from "./normalize";
import {
  isDenylisted,
  isValidLabel,
  normalizeHex,
  sanitizeLabel,
} from "./validation";

if (!getApps().length) initializeApp();

const DAILY_LIMIT = 20;

interface ContributeInput {
  kind: "stitch" | "colour";
  label: string;
  hex?: string;
}

export const contributeToGlobal = onCall<ContributeInput>(
  // FUNCTIONS_EMULATOR is set only by the local Functions emulator process;
  // never present in a real deployment.
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const data = request.data;
    if (typeof data !== "object" || data === null) {
      throw new HttpsError("invalid-argument", "Request data is required.");
    }

    const { kind, label: rawLabel, hex: rawHex } = data;

    if (kind !== "stitch" && kind !== "colour") {
      throw new HttpsError(
        "invalid-argument",
        'kind must be "stitch" or "colour".'
      );
    }

    if (typeof rawLabel !== "string") {
      throw new HttpsError("invalid-argument", "Label must be a string.");
    }

    if (rawHex !== undefined && typeof rawHex !== "string") {
      throw new HttpsError("invalid-argument", "Hex must be a string.");
    }

    const label = sanitizeLabel(rawLabel);

    if (!isValidLabel(label)) {
      throw new HttpsError(
        "invalid-argument",
        "Label must be 1-60 characters."
      );
    }
    if (isDenylisted(label)) {
      throw new HttpsError("invalid-argument", "Label not allowed.");
    }

    let hex: string | undefined;
    if (kind === "colour") {
      if (rawHex === undefined) {
        throw new HttpsError(
          "invalid-argument",
          "Hex colour must be 6 hex digits."
        );
      }
      const normalized = normalizeHex(rawHex);
      if (!normalized) {
        throw new HttpsError(
          "invalid-argument",
          "Hex colour must be 6 hex digits."
        );
      }
      hex = normalized;
    } else if (rawHex !== undefined) {
      throw new HttpsError(
        "invalid-argument",
        "Stitch contributions must not include a hex value."
      );
    }

    const collectionName = kind === "stitch" ? "globalStitches" : "globalColours";
    const key = computeGlobalKey(label, hex);
    if (key.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Label does not contain any usable characters."
      );
    }

    const db = getFirestore();
    await enforceRateLimit(db, request.auth.uid);

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

  try {
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
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error(err);
    throw new HttpsError(
      "aborted",
      "Too many contributions at once — please try again in a moment."
    );
  }
}
