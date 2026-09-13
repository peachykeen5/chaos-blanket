# Chaos Blanket Generator — Design Spec

## Purpose

A web app for crocheters making a "chaos blanket" — a blanket where each
row's stitch, yarn colour, and row count are chosen randomly rather than
planned. Users define their own pool of stitches, colours, and a row-count
range per project, then generate randomized rows on demand and keep a
history of what they've made.

## Scope

In scope:
- Google sign-in, multiple projects per user, full CRUD on projects.
- Per-project lists of stitches and colours, plus min/max row range.
- Account-level "library" of saved stitches/colours, reusable across projects.
- A public, deduplicated global pool of stitches/colours, browsable and
  automatically contributed to whenever a user saves something to their
  own library.
- Randomized generation (one stitch, one colour, one row count) saved to
  a per-project history, deletable individually.
- Abuse protection appropriate for a public sign-up app (spam/junk
  filtering and rate-limiting on the global pool).

Out of scope (documented for future work, not built now):
- Images/illustrations for stitches or colour swatches beyond the hex
  code itself. The data model reserves an optional `imageUrl` field on
  stitch documents so this can be added later without a migration.
- Non-Google auth providers (email/password, etc.).
- Full-text search (global pool search is prefix-based only).
- Automated end-to-end UI test suite (manual testing only for MVP).

## Architecture

- **Frontend:** React + TypeScript + Vite + Tailwind CSS, deployed as a
  static SPA on Firebase Hosting.
- **Auth:** Firebase Auth, Google sign-in provider.
- **Database:** Firestore. All personal data lives under `users/{uid}/...`
  and is protected by Security Rules so a user can only read/write their
  own data.
- **Backend logic:** One callable Cloud Function, `contributeToGlobal`,
  is the sole write path into the global stitch/colour pool — it handles
  normalization, dedup, sanitization, and rate-limiting. Every other
  write (projects, personal library, history) goes directly from the
  client to Firestore.
- **Abuse protection:** Firebase App Check in front of both Firestore and
  the Cloud Function, blocking traffic that isn't from the real app.

This split (direct writes for owned data, a function gateway only for the
one public/writable surface) keeps the bulk of the app simple and
idiomatic Firebase while concentrating anti-abuse logic where it's
actually needed.

## Data Model (Firestore)

```
users/{uid}
  - displayName, email, createdAt

users/{uid}/stitchLibrary/{itemId}     ← account-level saved stitches
  - label, createdAt

users/{uid}/colourLibrary/{itemId}     ← account-level saved colours
  - label, hex (optional), createdAt

users/{uid}/projects/{projectId}
  - name, rowMin, rowMax, createdAt, updatedAt

users/{uid}/projects/{projectId}/stitches/{itemId}
  - label

users/{uid}/projects/{projectId}/colours/{itemId}
  - label, hex (optional)

users/{uid}/projects/{projectId}/history/{entryId}
  - stitchLabel, colourLabel, colourHex (optional), rowCount, generatedAt

globalStitches/{normalizedId}          ← public, read-only from client
  - label, createdAt, contributorCount, imageUrl (optional, unused for now)

globalColours/{normalizedId}
  - label, hex (optional), createdAt, contributorCount
```

Notes:
- Project-level stitches/colours are independent docs from account
  library items — copying between project, library, and global pool is
  always a duplicate-write, never a shared reference.
- Global collection document IDs are a normalized form of the label
  (lowercased, trimmed, punctuation-stripped — or the hex code for
  colours when present), so dedup is just "does this doc ID exist."
- `contributorCount` is internal bookkeeping (e.g. for future "popular
  stitches" sorting) and is never attributed to a specific user in the UI.

## Feature Flows

- **Bulk add to a list** (stitches/colours, project or library): user
  pastes/types multi-line text into a textarea; client splits on
  newlines, trims blanks/duplicates, writes one doc per line directly to
  the relevant subcollection. Items can be edited/deleted individually
  afterward.
- **Save a project item to account library:** client copies the item
  into `users/{uid}/stitchLibrary` or `colourLibrary` directly, then
  fires `contributeToGlobal` in the background (non-blocking).
- **Browse global pool:** a panel reads `globalStitches`/`globalColours`
  (paginated, alphabetical, prefix-search), read-only for any signed-in
  user. Selecting an item copies it into the user's account library
  (direct write) and triggers the same background contribute call (a
  no-op if it already exists).
- **Add library item to a project:** direct client write copying the
  chosen item into the project's `stitches`/`colours` subcollection.
- **Generate:** fully client-side — pick one random doc from the
  project's stitch list, one from the colour list, and an inclusive
  random integer between `rowMin`/`rowMax`. Result is written
  immediately to the project's `history` subcollection; no save/skip
  prompt.
- **History:** listed per-project, newest first, individually deletable.
- **Projects:** standard CRUD (create, rename, delete). Deleting a
  project cascades to its stitches/colours/history subcollections via a
  Cloud Function trigger, since the client can't recursively delete
  subcollections.

## Security & Abuse Prevention

- **Firestore Security Rules:**
  - `users/{uid}/**` — read/write only when `request.auth.uid == uid`.
  - `globalStitches/**` / `globalColours/**` — read allowed for any
    signed-in user; all direct client writes denied. The only write path
    is the Cloud Function (Admin SDK, bypasses rules).
- **`contributeToGlobal` Cloud Function:**
  - Requires `context.auth` and a valid App Check token.
  - Validates label length (1–60 chars), strips disallowed characters,
    rejects empty/whitespace-only or excessive-length input.
  - Runs a basic denylist-based profanity/junk filter.
  - Rate-limits per user (e.g. ~20 contributions/day, tracked in
    `users/{uid}/meta/rateLimit`).
  - Normalizes the label into the doc ID; if it already exists,
    increments `contributorCount` instead of duplicating.
- **XSS:** React escapes rendered text by default; no
  `dangerouslySetInnerHTML` anywhere in the app, which covers the risk of
  rendering other users' global-pool text.
- **Injection:** Not applicable in the traditional SQL sense — the
  Firestore SDK never builds query strings from user input. Input
  validation above targets content quality (spam/junk), not injection.

## Error Handling

- Auth errors (popup blocked/cancelled): inline message with retry.
- Firestore write failures (offline, permission-denied): inline error
  near the affected UI; bulk-add rolls back optimistic UI on failure.
- The background `contributeToGlobal` call is best-effort and silent —
  failure (rate limit, validation) doesn't affect the user's own
  library/project write, which already succeeded; failures are logged,
  not surfaced to the user.
- The Generate button is disabled with a helper message if a project is
  missing a stitch list, colour list, or valid row range.

## Testing

- **Unit tests (Vitest):** inclusive random row-range picker, bulk-paste
  parser, label normalization/dedup-key function.
- **Cloud Function tests:** via the Firebase emulator suite — validation,
  dedup, rate-limiting for `contributeToGlobal`, and the project-delete
  cascade trigger.
- **Security Rules tests:** `@firebase/rules-unit-testing` against the
  Firestore emulator — confirm cross-user data isolation and that direct
  client writes to the global collections are rejected.
- **Manual testing:** golden path (sign in → create project → add lists
  → generate → history) plus edge cases (empty lists, deleting the
  currently-selected item, etc.). No automated e2e suite for this MVP.
