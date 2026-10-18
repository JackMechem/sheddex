<!-- Moved word for word from the old single PROJECT.md (lines 6631–7122) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

## Backend (Convex)

Phase 1 was accounts only, nothing synced; Practice Timer's saved sessions came next as the first
synced *domain* (its own dedicated `practiceSessions` table — see its bullet in the tools list
above). This phase generalized that to **every tool's settings and data**, in one pass rather than
domain-by-domain: tunes, every trainer's instrument/tolerance/playback/pool settings *and* their
lifetime struggle stats and timed history, the Chord Charts library, Metronome/Tuner/Slow Downer/
Recorder's settings, all of it. Every tool still works fully with no account — signing in is still
a pure addition, never a requirement.

**The sync rule is the same everywhere, and it's deliberately simple: no merge.** Signed out, a
tool reads/writes this device's localStorage exactly as it always has. Signed in, it reads/writes
the account instead, full stop — whatever's already in localStorage on that device is **not**
imported, merged, or offered as a choice; it's just not consulted anymore. This was an explicit
simplification Jack asked for over a fancier first-login merge-prompt design that had been
sketched earlier (three-way "keep local / use synced / merge both" choice) — simpler to reason
about, simpler to implement correctly, and the risk case an elaborate merge exists to avoid
(silently losing data) can't happen when there's nothing automatic to get wrong: you'd have to
explicitly want the account's version by signing in.

**One generic mechanism covers nearly all of it**, rather than a hand-typed Convex table per tool
(what the original two-domain plan called for, and genuinely fine at that scale — not at
literally-every-tool scale). Every tool's settings object already round-trips through
`JSON.stringify`/`JSON.parse` for `usePersistedSettings` (`lib/usePersistedSettings.ts`) — that's
what makes it localStorage-safe today — so it's already guaranteed JSON-safe, and storing it as
one opaque blob account-side means a new tool, or a new field on an existing tool's settings, never
needs a matching schema change on the Convex side:
- `convex/schema.ts`'s `syncedSettings` table — one row per `(userId, key)`, `value` holding that
  tool's *entire* settings object as one JSON string. `key` is simply that tool's own existing
  localStorage key string, reused as-is (e.g. `"jam-practice-note-trainer"`,
  `"jam-practice-metronome"`) — one obvious key per call site, not a second naming scheme to keep
  in sync alongside it. `convex/syncedSettings.ts` (`get`/`set`, both scoped to
  `getAuthUserId(ctx)`) is the only Convex code this needed.
- `lib/syncedStore.ts` — the shared machinery underneath `useSyncedSettings`/`useSyncedTunes`: a
  module-level, per-`key` in-memory cache of "the current value while signed in"
  (`getSyncedValue`/`setSyncedValue`/`seedSynced`/`resetSynced`/`subscribeSynced`), updated
  *synchronously* on every local edit and written to Convex only after a `DEBOUNCE_MS` (600ms)
  quiet period. This exists because the first version of these hooks — writing straight to Convex
  on every `update()` call, with "current value" derived fresh from `useQuery`'s result each
  render — had two real problems, both hit directly: adding several tunes quickly (multiple
  standards in a row) silently dropped all but the last one, and the whole site felt sluggish
  since *every* setting change, however small, was a live network round-trip. The stale-closure
  drop happened because two rapid `update()` calls both closed over the same pre-edit snapshot (the
  query hadn't echoed the first write back yet), so the second call's "previous value" excluded the
  first call's edit; keeping the authoritative "current value" in a synchronous module-level cache
  instead of a value closed over from a stale render fixes that — every edit reads whatever the
  *last* edit actually left behind, never a stale echo. The network-call flood is fixed by the
  debounce: a local edit updates the cache and every subscribed component instantly (still feels
  synchronous to type/drag against), but only the *last* value in a burst of edits actually gets
  sent, once the burst goes quiet. `seedSynced` only applies a value the *first* time a real server
  read arrives for a key in the current signed-in session (never overwriting an edit already made
  locally with a lagging echo of the old value); `resetSynced`, called on sign-out, clears that
  so a different account signing in afterward re-seeds fresh instead of quietly showing the
  previous account's cached values — and flushes any not-yet-fired debounced write immediately
  first, so an edit made right before signing out still lands rather than being silently dropped.
  Verified with a synthetic Node script exercising all of this directly (rapid-edit accumulation +
  single collapsed write, seed-never-clobbers-a-local-edit, reset-flushes-then-clears) — see
  "What's genuinely untested" for what that script can't cover (an actual live Convex round-trip).
- `lib/useSyncedSettings.ts` — a **drop-in replacement** for `usePersistedSettings(key, defaults)`:
  identical signature, identical `[settings, update]` return shape, identical "defaults must be a
  stable module-level object" rule. Signed out it's a pure passthrough to the real
  `usePersistedSettings` (zero behavior change, zero regression risk — it's the same code
  underneath) *and* the Convex query is passed `"skip"` instead of real args, so a signed-out
  visitor never opens a live subscription for data they can't have at all (a real, avoidable cost
  the first version paid on every tool, every page load, regardless of sign-in state). Signed in,
  it reads/writes through `syncedStore.ts` as described above. The defensive "keep only fields
  whose type matches defaults" logic that protects a tool's UI from corrupt/foreign localStorage
  data (`mergeWithDefaults`, extracted out of `lib/usePersistedSettings.ts`'s previously-private
  `read()` so both paths share it) applies identically to whatever comes back from the account, for
  the same reason. Every tool's own `usePersistedSettings(SETTINGS_KEY, DEFAULT_SETTINGS)` call
  became `useSyncedSettings(SETTINGS_KEY, DEFAULT_SETTINGS)` — that one-line swap, nothing else in
  the component changed, since `noteStats`/`history`/every other field a trainer already keeps in
  that same settings object rides along automatically. Both `useConvexAuth()` and the underlying
  Convex `useQuery`/`useMutation` calls run unconditionally regardless of sign-in state, per
  rules-of-hooks — only the *returned* value, what `update` writes, and the query's `"skip"`
  argument branch on it (same pattern as every other signed-in-aware code in this codebase, e.g.
  `AccountPage.tsx`).
