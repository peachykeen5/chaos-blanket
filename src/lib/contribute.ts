import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function contributeItem(label: string): Promise<void> {
  try {
    const contribute = httpsCallable(functions, "contributeToGlobal");
    await contribute({ label });
  } catch (error) {
    // Best-effort and silent per spec: never blocks or surfaces to the user.
    console.error("contributeToGlobal failed (non-blocking)", error);
  }
}
