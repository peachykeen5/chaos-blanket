# chaos-blanket

## Running locally

1. Install dependencies: `npm install`
2. Start the Firebase Emulator Suite: `firebase emulators:start`
   - Auth: `9099`
   - Firestore: `8080`
   - Functions: `5001`
   - Hosting: `5050` (note: **not** the Firebase default of `5000` — it was moved because it conflicts with macOS AirPlay/ControlCenter, which claims port `5000` on the same machine)
   - Emulator UI: `4000`
   - The Firestore emulator requires a JVM (Java) to be installed and on your `PATH`.
3. In another terminal, start the dev server: `npm run dev`

`.env.development` ships in this repo with dummy-but-non-empty Firebase config values wired to the `chaos-blanket` project ID, so the app boots against the emulators out of the box on a fresh checkout — no manual setup required.

If you want the dev server talking to real Firebase console values instead of dummy ones (e.g. to test something the emulators can't simulate), run `firebase login`, then copy `.env.example` to `.env.local` and fill in real values from the Firebase console's project settings. `.env.local` is git-ignored and, when present, overrides `.env.development`.