- `lib/useSyncedTunes.ts` — the one exception to "every tool goes through `useSyncedSettings`":
  Jam Practice's tune list isn't a `usePersistedSettings` object, it's `lib/tunesStore.ts`'s own
  hand-rolled external store (`subscribe`/`getSnapshot`/`setTunes`, used directly via
  `useSyncExternalStore` at four separate call sites — `JamPractice.tsx`, `TunesPanel.tsx`,
  `TunesManager.tsx`, `StandardsPicker.tsx`). Same "one JSON blob per key" shape fits it fine
  though, so it rides the *same* `syncedSettings` table, `syncedStore.ts` debounce/race-fix
  machinery, and `"skip"`-when-signed-out optimization under a fixed key, `"tunes"` — no table of
  its own. `useSyncedTunes()` is a drop-in replacement for that `useSyncExternalStore(...)` triple,
  returning the same `[tunes, setTunes]` shape, so all four call sites needed only an import swap.
  The debounced write in `syncedStore.ts` fires from a `setTimeout` (not from inside a React
  render) but still calls the owning hook's own `useMutation`-returned function, captured in the
  closure `setSyncedValue`/`resetSynced` are given — confirmed safe by reading Convex's own
  `useMutation` source (`node_modules/convex/dist/esm/react/client.js`): it returns a plain
  function bound only to the client instance and the mutation reference via `useMemo`, with no
  dependency on the calling component's own mount state, so it's still callable well after that
  component has unmounted.
- **What deliberately did *not* move to this mechanism**, and why:
  - Pure UI chrome — `CollapsiblePanel`/`OptionsCard`'s open/collapsed + "show hints" state
    (`lib/panels.ts`), the sidebar's width/collapsed state (`components/Sidebar.tsx`), the
    options-column/side-panel hidden toggles. None of this is "this tool's data" the way Jack meant
    it — it's per-device layout, and a phone and a desktop reasonably want different panel layouts
    anyway. Stayed on plain `usePersistedSettings`, unaffected by sign-in.
  - Chord Charts' `VIEW_KEY` (`selectedId`, `barsPerRow`) — a device-local display preference, not
    data — this file already drew exactly this line between `LIBRARY_KEY` (synced) and `VIEW_KEY`
    (not) before sync existed at all; sync just followed the line that was already there.
  - Waveform markers (`lib/markers.ts`) — small JSON, but keyed to a locally-uploaded file
    (`"<filename>|<filesize>"`) that isn't itself synced (see next bullet), so a synced marker set
    would be a dangling reference pointing at nothing on another device.
  - Recorder's project metadata and Slow Downer's loaded files — genuinely out of scope, unchanged
    from the original plan: the actual audio lives in IndexedDB as `Blob`s (`lib/projectStore.ts`,
    `lib/fileLibrary.ts`), which needs Convex file storage and a real sync design, not a JSON blob
    write. Both tools' small *settings* objects (volume, snap, track height, ...) did switch to
    `useSyncedSettings` like everything else — only the large binary data stayed local.
  - Theme (`lib/theme.ts`) — arguably could be nice to follow you across devices, but it's an
    app-wide display preference, not a specific tool's "options" in the sense Jack asked for, and
    wasn't part of this request — left alone, a candidate for later if it's ever actually wanted.

