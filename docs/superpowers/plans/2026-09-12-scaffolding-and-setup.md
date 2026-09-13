# Chaos Blanket — Scaffolding & Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working, empty Vite + React + TypeScript + Tailwind SPA wired to a Firebase project (Hosting, Firestore, Functions, emulator suite), plus the shared library modules (`types.ts`, `lib/firebase.ts`, `lib/paths.ts`) every later plan builds on.

**Architecture:** Single-page app, no router library — the app is one screen (sign in → pick/create a project → work on it), so "which project is selected" is local component state, not a URL. Firebase JS SDK (modular v10+) connects to the Emulator Suite in dev (`import.meta.env.DEV`) and real Firebase services in production. Cloud Functions live in a separate `functions/` Node package (different runtime from the Vite app).

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS, Firebase JS SDK v10+, Firebase CLI, Firebase Emulator Suite, Vitest.

**Spec:** [docs/superpowers/specs/2026-09-12-chaos-blanket-generator-design.md](../specs/2026-09-12-chaos-blanket-generator-design.md) — see also [CONTEXT.md](../../../CONTEXT.md) for domain vocabulary and [docs/adr/0001-global-pool-key-scheme.md](../../adr/0001-global-pool-key-scheme.md).

## Global Constraints

- Frontend: React + TypeScript + Vite + Tailwind CSS, deployed as a static SPA on Firebase Hosting.
- Auth: Firebase Auth, Google sign-in provider only — no other providers.
- Database: Firestore. All personal data lives under `users/{uid}/...`, protected by Security Rules so a user can only read/write their own data.
- Backend: exactly one **callable** Cloud Function, `contributeToGlobal`, is the sole write path into the global pool; every other write goes directly from the client to Firestore. A second, non-callable Firestore-trigger function handles project-delete cascade — this doesn't violate "one callable function" since it isn't callable.
- Abuse protection: Firebase App Check in front of both Firestore and the Cloud Functions.
- No `dangerouslySetInnerHTML` anywhere in the app.
- No automated e2e suite for this MVP — manual testing only for full user flows.
- Single Firebase project; local development against the Firebase Emulator Suite; deploys are manual (`firebase deploy`), no CI/CD.
- All Firestore timestamp fields (`createdAt`, `updatedAt`, `generatedAt`) use `serverTimestamp()`, never client-side `Date`.

---

## File Structure

```
chaos-blanket/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── .oxlintrc.json
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
├── .env.example
├── .env.development
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types.ts
│   └── lib/
│       ├── firebase.ts
│       └── paths.ts
└── functions/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts
```

`tsconfig.app.json` and `.oxlintrc.json` are default output of the `npm create vite@latest -- --template react-ts` scaffold that this plan didn't originally anticipate (kept — harmless). The scaffold also produces `public/icons.svg` and `src/App.css`/`src/assets/`, none of which anything in this app references — delete them in Task 1 rather than carrying dead files forward (a later full-plan review caught these still sitting in the tree unreferenced). `.env.development` is added in Task 3, alongside `.env.example`, so a fresh checkout can run without hand-editing `.env.local` first.

- `src/types.ts` — every Firestore document shape used across the app (no behavior, just interfaces).
- `src/lib/firebase.ts` — the one place `initializeApp`/`getAuth`/`getFirestore`/`getFunctions` are called; connects to emulators in dev.
- `src/lib/paths.ts` — typed functions returning Firestore collection/doc path strings, so no other file hand-writes a path string.

---

### Task 1: Scaffold the Vite React-TypeScript app

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Test: none (scaffolding; verified by running the dev server and the typechecker)

**Interfaces:**
- Consumes: nothing
- Produces: an `npm run dev` dev server, an `npm run typecheck` script, an `npm run test` (Vitest) script that later tasks add tests to

- [ ] **Step 1: Run the Vite scaffold**

```bash
npm create vite@latest . -- --template react-ts
```

When prompted about the current directory not being empty (it has `docs/`, `README.md`, `CONTEXT.md`), confirm to proceed in the current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

- [ ] **Step 3: Add a typecheck script**

Edit `package.json`, add to `"scripts"`:

```json
"typecheck": "tsc -b"
```

