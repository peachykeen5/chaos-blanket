import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { auth } from "../lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const navigate = useNavigate();
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
      // Always land fresh on the dashboard after signing in — never leave the
      // browser sitting on whatever route was active before this sign-in
      // (e.g. a stale project page from a previous session).
      navigate("/", { replace: true });
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