**Deploying it — two separate targets, not automatic together by default.** A `git push` alone
only redeploys the frontend (Vercel); it does *not* push anything under `convex/` to the
production Convex deployment (`grandiose-dolphin-564`) — that's a genuinely separate step
(`npx convex deploy`) unless wired together, which `vercel.json`'s `buildCommand` now does:
```
npx convex deploy --cmd 'pnpm build'
```
This deploys Convex functions *before* building the frontend, on every Vercel build, so the two
can't drift out of sync (a frontend build that depends on a Convex function that hasn't been
deployed yet would otherwise just break in production). It authenticates via a `CONVEX_DEPLOY_KEY`
environment variable in Vercel (a **Production**-scoped deploy key from the Convex dashboard's
Deploy Keys page — deliberately not set for Preview/Development, so a future preview-branch build
can't accidentally push to production Convex) rather than a personal login, which is what makes it
safe to run inside an automated build at all — `npx convex deploy` refuses to run non-interactively
under a personal login (confirmed directly: it prompts "Do you want to push your code to your prod
deployment now?" and hard-refuses even with `CI=1` set or `y` piped into stdin — a deploy key is
the only way around that prompt, not a flag).
- `convex/schema.ts` — `{...authTables}` (Convex Auth's own tables: `users`, `authAccounts`,
  `authSessions`, etc.) plus `pendingConfirmations` (below) and two app-data tables:
  `practiceSessions` (`convex/practiceSessions.ts` — list/create/update/remove, all scoped to
  `getAuthUserId(ctx)`), one row per saved Practice Timer session, shaped like
  `lib/practiceTimer.ts`'s `PracticeSession` minus its own `id` (the Convex document id doubles as
  that once synced); and `syncedSettings` (`convex/syncedSettings.ts` — `get`/`set`), the generic
  one-JSON-blob-per-`(userId, key)` table every other tool's settings (and Jam Practice's tunes)
  sync through — see this section's own paragraph above for why that one's generic rather than
  hand-typed per tool.
- `convex/auth.ts` — `convexAuth({ providers: [Password({ verify: ResendOTP }), Google] })`.
  Google is listed in code already but **won't actually work** until `AUTH_GOOGLE_ID`/
  `AUTH_GOOGLE_SECRET` are set on the deployment (`npx convex env set ...`) and a matching OAuth
  Client ID exists in Google Cloud Console with redirect URI
  `https://<deployment-name>.convex.site/api/auth/callback/google` — a one-time manual step only
  Jack can do (his own Google account). Same story for `verify: ResendOTP` — it needs
  `AUTH_RESEND_KEY` set (a Resend account, its own one-time signup) before it can actually send
  anything; see the email-confirmation bullet below. Until both exist, "Continue with Google"
  fails and password sign-up gets stuck waiting on a code that was never sent — the account page's
  password flows have the exact same dependency.
- **Email** (`convex/lib/resend.ts`, `convex/ResendOTP.ts`) — one shared `sendEmail` helper, a
  thin `fetch()` wrapper around Resend's plain HTTP API (`https://api.resend.com/emails`) rather
  than their Node SDK, since Convex actions can already call external APIs directly — no reason to
  add a dependency just to POST one JSON body with a bearer token. Reads `AUTH_RESEND_KEY` (throws
  a clear "you haven't set this yet" error if it's missing, rather than a confusing failure deeper
  in) and an optional `AUTH_EMAIL_FROM` (defaults to `onboarding@resend.dev`, Resend's own
  no-setup-required sending address — a verified custom domain is a nicer `from` address but isn't
  required to get this working). Two things live here rather than in `convex/account.ts`, since
  both are used by more than one caller: `generateOtp` (a 6-digit numeric code — short enough to
  type by hand, unlike Convex Auth's own 32-character default verification token) and `hashCode`
  (SHA-256 via the Web Crypto API already available in Convex's action runtime — confirmation
  codes are stored hashed, not in plaintext, in `pendingConfirmations` below). `ResendOTP.ts` wraps
  `sendEmail`/`generateOtp` as an `Email`-type provider (`@convex-dev/auth/providers/Email`) for
  Convex Auth's own sign-up verification — see the `auth.ts` bullet above. It only supplies *how*
  to send the code; Convex Auth's `Password` provider already owns *when* to trigger it (a fresh
  sign-up, or any account whose `emailVerified` isn't set yet — traced through the installed
  package's actual source, `Password.ts`'s `authorize` function, to confirm this rather than
  guessing) and the code storage/expiry/one-time-use machinery (`authVerificationCodes`, already
  part of the schema via `authTables`, previously unused since verification was never turned on
  before now).