The Vite scaffold's root `tsconfig.json` is solution-style (references-only, `"files": []`) — plain `tsc --noEmit` silently checks zero files and always exits 0. Only `tsc -b` (build mode) follows project references and actually typechecks anything.

- [ ] **Step 4: Add Vitest**

Pinned to v2 — a later major requires a newer Node engine range than this project targets; an unpinned install can silently resolve to an incompatible version.

```bash
npm install -D vitest@^2
```

Add to `package.json` `"scripts"`:

```json
"test": "vitest run"
```

Create `vitest.config.ts` so the default `test` script only runs pure unit tests — tests that need the emulator running (Security Rules tests, and later the auth/user-bootstrap integration test) use their own `test:rules` / `test:emulator` scripts instead, following the naming convention `*.rules.test.ts` / `*.emulator.test.ts`:

```ts
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.rules.test.ts", "**/*.emulator.test.ts"],
  },
});
```

Extends Vitest's own default excludes (`**/node_modules/**`, `**/dist/**`, etc.) rather than replacing them — replacing them would let a built artifact under `dist/` get picked up as a test file.

Also add `vitest.config.ts` to `tsconfig.node.json`'s `include` array alongside `vite.config.ts`, so it's covered by `npm run typecheck`.

- [ ] **Step 5: Verify the app boots and typechecks**

Run: `npm run dev` — confirm the Vite default page loads at the printed localhost URL, then stop the server (Ctrl+C).
Run: `npm run typecheck` — expect no errors.

- [ ] **Step 6: Replace the default App with a placeholder**

Replace the contents of `src/App.tsx`:

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
    </div>
  );
}
```

Replace `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html src/main.tsx src/App.tsx src/index.css .gitignore
git commit -m "chore: scaffold Vite React TypeScript app"
```

---

### Task 2: Configure Tailwind CSS

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind utility classes usable in any `.tsx` file from here on

- [ ] **Step 1: Install Tailwind v3**

This plan's config below (a `tailwind.config.ts` with `content`/`theme`/`plugins`, and `@tailwind` directives in CSS) is Tailwind v3 syntax. Pin to v3 explicitly — an unpinned install resolves to v4, which uses a different, CSS-first configuration model and will silently produce a build where none of the app's utility classes are generated.

```bash
npm install -D tailwindcss@^3 postcss@^8 autoprefixer@^10
npx tailwindcss init -p --ts
```

- [ ] **Step 2: Configure content paths**

`tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Add Tailwind directives**

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Verify Tailwind classes apply**

Run: `npm run dev`, open the app, confirm the `<h1>` from Task 1 renders bold and dark gray (i.e. Tailwind classes are taking effect, not just literal class-name text). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tailwind.config.ts postcss.config.js src/index.css
git commit -m "chore: configure Tailwind CSS"
```

---

### Task 3: Initialize the Firebase project structure

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`, `.env.example`, `.env.development`

**Interfaces:**
- Consumes: nothing
- Produces: `firebase emulators:start` running Auth, Firestore, and Functions emulators; a `functions/` package that later plans add real functions to; `.env.example`/`.env.development` documenting (and, for `.env.development`, providing working dummy values for) the Vite env vars `src/lib/firebase.ts` (Task 6) will read

- [ ] **Step 1: Create a Firebase project**

Run `! firebase login` if not already logged in, then create a project (or use an existing empty one) at https://console.firebase.google.com — note its Project ID.

- [ ] **Step 2: Initialize Firebase in this repo**

```bash
firebase init firestore functions hosting emulators
```

