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
    const projectRef = db.doc(`users/${uid}/projects/${projectId}`);

    // recursiveDelete chunks its writes internally, so it has no assumption
    // about subcollection size — unlike a single manually-built WriteBatch,
    // which throws (and drops this trigger's whole event, since
    // onDocumentDeleted defaults to no retry) once a subcollection exceeds
    // Firestore's 500-write batch limit. The plan places no cap on History
    // size, so that limit is reachable in practice.
    await Promise.all(
      SUBCOLLECTIONS.map((subcollection) =>
        db.recursiveDelete(projectRef.collection(subcollection))
      )
    );
  }
);