- `convex/users.ts` — one `current` query (the signed-in user's own doc, or `null`) for the
  account button to show who's signed in. Not a synced-data domain, just identity.
- `components/AccountMenu.tsx` — the sign-in/account UI, **built from scratch, no premade auth
  widget** (Jack asked for this explicitly): signed out, a small custom modal with email+password
  (sign-in/sign-up toggle) and "Continue with Google", styled to match this app's own
  `ConfirmDialog`/`PromptDialog` conventions (same backdrop/panel/Escape-to-close shape). A
  password sign-up (or any pre-existing account that's never verified its email) doesn't complete
  right away — `signIn("password", {...})` resolves with `{signingIn: false}` and no error, which
  the form reads as "a code was emailed" and swaps to a "check your email" step;
  `signIn("password", {email, code, flow: "email-verification"})` completes it. That
  `signingIn`/thrown-error distinction is the only signal the client gets — confirmed by reading
  the actual client `signIn` implementation (`@convex-dev/auth`'s `client.tsx`) rather than
  assuming a shape. Signed in, it's a plain link to the `/account` page instead (below) — mounted
  in `components/Sidebar.tsx` as a sibling of `ThemeButton` in both footers (desktop `<aside>` and
  the mobile overlay), same `collapsed`/`large` prop shape, plus an `onNavigate` so the mobile
  overlay closes itself on tap, same as every other nav link there.
- **`/account`** (`app/account/page.tsx` / `components/AccountPage.tsx`) — password (change or set
  one for the first time), sign-in methods (connect/disconnect Google), and delete account, laid
  out as its own small Profile/Security/Danger zone sidebar (`AccountNavButton`, a plain
  `useState<AccountView>` tab switch, not routing — the page itself widens from the loading/
  signed-out states' `max-w-md` to `max-w-3xl` via `PageShell`'s `wide` prop to fit it, and stacks
  to a full-width column above the content on narrow screens rather than a fixed sidebar): Profile
  is a read-only summary (email, name if the account has one, which providers are linked); Security
  holds `PasswordSection` + `SignInMethodsSection`; Danger zone holds the delete-account section.
  Sign out sits below a divider at the bottom of that same nav list as a direct action (not a
  fourth view — clicking it signs out immediately, same as the plain button it replaced). Creating
  an account, changing/setting a password, and deleting an account (except a Google-only account —
  see below) all now require confirming a code emailed first, per an explicit follow-up request; a
  "forgot password" *reset* flow (recovering access when you don't know your *current* password at
  all) is still deliberately not implemented — a different thing from the email confirmations this
  section describes, and still out of scope. No route protection, consistent with the rest of the
  app — visiting it signed out just shows a plain "you're not signed in" message instead of
  redirecting. `convex/account.ts`'s `linkedProviders` query (which providers — `"password"`,
  `"google"` — are on the signed-in user's `authAccounts` rows) drives which of these sections show
  what.
  - **Password** (`PasswordSection`) is one section that's either "Change password" (has one
    already) or "Set a password" (Google-only so far) — same `linkedProviders` check throughout
    this feature — and now a two-step flow either way: step 1 (`requestPasswordConfirmation`)
    verifies the *current* password if there is one (`retrieveAccount`, throws on a mismatch) and
    emails a code; step 2 (`confirmPassword`) takes that code plus the new password and actually
    applies it, re-checking `linkedProviders` *again* at that point (rather than trusting which
    step-1 path was taken) to decide between `modifyAccountCredentials` (existing password — then
    `invalidateSessions` on every *other* session, since a leaked old password shouldn't still
    work elsewhere) and `createAccount` with `shouldLinkViaEmail: true` (first password — links to
    the *already-signed-in* user by matching their already-verified email rather than accidentally
    creating a second user; Convex Auth's account linking is fundamentally email-match-based, not
    session-based — traced through the installed package's actual source,
    `defaultCreateOrUpdateUser`, to confirm this rather than guessing — with the same defensive
    `linkedUser._id === userId` check as before). The new password is deliberately never sent to
    step 1 at all and never touches the database before step 2 succeeds — it just sits in
    `PasswordSection`'s own React state between the two submits, so a password is never persisted
    anywhere while a confirmation is still pending.
  - **Sign-in methods** (`SignInMethodsSection`) — "Connect Google" is literally the same
    `signIn("google")` OAuth flow as signing in, relying on that same email-matching linking
    behavior; it only lands on *this* account if the Google account's email matches. Since that's a
    real, somewhat confusing failure mode (a mismatched email silently signs into — or creates — a
    *different* account instead, with no error), `useGoogleLinkWarning` records the current email
    in `sessionStorage` right before redirecting to Google, then — on the fresh page load once
    Google redirects back — compares it against whoever's actually signed in and shows a plain-
    language warning if they don't match. Reads the marker once via a lazy `useState` initializer
    (safe — it only runs at mount) and derives the warning as a plain value during render; the
    accompanying `useEffect` only clears the marker (a real side effect against sessionStorage), it
    never calls `setState` itself — hit `react-hooks/set-state-in-effect` on a first draft that did
    call `setState` synchronously inside the effect body, restructured to avoid it. "Disconnect
    Google" (`disconnectGoogle` action) is only enabled once a password exists — checked both
    client-side (the button's `disabled`) and server-side (the action re-checks
    `linkedProviders`, since the action is the real source of truth, not the UI) — so there's
    always at least one way to sign back in. (Disconnecting doesn't need an emailed confirmation
    itself — only creating/deleting/changing credentials does, per the request that added this
    whole section — but it's already gated behind having a password, which is its own form of
    "prove you can still get in another way.")
  - **Delete account** is a confirm-first modal (`DeleteAccountModal`, following `ConfirmDialog`'s
    own shape) with two different paths depending on `linkedProviders`, per an explicit exception
    for accounts with only Google and no password: a password-holding account goes through the
    *same* two-step emailed-confirmation shape as the password section — step 1
    (`requestDeleteConfirmation`) verifies the password and emails a code, step 2 (`confirmDelete`)
    takes the code and actually deletes; a Google-only account instead keeps the original
    single-step "type `DELETE`" flow straight into `deleteAccount` — no password to gate an email
    behind, and the typed confirmation is treated as enough friction on its own for that case.
    `deleteAccount` itself now refuses outright if the account *does* have a password (so it can't
    be used to route around the email confirmation those accounts require — the action is the
    source of truth, not which UI path the client happened to take). Whichever path runs, the
    actual deletion is the same `internalMutation` (`performDelete`) hand-cascading across Convex
    Auth's own tables — there's no built-in "delete this user" helper, so this walks `authAccounts`
    (by the `userIdAndProvider` index) deleting each one's `authVerificationCodes` (by `accountId`)
    first, then `authSessions` (by `userId`) deleting each one's `authRefreshTokens` (by
    `sessionId`) first, then the `users` row itself — the same per-account delete helper
    (`deleteAuthAccountAndCodes`) is shared with "Disconnect Google" above, since it's the same
    operation just scoped to one provider instead of all of them. Deliberately *doesn't* also sweep
    `authVerifiers`/`authRateLimits` — neither has a `userId`-scoped index (short-lived PKCE/
    rate-limit bookkeeping, not reachable without a full table scan), and once the account+session
    rows are gone the user can't sign back in regardless. The client calls `signOut()` right after
    either path succeeds, since the server-side rows being gone doesn't by itself clear this
    device's cached token.
  - **`pendingConfirmations`** (`convex/schema.ts`) is the one table behind both the password and
    delete-account confirmation flows: one row per `(userId, kind)` (`"password"` or
    `"deleteAccount"`), storing a SHA-256 hash of the code (not the code itself) plus an expiry
    (15 minutes). A fresh request (`storeConfirmation`, `internalMutation`) deletes any existing
    pending row for that same `(userId, kind)` before inserting — no stacking multiple live codes.
    `consumeConfirmation` checks the submitted code's hash against the stored one and the expiry in
    one step, deleting the row either way it's actually used (success) — a wrong or expired code
    just leaves the pending row in place to actually expire on its own. This is deliberately
    separate machinery from Convex Auth's own sign-up verification (`authVerificationCodes`, owned
    entirely by the library) — these are app-specific confirmations for actions taken *after*
    already being signed in, not part of authenticating in the first place.
