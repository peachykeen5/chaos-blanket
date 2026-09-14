import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) =>
        setState((s) => ({ ...s, user, loading: false }))
      ),
    []
  );

  async function signIn() {
    setState((s) => ({ ...s, error: null }));
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("signInWithPopup failed", err);
      setState((s) => ({
        ...s,
        error: "Sign-in was cancelled or blocked. Please try again.",
      }));
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("signOut failed", err);
    }
  }

  return { ...state, signIn, signOut };
}
