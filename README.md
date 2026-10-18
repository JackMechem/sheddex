# sheddex

**Current version: v0.9.1 (beta)** · [What's new](https://sheddex.com/changelog)

Free practice tools for musicians, in the browser: a metronome (odd and changing meters,
polyrhythm modulation), a tuner, ear training with levelled learning paths, note, scale and
interval trainers, chord charts (with iReal Pro import), a jam-practice tune picker, a bass-line
and drum generator to play along with, a slow-downer/looper, a recorder, a practice log with
streaks and goals, setlists, a community, and tools for teachers and students.

No ads, no paywalls. Every tool works without an account; signing in syncs your stuff between
devices.

**Use it:** [sheddex.com](https://sheddex.com)

**Found a bug, or want a feature?** Use [sheddex.com/feedback](https://sheddex.com/feedback)
(also in the sidebar's ⋮ menu), or open a GitHub issue.

## Running it locally

You need Node and [pnpm](https://pnpm.io) (pnpm only — no npm or yarn).

```bash
pnpm install
pnpm convex:dev   # the Convex backend (needs a Convex account and packages/convex/.env.local)
pnpm dev          # the website at http://localhost:3000
pnpm mobile       # the Expo app (optional)
```

The web app reads `NEXT_PUBLIC_CONVEX_URL` from `apps/web/.env.local`; the mobile app reads
`EXPO_PUBLIC_CONVEX_URL` from `apps/mobile/.env.local`.

## Repo layout

| Folder | What's in it |
| --- | --- |
| `apps/web` | The website (Next.js + Tailwind) |
| `apps/mobile` | The iOS/Android app (Expo) |
| `packages/core` | Shared logic used by both apps and the backend |
| `packages/convex` | The backend ([Convex](https://convex.dev)) |
| `docs` | [How it fits together](docs/architecture.md), [style guide](docs/guides/style.md), [versioning](docs/guides/versioning.md), [testing](docs/guides/testing.md), [deploying](docs/guides/deploying.md), and [feature notes](docs/notes/) |

## Versioning

sheddex uses semantic versioning and is in beta until 1.0. The version is set in
`apps/web/package.json`, and every release is listed at [sheddex.com/changelog](https://sheddex.com/changelog)
(entries live in `apps/web/lib/changelog.ts`). See [docs/guides/versioning.md](docs/guides/versioning.md).

## Credits

Samples and fonts are by their authors under their own licenses; see
[sheddex.com/credits](https://sheddex.com/credits).