- `components/ConvexClientProvider.tsx` + `app/layout.tsx` — the app's first-ever React context
  providers. **`ConvexAuthNextjsServerProvider` is required, not optional** — confirmed by trying
  to remove it: `pnpm build` then fails outright while prerendering (`Cannot destructure property
  'isLoading' of 'c(...)' as it is undefined`), because Convex Auth's client-side auth context
  isn't safely renderable during Next's static-generation pass on its own. Keeping it means every
  route builds as `ƒ Dynamic` (server-rendered on demand) instead of the `○ Static` every route
  was before this session — a real, unavoidable cost of adding Convex Auth to the root layout, not
  a missed optimization. Worth knowing if page-load performance or hosting cost ever seems off
  after this.
- `proxy.ts` (repo root) — `convexAuthNextjsMiddleware()`, no route-gating (every tool stays fully
  usable signed out, by design). Named `proxy.ts`, **not** `middleware.ts` — Next.js 16 (this repo
  is on 16.3.4) renamed the convention; the API is unchanged, just the filename.
- `convex/_generated/` is **committed** to the repo (there's no CI here that runs `convex dev`
  first, so committing keeps `tsc`/`pnpm build` runnable standalone). Regenerate it with
  `npx convex dev --once` after any change to a `convex/*.ts` file — `tsc` will fail against a
  stale `api.d.ts` otherwise (hit this directly while building this phase: adding `convex/users.ts`
  didn't show up in `api.*` until re-running).
- Package manager is **pnpm only** now — the stray `package-lock.json` (this repo briefly had
  both) has been deleted; `pnpm-lock.yaml` + `pnpm-workspace.yaml` are the real ones.
- No password reset / email verification (deliberately deferred — needs a transactional email
  provider like Resend, which is out of scope for this phase). If email+password sign-up
  succeeds but someone forgets their password, there's currently no recovery path.
- **What's genuinely untested here**: none of the actual sign-up/sign-in/sign-out flow, or the
  Google OAuth round-trip, has ever been clicked through in a real browser — this sandbox has no
  working browser (same limitation noted elsewhere in this file for Chord Charts'
  `FitChordRow`/Playwright). `tsc`/`pnpm lint`/`pnpm build` all pass and `npx convex dev --once`
  successfully pushes the schema/functions to a real dev deployment, but none of that proves the
  UI actually works end to end for a person clicking through it. Needs a real pass by Jack: sign
  up, sign in, sign out, refresh persistence, both sidebar chrome states (desktop
  expanded/collapsed, mobile), and — once the Google Cloud OAuth app exists — "Continue with
  Google" specifically. Same goes for `/account`'s change-password (including that
  `invalidateSessions` actually signs out other devices/tabs and not the current one) and
  delete-account flows (including the cascade delete genuinely leaving no way to sign back in, and
  that a Google-only account's `DELETE`-to-confirm path works with no password field shown). And
  now, the account-linking additions specifically: whether "Set a password" on a Google-only
  account really attaches to the same user (the `linkedUser._id !== userId` check is only a
  same-session sanity check — it can't prove `shouldLinkViaEmail`'s underlying matching behaved as
  read from the library's source, only that this action didn't return an obviously-wrong user id);
  whether "Connect Google" with a *matching*-email Google account actually links instead of
  erroring; and whether the mismatched-email warning (`useGoogleLinkWarning`) actually fires
  correctly across a real Google OAuth redirect round-trip, versus just working in theory against
  the sessionStorage read/write logic in isolation. And now the whole email-confirmation layer:
  whether Resend actually delivers (needs `AUTH_RESEND_KEY` set — a Resend account, its own
  one-time signup, same category of prerequisite as Google's OAuth app; not done as of this
  writing), whether the default `onboarding@resend.dev` sender lands in an inbox instead of spam
  without a verified custom domain, the full sign-up "enter code, get signed in" round-trip
  (`ResendOTP`/Convex Auth's own `email-verification` flow), and both of `convex/account.ts`'s
  request/confirm pairs end to end (`requestPasswordConfirmation`/`confirmPassword`,
  `requestDeleteConfirmation`/`confirmDelete`) — including that a wrong or expired code is
  actually rejected by `consumeConfirmation`, and that a fresh request really does replace (not
  stack alongside) an earlier unconfirmed one. Only verified so far: `generateOtp`/`hashCode`
  (`convex/lib/resend.ts`) against a synthetic Node script (6-digit codes, deterministic/collision-
  free SHA-256 hashing) and that every new Convex function type-checks and deploys — nothing about
  an actual email ever having been sent or received.

**Public profiles & follows** — this app's first genuinely public, social feature (see the
Community bullet in the tools list above), and its first-ever file upload. Two new tables:
- `profiles` (`convex/profiles.ts`) — one row per user: `username` (always lowercased, both stored
  and displayed — no separate display-case, so there's never a "@JohnSmith" vs. "@johnsmith"
  ambiguity to reason about; validated by `lib/username.ts`'s `usernameError`/`normalizeUsername`,
  the same functions used client-side for instant feedback and server-side as the actual
  source-of-truth check — client validation is never trusted alone), `avatarStorageId` (a Convex
  file-storage reference — see below), `instruments` (free text, not `lib/instruments.ts`'s
  `INSTRUMENTS` catalog — that list is range-specific for the note trainers, a poor semantic fit
  for "what do you play"; `lib/profileInstruments.ts`'s `COMMON_INSTRUMENTS` drives autocomplete
  only, never validated against), and `isPublic`. Nothing on a profile is visible to anyone but its
  owner while `isPublic` is false. `knownTuneIds` (`v.optional`, unused) is a deprecated leftover
  from an earlier design — see the tune-lists paragraph below for why it's gone.
- `follows` (`convex/follows.ts`) — one row per `(followerId, followingId)` pair; `follow` checks
  for an existing row first so it's idempotent, never a duplicate. Both Following and Followers
  show on a profile — gated the same way the rest of it is: always visible for your own account,
  otherwise only if that profile is public (`canViewFollowGraph`) — a private profile's social
  graph stays private too, not just its tune list.

**Usernames are now required for every account** — per an explicit follow-up request, not
optional-until-you-go-public the way `profiles` was originally designed. Enforced as a follow-up
step rather than threaded into sign-up itself, since Convex Auth's own Password/Google flows have
no field for one: `components/UsernamePrompt.tsx`, mounted once app-wide in `app/layout.tsx`
alongside `PracticeTimerAlert`, shows a full-screen, deliberately non-dismissable modal (no
Escape, no backdrop click — same reasoning as that alert) to any signed-in user whose
`api.profiles.getMine` is `null` or has `username === ""` (the same empty-string sentinel
`setAvatar` already used for "profile row exists, no username chosen yet"). It submits through a
new, minimal-field `claimUsername` mutation rather than reusing `upsertProfile` — the latter also
writes `instruments`/`isPublic`, which this prompt knows nothing about and shouldn't be able to
clobber on an existing row. The sidebar's account button (`AccountMenu.tsx`) now shows the
signed-in user's real profile picture (`UserAvatar`, reading `api.profiles.getMine`'s `avatarUrl`)
and `@username` instead of a generic person icon and their email — falling back to email/name only
in the brief window before `UsernamePrompt` forces a username to exist at all. Verified against the
real dev deployment: `claimUsername` correctly rejects an unauthenticated caller, and
`usernameAvailable` correctly reports an empty string as unavailable. **Not verified**: the prompt
actually appearing and blocking the rest of the app for a real freshly-signed-up or
no-username-yet account, and the avatar/username swap rendering correctly in both sidebar footers
— this sandbox still has no working browser.

