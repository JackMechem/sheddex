<!-- Moved word for word from the old single PROJECT.md (lines 43–132) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

## Repo structure (pnpm monorepo, since the Expo migration's Phase 0)

As of this session, this is a **pnpm monorepo**, not a single Next.js package — restructured as
Phase 0 of a plan to ship sheddex as an Expo iOS/Android app too, from the same codebase
(`.claude/skills/expo-web-to-native/`, the migration plan file). **Every path reference anywhere
else in this document from before this session is now stale by one level of nesting** — this file
never rewrites its own past (see the "sheddex" rename bullet above for the same policy), so rather
than hand-edit several hundred scattered `app/...`/`components/...`/`lib/...`/`convex/...`
references throughout thousands of lines of history, read them as relative to `apps/web/` (or
`packages/convex/` for anything under the old `convex/`) unless stated otherwise. New sessions
should mentally prepend the right prefix rather than trust a bare path literally.

```
apps/web/          — the actual Next.js app (App Router), otherwise unchanged: app/, components/,
                      lib/, public/, types/, next.config.ts, tsconfig.json, proxy.ts, AGENTS.md,
                      vercel.json. Its own package.json is "@jam-practice/web".
apps/mobile/        — the new Expo app (Expo Router, SDK 57), scaffolded but not yet wired to
                      anything beyond its own default template — see its own section below.
                      Package "@jam-practice/mobile".
packages/convex/    — the Convex backend (schema, functions, auth config) — moved out of the old
                      top-level convex/ so both apps/web and apps/mobile can depend on it as an
                      ordinary workspace package ("@jam-practice/convex") rather than Next-app-
                      relative code. convex/_generated is still committed (unchanged policy).
                      Has its own convex.json (see its own bullet below for why that's required,
                      not optional) and its own .env.local (a copy of apps/web's — both need
                      CONVEX_DEPLOYMENT for the CLI / NEXT_PUBLIC_CONVEX_URL for the frontend).
packages/core/      — pure, framework-agnostic shared logic — populated so far with exactly the
                      five files the Convex backend itself needs from what used to be lib/
                      (profileTunes.ts, practiceTimer.ts, username.ts, tunesToLearn.ts, types.ts —
                      convex/profiles.ts, convex/communityTunes.ts, and convex/practiceSessions.ts
                      all import from one or more of these). Deliberately *not* a big upfront
                      extraction of every pure lib/ file — per the migration plan's own "pull, don't
                      push" philosophy, a file only moves here when something outside apps/web
                      actually needs it (the backend needed these five immediately, since Convex
                      functions can't reach across the workspace boundary into apps/web/lib/ the
                      way they could reach into a sibling convex/../lib/ before the restructure;
                      everything else stays in apps/web/lib/ until a mobile screen needs it too).
                      apps/web/lib/{profileTunes,practiceTimer,username,tunesToLearn,types}.ts are
                      now one-line `export * from "@jam-practice/core/X"` re-export shims at their
                      original paths specifically so every existing in-app relative import
                      (`./profileTunes` etc.) keeps working completely unchanged — nothing inside
                      apps/web had to be touched to adopt this.
pnpm-workspace.yaml — gained a real `packages:` field (`apps/*`, `packages/*`); it only ever had
                      `allowBuilds:` config before this.
```

A few non-obvious things worth knowing before touching this structure again:

- **`packages/convex/convex.json` (`{"functions": "./"}`) is load-bearing, not boilerplate.**
  Without it, the Convex CLI's default assumption — functions live in a subdirectory literally
  named `convex/`, searched for relative to cwd — gets confused by `packages/convex` already being
  *named* "convex" while its function files sit directly at that directory's own root, not in a
  nested `packages/convex/convex/` subfolder. Confirmed directly, the hard way: running `npx convex
  dev --once` (and separately, `pnpm exec convex dev --once`) from inside `packages/convex` with no
  `convex.json` present genuinely **deleted close to 30 real table indexes from the live dev
  deployment** (`users.email`, `profiles.by_username`, `follows.by_pair`, and so on) — it silently
  decided the "real" functions directory was an empty, nonexistent nested `./convex/` and pushed
  that empty state as the new schema. Index deletion doesn't delete the underlying documents (only
  a secondary lookup structure), and a second run with `convex.json` in place correctly recreated
  every one of those exact indexes (confirmed by diffing the push output against the original
  deletion list — identical set, just `[+]` instead of `[-]`), so no data was actually lost — but
  this was a real, if low-stakes (dev deployment, not production), destructive event from a config
  gap, not a hypothetical one. A third run after the fix showed zero changes (fully idempotent),
  confirming `convex.json` is what actually fixed it, not luck. **Don't delete this file or move
  `packages/convex`'s function files into a nested subfolder without re-verifying this.**
- **`apps/web/vercel.json`'s `buildCommand`** now reads `cd ../../packages/convex && npx convex
  deploy --cmd 'cd ../../apps/web && pnpm build'` — preserves the original single-command's
  "deploy Convex, *then* build the frontend with the right env vars already in place" ordering
  (Convex's own `--cmd` integration), just relocated across the two new directories. **This is
  reasoned through, not empirically verified against a real Vercel deploy** — this sandbox has no
  Vercel login/CLI access. The one thing Jack has to do by hand that nothing here can do for him:
  change the Vercel project's **Root Directory** setting (dashboard → Project Settings → General)
  to `apps/web`, and watch the first real deploy's build log carefully once that's changed.
- **`@jam-practice/mobile`'s own `eslint` dependency resolves to a broken/dangling pnpm symlink**
  in this sandbox specifically (`apps/mobile/node_modules/eslint` points at a
  `node_modules/.pnpm/eslint@9.39.5/...` store entry that never actually got extracted, even after
  a `--force` reinstall) — `pnpm exec expo lint` falls back to whatever `eslint` happens to be on
  `$PATH` instead (a nix-provided v10, incompatible with `eslint-plugin-react`'s API and currently
  crashing on `_layout.tsx`). `tsc --noEmit` is unaffected and passes clean, as does the actual
  Metro bundler/dev server — this is lint-tooling-only, isolated to this one workspace package, and
  genuinely not something this session could resolve (reinstalling, forcing, and deleting the dead
  store entry by hand all reproduced the identical dangling symlink). Worth a fresh `pnpm install`
  on a different machine/session before assuming it's a real, permanent problem with the setup.
- **Everything else was verified for real, not just reasoned through**: `pnpm --filter
  @jam-practice/web build` (all 22 routes, Turbopack, clean), `pnpm --filter @jam-practice/web
  lint` (clean), `tsc --noEmit` clean in all four workspace packages, and `npx expo export
  --platform web` from `apps/mobile` actually bundled 1200+ modules end-to-end with Metro through
  the pnpm workspace with no errors — confirming the monorepo's module resolution genuinely works
  for Expo, not just for Next.

