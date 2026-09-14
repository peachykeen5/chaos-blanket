import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function contributeItem(
  kind: "stitch" | "colour",
  label: string,
  hex?: string
): Promise<void> {
  try {
    const contribute = httpsCallable(functions, "contributeToGlobal");
    await contribute({ kind, label, ...(hex ? { hex } : {}) });
  } catch (error) {
    // Best-effort and silent per spec: never blocks or surfaces to the user.
    console.error("contributeToGlobal failed (non-blocking)", error);
  }
}