**A public profile's tune lists aren't curated — it shows everything, automatically.** The first
version had a "which of your tunes should show" picker (`knownTuneIds`, a hand-picked subset) on
the Public Profile tab; per a direct follow-up request that was removed entirely — a public profile
now just shows *every* tune in the owner's own lists, full stop, nothing to ask about. There are
two such lists, both shown as their own section on the profile page (`app/u/[username]/page.tsx`):
**Tunes** (the same list Jam Practice and the account's own "Tunes" tab use, `"tunes"` in
`syncedSettings`) and **Tunes to Learn** — a new, separate personal list
(`lib/useTunesToLearn.ts`/`lib/tunesToLearn.ts`, its own fixed `syncedSettings` key,
`"jam-practice-tunes-to-learn"`) for tunes bookmarked from *other* people's profiles, kept
deliberately apart from your own practice list rather than mixed into it. It rides the exact same
generic `syncedSettings` table and the same `lib/syncedStore.ts` debounce/stale-closure-race fix as
`useSyncedTunes`, but — like Favorites (`lib/useFavorites.ts`) — is **account-only**, with no
signed-out local-storage fallback: the only way to ever add something to it is visiting another
account's public profile, which already requires being signed in, so there's no meaningful
signed-out story for it to fall back to. It gets its own **Tunes to Learn** tab in `/account`
(`components/TunesToLearnTab.tsx`, between Tunes and Public Profile) — the exact same
`TuneListManager` layout the Tunes tab uses (see that section below), just with standards-adding
turned off, since there's nothing to browse here — everything on this list arrives by being copied
from someone else's profile, not looked up.

