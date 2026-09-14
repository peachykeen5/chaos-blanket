import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";

if (!getApps().length) initializeApp();

const SUBCOLLECTIONS = ["stitches", "colours", "history"] as const;

export const cascadeDeleteProject = onDocumentDeleted(
  "users/{uid}/projects/{projectId}",
  async (event) => {
    const db = getFirestore();
    const { uid, projectId } = event.params;

    for (const subcollection of SUBCOLLECTIONS) {
      const snapshot = await db
        .collection(`users/${uid}/projects/${projectId}/${subcollection}`)
        .get();
      const batch = db.batch();
      snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
      await batch.commit();
    }
  }
);