When prompted:
- Use an existing project — the one from Step 1.
- Firestore rules file: `firestore.rules` (accept default).
- Firestore indexes file: `firestore.indexes.json` (accept default).
- Functions language: TypeScript.
- Functions: use ESLint — no (keep it simple for MVP).
- Functions: install dependencies now — yes.
- Hosting public directory: `dist` (Vite's build output).
- Configure as single-page app: yes.
- Set up automatic builds/deploys with GitHub: no (Global Constraint: manual deploys only).
- Emulators: Authentication, Firestore, Functions, Hosting.
- Emulator ports: accept defaults, except Hosting — use `5050`, not the default `5000` (conflicts with macOS AirPlay/ControlCenter, which claims port `5000`).
- Download emulator UI: yes.

- [ ] **Step 3: Write a starter `firestore.rules`**

`firestore.rules` (deny-all default; Plan 2 — Security Rules fills this in properly):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Replace the generated `functions/src/index.ts` stub**

```ts
// Cloud Functions are added in later plans (contributeToGlobal, cascadeDeleteProject).
export {};
```

- [ ] **Step 5: Document required environment variables**

`.env.example`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APP_CHECK_SITE_KEY=
```

Copy it to `.env.local` (already git-ignored by the Vite scaffold) and fill in the real values from the Firebase console's project settings (App Check site key comes from registering a reCAPTCHA v3 site in the App Check section — used in Task 6).

Also create `.env.development` with the same keys but dummy, non-empty, emulator-safe values (this file is NOT git-ignored — Vite loads it automatically in dev mode, so a fresh checkout with no `.env.local` yet can still run against the emulators without crashing on an empty API key):

```
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=chaos-blanket.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chaos-blanket
VITE_FIREBASE_STORAGE_BUCKET=chaos-blanket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
VITE_FIREBASE_APP_CHECK_SITE_KEY=demo-app-check-site-key
```

`VITE_FIREBASE_PROJECT_ID` must match `.firebaserc`'s project ID, since `firebase.json`'s `singleProjectMode: true` requires it.

- [ ] **Step 6: Verify the emulator suite starts**

Run: `firebase emulators:start`
Expected: Auth, Firestore, and Functions emulators start without error; the Emulator UI is reachable at the printed localhost URL. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add firebase.json .firebaserc firestore.rules firestore.indexes.json functions/package.json functions/package-lock.json functions/tsconfig.json functions/src/index.ts .env.example .env.development .gitignore
git commit -m "chore: initialize Firebase project (Firestore, Functions, Hosting, emulators)"
```

---

### Task 4: Shared Firestore types

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Project`, `StitchItem`, `ColourItem`, `HistoryEntry`, `UserDoc`, `GlobalItemDoc` types imported by every later plan

- [ ] **Step 1: Write `src/types.ts`**

```ts
import type { Timestamp } from "firebase/firestore";

export interface UserDoc {
  displayName: string;
  email: string;
  createdAt: Timestamp | null;
}

export interface Project {
  id: string;
  name: string;
  rowMin: number;
  rowMax: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** A Stitch or Colour Item as stored in a Project List or the Account Library. */
export interface StitchItem {
  id: string;
  label: string;
}

export interface ColourItem {
  id: string;
  label: string;
  hex?: string;
}

/** The persisted record of one Segment (see CONTEXT.md). */
export interface HistoryEntry {
  id: string;
  stitchLabel: string;
  colourLabel: string;
  colourHex?: string;
  rowCount: number;
  generatedAt: Timestamp | null;
}

/** A document in globalStitches or globalColours. */
export interface GlobalItemDoc {
  id: string;
  label: string;
  hex?: string;
  createdAt: Timestamp | null;
  contributorCount: number;
  imageUrl?: string;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors (this file only declares types, nothing to exercise yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared Firestore document types"
```

---

### Task 5: Firestore path helpers

**Files:**
- Create: `src/lib/paths.ts`
- Test: `src/lib/paths.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `userDocPath`, `stitchLibraryCollectionPath`, `colourLibraryCollectionPath`, `projectsCollectionPath`, `projectDocPath`, `projectStitchesCollectionPath`, `projectColoursCollectionPath`, `projectHistoryCollectionPath`, `globalStitchesCollectionPath`, `globalColoursCollectionPath` — all `(...) => string`, imported everywhere a Firestore path is needed so no path string is ever hand-typed twice

- [ ] **Step 1: Write the failing test**

`src/lib/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  colourLibraryCollectionPath,
  globalColoursCollectionPath,
  globalStitchesCollectionPath,
  projectColoursCollectionPath,
  projectDocPath,
  projectHistoryCollectionPath,
  projectStitchesCollectionPath,
  projectsCollectionPath,
  stitchLibraryCollectionPath,
  userDocPath,
} from "./paths";

describe("paths", () => {
  it("builds every path from a uid and, where needed, a projectId", () => {
    expect(userDocPath("u1")).toBe("users/u1");
    expect(stitchLibraryCollectionPath("u1")).toBe("users/u1/stitchLibrary");
    expect(colourLibraryCollectionPath("u1")).toBe("users/u1/colourLibrary");
    expect(projectsCollectionPath("u1")).toBe("users/u1/projects");
    expect(projectDocPath("u1", "p1")).toBe("users/u1/projects/p1");
    expect(projectStitchesCollectionPath("u1", "p1")).toBe(
      "users/u1/projects/p1/stitches"
    );
    expect(projectColoursCollectionPath("u1", "p1")).toBe(
      "users/u1/projects/p1/colours"
    );
    expect(projectHistoryCollectionPath("u1", "p1")).toBe(
      "users/u1/projects/p1/history"
    );
    expect(globalStitchesCollectionPath()).toBe("globalStitches");
    expect(globalColoursCollectionPath()).toBe("globalColours");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- paths.test.ts`
Expected: FAIL — `paths` module doesn't exist.

- [ ] **Step 3: Implement `src/lib/paths.ts`**

```ts
export const userDocPath = (uid: string) => `users/${uid}`;

export const stitchLibraryCollectionPath = (uid: string) =>
  `users/${uid}/stitchLibrary`;

export const colourLibraryCollectionPath = (uid: string) =>
  `users/${uid}/colourLibrary`;

export const projectsCollectionPath = (uid: string) => `users/${uid}/projects`;

export const projectDocPath = (uid: string, projectId: string) =>
  `users/${uid}/projects/${projectId}`;

export const projectStitchesCollectionPath = (uid: string, projectId: string) =>
  `${projectDocPath(uid, projectId)}/stitches`;

export const projectColoursCollectionPath = (uid: string, projectId: string) =>
  `${projectDocPath(uid, projectId)}/colours`;

export const projectHistoryCollectionPath = (uid: string, projectId: string) =>
  `${projectDocPath(uid, projectId)}/history`;

export const globalStitchesCollectionPath = () => "globalStitches";

export const globalColoursCollectionPath = () => "globalColours";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- paths.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/paths.ts src/lib/paths.test.ts
git commit -m "feat: add Firestore path helpers"
```

---

### Task 6: Firebase app initialization

**Files:**
- Create: `src/lib/firebase.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `.env.local` variables from Task 3
- Produces: `auth` (Firebase Auth instance), `db` (Firestore instance), `functions` (Cloud Functions instance) — the only exports later plans use to talk to Firebase

- [ ] **Step 1: Install the Firebase JS SDK**

```bash
npm install firebase
```

- [ ] **Step 2: Write `src/lib/firebase.ts`**

```ts
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import {
  ReCaptchaV3Provider,
  initializeAppCheck,
} from "firebase/app-check";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
} else {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY
    ),
    isTokenAutoRefreshEnabled: true,
  });
}
```

App Check is skipped against the emulator (Step 1's `if (import.meta.env.DEV)` branch) since the emulator suite doesn't enforce it and the real `ReCaptchaV3Provider` call would fail without a live site key — this only runs in production builds.

- [ ] **Step 3: Wire it into `App.tsx` with a visible smoke check**

```tsx
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "./lib/firebase";

export function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, () => setAuthReady(true)), []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
      <p className="text-sm text-gray-500">
        {authReady ? "Auth connected" : "Connecting to auth…"}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify against the emulator**

Run: `firebase emulators:start` (separate terminal), then `npm run dev`.
Open the app: expect "Auth connected" to render (confirms `src/lib/firebase.ts` successfully connected to the Auth emulator). Stop both processes.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/firebase.ts src/App.tsx
git commit -m "feat: initialize Firebase app and connect to emulators in dev"
```

---

## Self-Review Notes

- **Spec coverage:** this plan only covers infrastructure (spec's Architecture section); feature sections are covered by the other 6 plans.
- **Placeholder scan:** none found — every step has runnable commands or complete code.
- **Type consistency:** `types.ts` types (`Project`, `StitchItem`, `ColourItem`, `HistoryEntry`, `GlobalItemDoc`, `UserDoc`) and `paths.ts` function names are the vocabulary every later plan's "Consumes" section references verbatim.