`convex/profiles.ts`'s `getPublicByUsername` is the one query in this app that reads across users'
data *by design* — a public profile's tune lists have to come from the *owner's* `syncedSettings`
rows, not the caller's, unlike every other synced-data query here (`convex/syncedSettings.ts`'s
`get`, deliberately self-scoped via `getAuthUserId(ctx)`). Rather than loosen that existing query
into a general "read anyone's data" backdoor, this reads the owner's `"tunes"` and
`"jam-practice-tunes-to-learn"` rows directly and resolves each through `lib/profileTunes.ts`'s
`resolvePublicTunes` — a pure function returning full `{id, name, tempos, keys, timeSignature}` for
*every* tune in the blob (no id filter anymore — see above), but never `notes` (which could hold
private practice notes). Also returns `null` — indistinguishable — for both "no such username" and
"that profile exists but isn't public", so a visitor can't tell the two apart by probing usernames.

**Viewing someone else's profile shows their tunes in the same styled list Jam Practice itself
uses** (`components/PublicTuneList.tsx` — name, time signature, tempo/key chips, styled after
`TunesTab.tsx`'s own rows), not the plain name pills the first version showed, per a direct
follow-up request. The same component renders both the Tunes and Tunes to Learn sections — which
list a tune came from doesn't change what a viewer can do with it. A signed-in viewer looking at
someone *other* than themselves (`canAdd` on that component) gets two per-row actions, each copying
that tune into one of the *viewer's own* lists as a fresh, independent tune (new ids throughout,
`notes` always empty since a public profile never exposes it to copy in the first place): "Add"
into their own Tunes, "Learn" into their own Tunes to Learn — each disabled once a tune with a
matching name (`lib/standards.ts`'s `nameId`, the same name-insensitive match the jazz-standards
picker already uses) is already in that target list. Copying is a snapshot, not a live reference —
once it's in your list, it's yours to edit or delete independently of whatever the original owner
does to theirs afterward, same reasoning as importing a CSV or adding a jazz standard.

