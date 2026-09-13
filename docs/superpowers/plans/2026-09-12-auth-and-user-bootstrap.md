# Chaos Blanket — Auth & User Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google sign-in/sign-out wired into the app shell, with inline retry on popup errors, and a lazy get-or-create `users/{uid}` document created on first sign-in.

**Architecture:** A `useAuth` hook wraps `onAuthStateChanged`/`signInWithPopup`/`signOut` and exposes `{ user, loading, error, signIn, signOut }`. `ensureUserDoc(user)` is a small Firestore get-or-create called once whenever `useAuth` reports a signed-in user, per the CONTEXT.md decision that user-doc bootstrap is client-side and lazy rather than an Auth-triggered Cloud Function. `App.tsx` renders a sign-in screen when signed out and the (still mostly empty) authenticated shell when signed in.

**Tech Stack:** Firebase Auth (Google provider), Firestore, React hooks.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md), sections "Architecture" (Auth) and "Error Handling" (auth errors).

**Depends on:** [2026-09-12-scaffolding-and-setup.md](./2026-09-12-scaffolding-and-setup.md) (`src/lib/firebase.ts`, `src/lib/paths.ts`, `src/types.ts`) and [2026-09-12-security-rules.md](./2026-09-12-security-rules.md) (owner-only `users/{uid}/**` rule, needed for `ensureUserDoc`'s write to succeed).

## Global Constraints

- Auth: Firebase Auth, Google sign-in provider only — no other providers.
- Database: Firestore. All personal data lives under `users/{uid}/...`, protected by Security Rules.
- Auth errors (popup blocked/cancelled): inline message with retry.
- All Firestore timestamp fields use `serverTimestamp()`, never client-side `Date`.
- No automated e2e suite for this MVP — the sign-in flow itself (a real Google OAuth popup) is verified manually against the Auth emulator's fake account picker; only the Firestore-side `ensureUserDoc` logic gets an automated (emulator-backed) test.

---

## File Structure

```
chaos-blanket/
├── vitest.emulator.config.ts    (new: config for *.emulator.test.ts files)
├── package.json                  (modified: adds test:emulator script)
└── src/
    ├── App.tsx                   (modified: sign-in gate)
    └── auth/
        ├── useAuth.ts
        ├── ensureUserDoc.ts
        ├── ensureUserDoc.emulator.test.ts
        └── SignIn.tsx
```

---

### Task 1: `useAuth` hook — sign in, sign out, inline error on popup failure

**Files:**
- Create: `src/auth/useAuth.ts`, `src/auth/SignIn.tsx`

**Interfaces:**
- Consumes: `auth` from `src/lib/firebase.ts`
- Produces: `useAuth(): { user: User | null; loading: boolean; error: string | null; signIn: () => Promise<void>; signOut: () => Promise<void> }` — the only way any component reads or changes auth state

- [ ] **Step 1: Write `useAuth`**

```ts
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
    } catch {
      setState((s) => ({
        ...s,
        error: "Sign-in was cancelled or blocked. Please try again.",
      }));
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return { ...state, signIn, signOut };
}
```

- [ ] **Step 2: Write the `SignIn` screen**

```tsx
import { useAuth } from "./useAuth";

export function SignIn() {
  const { error, signIn } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
      <button
        type="button"
        onClick={signIn}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Sign in with Google
      </button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}{" "}
          <button type="button" onClick={signIn} className="underline">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify manually against the Auth emulator**

Run `firebase emulators:start` and `npm run dev`. Temporarily render `<SignIn />` from `App.tsx` (Task 3 wires this permanently). Click "Sign in with Google" — the Auth emulator intercepts this with its own fake account picker (no real Google account needed). Confirm: picking a fake account succeeds with no error shown; canceling the picker shows the inline error with a working "Retry" link.

- [ ] **Step 4: Commit**

```bash
git add src/auth/useAuth.ts src/auth/SignIn.tsx
git commit -m "feat: add Google sign-in with inline retry on popup failure"
```

---

### Task 2: `ensureUserDoc` — lazy get-or-create on first sign-in

**Files:**
- Create: `src/auth/ensureUserDoc.ts`, `src/auth/ensureUserDoc.emulator.test.ts`, `vitest.emulator.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `db` from `src/lib/firebase.ts`, `userDocPath` from `src/lib/paths.ts`, `UserDoc` from `src/types.ts`
- Produces: `ensureUserDoc(user: User): Promise<void>` — called once per sign-in by `App.tsx` in Task 3

- [ ] **Step 1: Add the emulator test config and script**

`vitest.emulator.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.emulator.test.ts"],
  },
});
```

`package.json`, in `"scripts"`:

```json
"test:emulator": "firebase emulators:exec --only auth,firestore \"vitest run --config vitest.emulator.config.ts\""
```

- [ ] **Step 2: Write the failing test**

`src/auth/ensureUserDoc.emulator.test.ts`:

```ts
import { signInAnonymously, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { afterEach, describe, expect, it } from "vitest";
import { auth, db } from "../lib/firebase";
import { userDocPath } from "../lib/paths";
import { ensureUserDoc } from "./ensureUserDoc";

// Anonymous sign-in stands in for a real Google sign-in here — it gives us
// a real, emulator-issued auth session (so Security Rules see a genuine
// request.auth.uid) without driving an actual Google OAuth popup.
afterEach(async () => {
  await signOut(auth);
});

describe("ensureUserDoc", () => {
  it("creates users/{uid} the first time it's called for a uid", async () => {
    const { user } = await signInAnonymously(auth);

    await ensureUserDoc(user);

    const snapshot = await getDoc(doc(db, userDocPath(user.uid)));
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()?.email).toBe(user.email ?? "");
  });

  it("does not overwrite an existing users/{uid} doc on a second call", async () => {
    const { user } = await signInAnonymously(auth);

    await ensureUserDoc(user);
    const first = await getDoc(doc(db, userDocPath(user.uid)));
    const firstCreatedAt = first.data()?.createdAt;

    await ensureUserDoc(user);
    const second = await getDoc(doc(db, userDocPath(user.uid)));

    expect(second.data()?.createdAt).toEqual(firstCreatedAt);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:emulator`
Expected: FAIL — `./ensureUserDoc` module doesn't exist.

- [ ] **Step 4: Implement `ensureUserDoc`**

```ts
import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { userDocPath } from "../lib/paths";

export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, userDocPath(user.uid));
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  await setDoc(ref, {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    createdAt: serverTimestamp(),
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:emulator`
Expected: PASS (both tests)

- [ ] **Step 6: Commit**

```bash
git add src/auth/ensureUserDoc.ts src/auth/ensureUserDoc.emulator.test.ts vitest.emulator.config.ts package.json
git commit -m "feat: lazily create users/{uid} doc on first sign-in"
```

---

### Task 3: Wire sign-in gate and user bootstrap into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 1), `ensureUserDoc` (Task 2)
- Produces: the authenticated shell later plans (Projects, Library, Global Pool, Generate, History) render inside

- [ ] **Step 1: Update `App.tsx`**

```tsx
import { useEffect } from "react";
import { ensureUserDoc } from "./auth/ensureUserDoc";
import { SignIn } from "./auth/SignIn";
import { useAuth } from "./auth/useAuth";

export function App() {
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (user) void ensureUserDoc(user);
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8">Loading…</div>;
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-gray-500 underline"
        >
          Sign out
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Signed in as {user.displayName ?? user.email}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually against the emulator**

Run `firebase emulators:start` and `npm run dev`. Sign in via the Auth emulator's fake picker — confirm the app shows "Signed in as …" and "Sign out" works, returning to the sign-in screen. Open the Emulator UI's Firestore tab — confirm a `users/{uid}` doc was created with `displayName`, `email`, `createdAt`.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: gate the app behind sign-in and bootstrap the user doc"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Auth bullet in Architecture and the auth-errors bullet in Error Handling. Project/library/pool/generate/history UI (the rest of the authenticated shell) is deliberately out of scope — covered by the later plans.
- **Placeholder scan:** none — every step has complete code or a concrete manual-verification procedure.
- **Type consistency:** `ensureUserDoc(user: User): Promise<void>` matches the only call site added in Task 3; `userDocPath` and `UserDoc` fields (`displayName`, `email`, `createdAt`) match `src/types.ts` and `src/lib/paths.ts` from the scaffolding plan.