**File storage** (profile pictures): Convex's built-in `_storage` system table, no schema entry
needed beyond referencing `v.id("_storage")`. The standard two-step upload flow — `profiles.ts`'s
`generateAvatarUploadUrl` mutation returns a one-time URL, the browser `fetch()`s a POST straight
to it (bypassing Convex's own request path entirely) with the image bytes, gets back
`{storageId}`, and `setAvatar` attaches that id to the profile — deleting the previous
`avatarStorageId`'s stored file first, if there was one, so changing your picture doesn't just
leave the old upload orphaned in storage forever. The image itself is resized *client-side* before
any of this — `components/AvatarUpload.tsx`'s `resizeToSquareJpeg`, a plain `<canvas>`
center-crop-and-resize to 400×400 JPEG (no new dependency, same "reach for the platform first"
habit as everywhere else audio-related in this app) — so a multi-megabyte phone photo never
actually reaches the network as anything but a small round picture. `components/UserAvatar.tsx` is
the one shared "picture, or a plain fallback icon" renderer reused everywhere an avatar shows up
(the editor, a public profile, Community search results, Following/Followers lists).

`/account` also has its own **Tunes** tab (`components/TunesTab.tsx`, between Profile and Public
Profile in the sidebar) for managing the same tune list Jam Practice uses — same underlying
`useSyncedTunes()`, so a tune added, edited, or deleted from either place is immediately visible in
the other, no separate copy to keep in sync. It briefly reused `components/TunesPanel.tsx` (Jam
Practice's own compact sidebar-panel UI) as-is, but per a direct follow-up request was rewritten as
its own from-scratch layout instead, since the account page has room Jam Practice's narrow options
column doesn't: Jam Practice spreads tune management across three separate surfaces (the inline
collapsible list; a "search 631 jazz standards" modal reached via a `+`; a "search your tunes"
bulk-select modal reached via a checklist icon) because each only has a cramped sidebar column to
work in, but on the full-width account page there's no reason those need to be three different
screens.

The actual layout — search box, multi-select checkboxes, per-row edit/delete, and a bulk
Select-all/Export/Import/Delete footer — lives in `components/TuneListManager.tsx`, a shared
component both `TunesTab.tsx` and `TunesToLearnTab.tsx` wrap (per a direct follow-up request to put
"this UI" on Tunes to Learn too, rather than duplicating it by hand into a second, drifting copy).
It went through two designs: the first merged "search your tunes" and "browse jazz standards to
add" into the *same* search box (typing a query showed matching standards inline, right below your
own filtered results); per a direct follow-up request that was reverted, since searching your own
tunes surfacing someone else's whole library in the same box read as confusing rather than
convenient. The search box now only ever filters the list it's given — nothing else. Adding a jazz
standard went back to being a separate, explicit action instead: `TuneListManager`'s `allowStandards`
prop makes the header's `+` button open `StandardsPicker`, the exact same search-and-add-or-create-
custom modal Jam Practice's own `TunesPanel` uses, styled as the exact same small round
accent-colored icon button Jam Practice's own `+` is (per a direct request to match it, replacing an
earlier rectangular "+ New tune" text button) — rather than jumping straight to a blank tune editor
the way it does when `allowStandards` is off. **Both tabs turn this on**, including Tunes to Learn —
per a direct follow-up request specifically asking for the Tunes tab's jazz-standards picker there
too, once the first version had it off (reasoning at the time: nothing to browse, everything there
arrives from someone else's profile) — there's a real use for it: bookmarking a standard you want to
learn without first adding it to your actual practice list. `StandardsPicker` originally
read/wrote `useSyncedTunes()` internally with no way to target a different list; it now takes
`tunes`/`setTunes` as optional props instead, used only when passed — Jam Practice's own
`TunesPanel.tsx` call site still passes neither, so it falls back to `useSyncedTunes()` exactly as
before (verified unaffected: zero behavior change, confirmed via `git diff` showing no edit to that
call site at all), while `TuneListManager` always passes its *own* `tunes`/`setTunes` through, so a
standard picked from either tab's `+` lands in whichever list that tab is actually managing, never
always Jam Practice's. **Jam Practice itself (`TunesPanel.tsx`'s own call site, `TunesManager.tsx`)
was deliberately left untouched** throughout all of this — every request was specifically about the
account-only experience, not about changing how Jam Practice's own sidebar panel works; the one
shared file that *did* need a real edit, `StandardsPicker.tsx`, only gained optional props with a
default that reproduces its exact original behavior. Deleting a tune from either tab needs no extra
bookkeeping elsewhere — a public profile shows every tune live at read time (see above), so there's
no separate "known tunes" selection anywhere that could reference a since-deleted id.

**Account deletion now cascades here too** — a real gap found and fixed while building this:
`convex/account.ts`'s `performDelete` previously only cleaned up Convex Auth's own tables
(`authAccounts`/`authSessions`/`authRefreshTokens`/the `users` row), never touching
`practiceSessions`/`syncedSettings` (a pre-existing gap, out of scope to fix here — see that
section's own "genuinely untested" note — since that data is private, not public-facing) or,
critically, this new `profiles`/`follows` data. Left as-is, "deleting your account" would have
left a public profile — username, photo, everything — live and searchable forever, directly
contradicting both the account page and the Privacy Policy's own "removes this visibility
immediately" promise. Fixed: `performDelete` now also deletes the user's `profiles` row (and its
uploaded avatar file via `ctx.storage.delete`, not just the database reference to it) and every
`follows` row in both directions, so a deleted account doesn't leave a ghost entry in anyone
else's Following/Followers list either.

`app/privacy/page.tsx` gained a full "Public profiles" section (what a public profile exposes and
to whom, that Following/Followers are visible under the same public/private rule, that avatars are
resized client-side before upload) plus updates to "The short version", "Who else sees your data"
(Convex now also named as storing file uploads, not just account data), and "Your choices"
(turning a profile private/deleting it any time).

