<!-- Moved word for word from the old single PROJECT.md (lines 133–735) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### The Expo app itself (`apps/mobile`)

`pnpm create expo mobile` (SDK 57, the Expo Router + TypeScript default template, `@expo/ui`
included out of the box), renamed from the template's generic "mobile" to "sheddex" in both
`package.json` (`name`) and `app.json` (`expo.name`/`slug`/`scheme`, all now `"sheddex"`). The
first pass (above) was genuinely just the stock scaffold — "get something Jack can open on his
phone," not real migration work yet.

**A direct follow-up request** — "start the migration... to start, just migrate the general layout
of the site, home page, menu, and searching" — is where the first real screens landed: a native
navigation shell, a native Home screen, and a combined browse/search "Tools" screen. Still none of
the plan's audio-engine/mic-input/Convex-Auth spikes, and no individual *tool* has a real native
screen yet — tapping anything from the menu lands on a generic placeholder (below). What exists so
far:

- **Navigation shell** (`src/app/_layout.tsx`) — a plain `Stack`, deliberately not tabs. The web
  app's own "menu" isn't a handful of top-level destinations (what a bottom tab bar is for) — it's
  ~16 tools across 6 categories, much closer to `Sidebar.tsx`'s own categorized, searchable list
  than to a tab bar. `index` (Home) hides its own header (it's the landing screen, nothing to go
  "back" from yet); `menu` and `tool/[slug]` get the real native Stack header (large title, back
  button, theming).
- **Home** (`src/app/index.tsx`) — a native *redesign*, not a port, of `apps/web/components/
  Home.tsx`'s own hero: the same pitch (free, no ads/paywalls/popups, built for musicians,
  accounts are optional and only for cross-device sync), but as a plain centered screen instead of
  a scrolling marketing page with a floating tool-preview cluster — that cluster depended on
  previewing real tool UI (`BeatIndicator` etc.) that doesn't exist natively yet, so it's left for
  later rather than faked. Account/sign-in state isn't wired up at all yet (no "Welcome back,
  {name}"), since Convex Auth's own Expo integration is still an unstarted spike (see the
  migration plan's own spike #3) — this screen doesn't claim to know who's signed in.
- **Tools / search** (`src/app/menu.tsx`) — "menu" and "searching" turned out to be one screen, not
  two, matching how the web app actually works: `Sidebar.tsx`'s own search box always sits directly
  above its always-visible categorized list in the *same* panel; `CommandPalette.tsx`'s separate
  ⌘K overlay is a power-user shortcut to that *same* list, not a second, differently-organized one.
  The native equivalent of "a search field permanently anchored above a browsable list" is a
  large-title header's own native search bar (`headerSearchBarOptions`, part of Expo Router's own
  forked-in native-stack — confirmed by reading its real `.d.ts`, not assumed; there's no
  `@react-navigation/*` package in this SDK at all anymore, Expo Router vendors its own fork now),
  set dynamically from inside the screen (its `onChangeText` needs to close over local query
  state, which a static `_layout.tsx`-level option can't reach) — not a second screen, not a modal.
  A `SectionList` below it groups the filtered results by category, reusing `groupByCategory`/
  `filterNavLinks` directly.
- **Tool placeholder** (`src/app/tool/[slug].tsx`) — one dynamic route standing in for all ~16
  tools (not 16 near-identical stub files), looked up by slug against the same shared data; shows
  the tool's real label/description plus a plain "Not migrated yet" notice. Adding a real screen
  for a specific tool later is just adding a differently-named route that shadows this fallback for
  that one slug — nothing here needs to change when that happens.
- **`packages/core/navLinks.ts`** (new) — `CATEGORIES`/`Category`/`NAV_LINKS_DATA`/
  `filterNavLinks`/`groupByCategory`/`hrefToSlug` pulled out of `apps/web/components/tools.tsx`,
  since this is the first moment something outside `apps/web` (the menu/search screen above)
  genuinely needed this exact data — the same "pull, don't push" extraction rule `packages/core`
  was already following for the Convex-needed files in Phase 0. Deliberately *not* the icon
  components (those stay web-only SVG JSX, no native equivalent yet) — `apps/web/components/
  tools.tsx` now builds its own `NAV_LINKS` by mapping the shared plain data through a local
  `href -> icon component` lookup, re-exports `CATEGORIES`/`Category`/`groupByCategory` straight
  from the shared package, and keeps `filterLinks(query)`'s exact original signature as a one-line
  wrapper around the shared `filterNavLinks` — every other file that already imports from
  `components/tools.tsx` (Sidebar, CommandPalette, ToolLayout, TilingLayout, Home, AccountMenu,
  ...) needed zero changes, confirmed by `apps/web`'s own full `tsc`/`eslint`/`next build` passing
  clean after the refactor, not just assumed from the diff being "mechanical."
- **Theming** — `src/constants/theme.ts`'s `Colors.light.accent`/`Colors.dark.accent` now match
  `apps/web/app/globals.css`'s own `--accent` exactly (`#6366f1`/`#818cf8`) instead of the
  template's default Expo blue, so the one brand color that's easy to get right for free is right.
  Everything else from the template (`ThemedText`/`ThemedView`/`useTheme`/`Spacing`/the splash
  animation) was kept and built on rather than replaced — it's a perfectly good foundation, not
  template cruft.
- **Removed outright** (not left as unreferenced dead code): the template's own tab layout
  (`app-tabs.tsx`/`app-tabs.web.tsx`) and its second tab screen (`explore.tsx`), plus the
  components that only existed to support them (`hint-row.tsx`, `web-badge.tsx`,
  `components/ui/collapsible.tsx`). `external-link.tsx` was left alone despite being unreferenced
  right now — generic enough (open a URL in the browser) to likely get used again soon (a GitHub/
  Privacy link somewhere), unlike the others, which were specific to the stock template's own demo
  content.

Verified for real, the same way Phase 0 was: `tsc --noEmit` clean in all four workspace packages;
`npx expo export --platform web` bundled successfully (1150+ modules) with the new route list
correctly showing `/`, `/menu`, `/tool/[slug]` (and `/explore` correctly gone); the exported static
HTML was grepped directly for real content (`dist/index.html` contains "sheddex", "Search tools",
"Advanced, customizable"; `dist/menu.html` contains "Metronome" and "TIMING", the uppercased
section header) rather than just trusting the build succeeded; and the live dev server was
restarted fresh and re-bundled with zero console errors (an earlier in-session edit briefly broke
`index.tsx` with a stale `Colors` reference — caught via the dev server's own live error log, fixed
immediately, and reconfirmed clean on a fresh restart rather than trusted from a stale HMR log).
**Not verified**: how any of this actually looks/feels on a real device through Expo Go — this
sandbox can only check bundling and rendered HTML content, not physically see or tap through it.

**To actually open it**: the dev server was left running in the background during this session
(`cd apps/mobile && npx expo start`, or `pnpm mobile` from the repo root) — install **Expo Go**
from the App Store/Play Store, make sure the phone is on the same Wi-Fi as this machine, then
either scan the QR code `expo start` prints in a real terminal (not visible from here, since this
session's own shell access can't render one) or open Expo Go and manually enter
`exp://192.168.1.169:8081` (this machine's LAN IP at the time — confirm it's still current via
`hostname -I` if it's been a while or the network changed). If the dev server isn't running,
`pnpm mobile` from the repo root starts it fresh. This only works for as long as both devices stay
on the same local network — there's no tunnel/remote connection set up (Expo supports one via
`--tunnel`, not configured here).

### Strategic pivot: "look exactly the same," NativeWind, and a real theme port

A direct follow-up reversed one of the migration plan's own stated principles: "it doesn't look
the same as the nextjs site at all... I want it to look exactly the same as I want to eventually
just use the expo project and get rid of the nextjs site. make the home page look exactly the
same, have the same side bar and everything, and most importantly have the same themes." The
`expo-web-to-native` skill's own `native-patterns.md` explicitly argues for the opposite ("a
nativized screen should look more native than the web, never identical" — "redesign, don't
reskin"), but that's a *default*, not a mandate, and Jack's stated end goal here is different from
that skill's own assumption: one shared UI (built once, shipped as web/iOS/Android alike via
`react-native-web`) replacing the Next.js app entirely, not two platform-appropriate UIs bridged by
DOM-shelling. Noted here as a real, deliberate departure from the plan's own prior framing, not a
quiet reversal — future sessions should treat "match the web app's exact look" as the standing
instruction for `apps/mobile`'s own screens from this point forward, not the skill's own default
"redesign" posture.

**NativeWind**, not hand-written `StyleSheet`s, is what makes this actually tractable:
`className="bg-accent text-foreground"` means close to the same thing in both apps now, letting
native screens be adapted from the web component's own JSX/class strings directly rather than
hand-translated into a parallel styling system. Installed at SDK 57: `nativewind@4.2.7` paired
with `tailwindcss@3.4.19` (a deliberate downgrade from whatever `expo install` resolved by
default) — confirmed directly: NativeWind v4 is built for Tailwind v3's config format; v4 (CSS-
native `@theme`, no JS `tailwind.config.js`) is only supported by NativeWind's own v5, still a
release candidate as of this session, not the stable line. `apps/mobile/tailwind.config.js` maps
the same 10 color tokens `apps/web/app/globals.css`'s own `@theme` block defines (`background`,
`surface`, `accent`, ...) to identically-named CSS custom properties, supplied at runtime via
NativeWind's own `vars()` (`ThemeProvider.tsx`, below) — deliberately plain hex `var(--x)`
references, not the RGB-triplet-plus-alpha trick Tailwind's opacity modifiers (`bg-accent/20`)
need, since this app's shared color format (hex strings) wasn't worth reworking for that this
round; native screens use a precomputed solid color instead wherever the web version leans on one.

**A real, reproducible pnpm bug was hit and fixed, not just worked around with a retry** — worth
specifically remembering, since it'll resurface on a fresh clone otherwise: NativeWind's babel
plugin (`jsxImportSource: 'nativewind'`) rewrites every JSX-using file to import
`react-native-css-interop/jsx-runtime` directly, resolved from *that file's own* location. Since
`react-native-css-interop` is only ever a transitive dependency of `nativewind` here, pnpm's strict
node_modules doesn't expose it to `apps/mobile`'s own source files by default — expected, and
normally fixed by adding it as an explicit direct dependency. That fix didn't work here: both
`pnpm add` and a plain `pnpm install` deterministically created a **dangling symlink** at
`apps/mobile/node_modules/react-native-css-interop`, pointing at an *unqualified*
`.pnpm/react-native-css-interop@0.2.7` store entry that — confirmed directly, repeatedly, even
after `rm -rf node_modules && pnpm install --force` — never actually gets populated with real
files, while the real, fully-populated copy sits one level deeper inside `nativewind`'s own
`node_modules`, under a peer-dependency-qualified hash pnpm clearly already knows how to resolve
correctly (it's used successfully as a transitive dependency). The actual fix, in
`apps/mobile/metro.config.js`: resolve the *real* path at config-load time the same way Node
itself would (`require.resolve('react-native-css-interop/package.json', { paths: [...] })`,
anchored on wherever `nativewind`'s own `package.json` actually lives — not a hardcoded hash, which
would go stale on the next install) and hand Metro that real path directly via
`resolver.extraNodeModules`, sidestepping the broken symlink entirely regardless of whether pnpm
ever fixes its own resolution for this package. `react-native-css-interop` is *not* listed as a
direct dependency in `package.json` — adding it is what triggers the bug in the first place; the
Metro-level fix needs no package.json entry at all.

**What was actually built this round**, verified by real `expo export` bundles for **all three
platforms** (`--platform web`, `--platform ios`, `--platform android` — not just web, since this
round touches Metro/babel config that could plausibly behave differently per platform) plus the
live dev server restarted fresh and re-bundled with zero errors:

- **`packages/core/themes.ts`** (moved from `apps/web/lib/themes.ts`, byte-for-byte — it was
  already pure data/math with zero DOM dependency) — the *entire* theme system: 10 color tokens,
  10 quick-pick `PRESETS` + 20 more in `MORE_PRESETS` (light/dark/midnight/forest/.../gruvbox/
  monokai/tokyo-night/catppuccin/rosé-pine/kanagawa/..., 30 total), `getPreset`/`isValidHex`/
  `isDarkColors`. The usual re-export shim sits at the old `apps/web/lib/themes.ts` path so every
  existing web import keeps working unchanged — confirmed via `apps/web`'s own full `tsc`/
  `eslint`/`next build`.
- **`apps/mobile/src/theme/ThemeProvider.tsx`** — the native side of `apps/web/lib/theme.ts`: same
  storage key (`jam-practice-theme`, now in `AsyncStorage` instead of `localStorage` — two
  genuinely separate stores, no actual cross-device sync, just a matching name), same resolve rule
  (custom-if-set, else the chosen preset, else "light"), built on the exact same shared preset
  list. Applies the resolved colors as real CSS custom properties via NativeWind's `vars()`,
  wrapping the whole app once near the root. **Deliberately not ported yet**: font selection
  (`lib/fonts.ts`'s web-only `var(--font-x)` stacks tied to `next/font/google` — a native
  equivalent needs real font files via `expo-font`, a separate task), the custom-theme color
  *editor* (`setCustomColor`/`setCustomColors` aren't exposed — every preset is pickable, including
  landing on "custom" once something has seeded it, which nothing does yet), and no system-
  color-scheme fallback on first launch (defaults straight to `"light"`, same as web's own
  `DEFAULT_STATE` before its own `matchMedia` check runs).
- **The sidebar** (`apps/mobile/src/components/Sidebar.tsx`) — a real `Drawer`
  (`react-native-drawer-layout`'s own component, not `expo-router/drawer`'s file-based nested-
  layout convention, which would need every route split into a sub-`_layout.tsx` for no benefit
  here), reachable from any screen via a left-edge swipe or the header's own hamburger button
  (`MenuButton`). Its content mirrors `Sidebar.tsx`'s own shape: a "sheddex" header, a search box
  directly above the categorized tool list in the same panel (not a separate modal) — the same
  `groupByCategory`/`filterNavLinks` the `/menu` screen already used, pulled into a shared
  `ToolList` component so both render tool rows identically rather than drifting apart. A "Theme"
  row at the bottom opens the new `/theme` screen. **Deliberately scoped down** from the real
  `Sidebar.tsx` (712 lines on web) — not ported this round: favorites, the account menu, the
  practice timer widget, collapsible/expandable categories (sections render always-expanded), and
  resize-by-drag (there's nothing to resize on mobile). This is the structural shell, not full
  parity.
- **`apps/mobile/src/app/theme.tsx`** (new route) — a native port of `ThemeModal.tsx`'s own
  two-tier structure (the 10 quick-pick presets, then "More themes" below) as a full screen rather
  than a popover/modal (no modal-sheet primitive wired up yet, and a full screen is the more
  natural native shape for "pick one of 30 things" regardless). Each row previews *that preset's
  own* colors directly (not the currently-active theme's tokens) so you can see what you're about
  to pick, with a checkmark on whichever one's actually selected and a small "active theme" strip
  pinned to the bottom using the live resolved colors, confirming the whole app re-themes instantly
  on tap.
- **Home** (`apps/mobile/src/app/index.tsx`) — restyled with NativeWind to match
  `apps/web/components/Home.tsx`'s actual copy/structure/colors directly (the "sheddex" title, the
  tagline, the search-trigger pill, the accent-bordered "free, no ads" pitch card, the accounts-
  are-optional note, the footer line) rather than the earlier from-scratch native redesign. The
  web hero's floating tool-preview cluster (real `BeatIndicator`/chord-chip previews) still isn't
  ported — it depends on real tool UI that doesn't exist natively yet.
- `menu.tsx`/`tool/[slug].tsx` were also rewritten onto NativeWind classNames (dropping the
  template's own `ThemedText`/`ThemedView` style-prop approach); `ToolList` is now shared between
  `/menu` and the sidebar drawer rather than each rendering its own copy.
- **Removed outright** (now fully superseded, not left as dead code): the template's own
  `ThemedText.tsx`/`ThemedView.tsx`/`use-theme.ts`/`use-color-scheme.ts`(`.web.ts`) and
  `constants/theme.ts`'s old light/dark-only `Colors` object — confirmed nothing else referenced
  any of them before deleting (`grep`, not assumed).

Verified concretely, not just by a clean build: the exported `index.html` (from a real
`expo export --platform web`, and separately fetched live from the running dev server) contains
the literal string `--background:#f4f4f6` — the light preset's own hex value, inline on the root
`View`'s own style attribute — proving the whole chain (shared preset data → `ThemeProvider` →
NativeWind's `vars()` → compiled CSS referencing `var(--background)`) resolves correctly end to
end, not just that it type-checks. The compiled CSS output was independently grepped for
`var(--accent)`/`var(--foreground)`/`var(--surface)`, confirming the color *tokens* (not just one
hardcoded value) are wired through correctly. **Not verified**: how any of this actually looks on
a real device through Expo Go — this sandbox can only check bundling and rendered
HTML/CSS content, never see or tap through it; native-only behavior specifically (the Drawer's own
swipe gesture, `AsyncStorage` persistence actually surviving an app restart on-device) is entirely
unconfirmed beyond "the bundle for that platform builds."

### The "base" pass: responsive layout, the real wordmark, exact copy — verified by actual screenshot this time

A direct follow-up, with real screenshots of both apps side by side: "they dont look very
similar... again I want the expo site to look exactly the same as the nextjs one... I want at
least the base to be good here." Two genuine structural gaps, not just missing polish:

- **No responsive layout at all** — the Expo app always used the hamburger-triggered overlay
  drawer, even in a wide desktop browser window, where the web app shows a *persistent* sidebar
  instead (no hamburger, sidebar and content side by side). This was the single biggest cause of
  "doesn't look similar" — the screenshot comparison was a wide desktop window with a hamburger
  and a huge empty page next to the web app's own persistent-sidebar desktop view. Fixed with
  `useIsWideScreen` (`apps/mobile/src/hooks/useIsWideScreen.ts`), the exact same `min-width: 1024px`
  breakpoint `apps/web/lib/useIsDesktop.ts` already gates its own desktop/mobile split on, driving
  `react-native-drawer-layout`'s own built-in `drawerType="permanent"` (real support for "sidebar,
  not overlay," not something hand-built) above that width, `"front"` (the usual overlay) below
  it. `MenuButton` (the hamburger) renders nothing at all once the sidebar's permanent, same as the
  web hamburger never shows up next to the web desktop sidebar either.
- **The wordmark itself didn't exist** — `apps/web/components/Wordmark.tsx`'s own waveform-bars-
  behind-the-text effect (and the fact that "sheddex" is `accent`-colored, not `foreground`-colored
  — a real, visible mismatch caught directly against a screenshot) was simply missing; Home just had
  plain bold neutral-colored text. Ported directly as `apps/mobile/src/components/Wordmark.tsx` —
  the *exact* two hand-picked bar-height arrays from the web version (not re-derived), sized against
  a fixed-height container the same percentage-based way the web version sizes them against its own
  CSS box. Shared by both the Home hero (`size="lg"`) and the sidebar header (`size="sm"`), the same
  "one definition, not two drifting copies" reasoning the web version's own doc comment already
  states.
- **Home's copy didn't match** — an earlier pass used paraphrased/shortened text instead of the
  real copy. Rewritten to match `Home.tsx` word for word: the real tagline, the full "free
  all-in-one solution" pitch paragraph, a real "☕ Buy me a coffee" button (opens
  `buymeacoffee.com/jackmechem` via `Linking.openURL`), the accounts note, and the full footer line
  (`Made by Jack Mechem · GitHub · Privacy · Terms · Credits` — each a real `Linking.openURL` to
  the actual deployed web page, since none of those have native screens yet; "Jack Mechem" and
  "GitHub" link out, "Privacy"/"Terms"/"Credits" currently open the *web* versions at
  `sheddex.com/...` as a deliberate interim bridge rather than dead links).
- **A simplified, static `PreviewCluster`** was added too (the same five tool-preview chips —
  Metronome/Jam Practice/Chord Charts/Guess the Interval/Polyrhythm — `Home.tsx` itself shows),
  matching the *mobile* web view's own 2-column grid shape specifically (not the desktop-only
  scattered/rotated absolute layout) since that's the shape this app's screens already need
  regardless of width. Static content (no live `BeatIndicator`/audio — real tool UI this app
  doesn't have yet), but genuinely tappable through to that tool's placeholder screen.
- **`hexWithOpacity()`** (`apps/mobile/src/app/index.tsx`) — a small hand-rolled hex-to-rgba
  helper, needed because this app's theme colors are plain hex `var(--x)` strings (see
  `tailwind.config.js`'s own comment on why), which NativeWind's `bg-accent/10`-style opacity
  modifiers can't apply to the way they can to an rgb()-triplet color. Used for the hero preview
  card's translucent accent tint — a flat `opacity` style would have faded the card's own text
  along with its background, not just the background.
- **A real layout bug, caught only because this round's verification actually looked at a
  screenshot for the first time** (see below) **and not before**: Home's content used to be a
  plain `flex-1` block with `justifyContent: 'center'` and no way to scroll — on a short/narrow
  viewport where the content (now taller, with the preview cluster and full copy) didn't fit, it
  silently overflowed *upward* past the top of the screen instead of scrolling, clipping the
  wordmark and visually overlapping the footer into the paragraph above it. Fixed by wrapping
  everything in a real `ScrollView` (`contentContainerStyle`'s own `justifyContent: 'center'` still
  centers content when there's room to spare — identical to before whenever it fits — and now
  scrolls instead of overflowing when it doesn't).

**Verification finally included real screenshots, not just bundle/content greps** — this sandbox's
nix-chromium + `playwright-core`-over-CDP setup (documented elsewhere in this file, previously only
used against the Next.js web app) was pointed at the Expo dev server's own web output for the first
time this round, and **it's what actually caught the ScrollView bug above** — grepping rendered
HTML for the right strings, as every earlier round in this section did, would never have surfaced a
purely visual clipping/overlap problem. Confirmed directly, at real viewport sizes: a 1400px-wide
screenshot shows the permanent sidebar + centered hero, matching the real web desktop screenshot's
own layout closely; a 390px-wide screenshot shows the hamburger-only mobile layout with no
permanent sidebar, matching the real web mobile screenshot; clicking the hamburger (a coordinate
click — a text-locator click failed first, intercepted by an overlapping pointer-events layer, not
an app bug, just a test-script targeting issue) actually opens the drawer, showing the categorized
list + Theme row; a full-page (not just viewport) screenshot at narrow width confirms the pitch
card, accounts note, and footer all render in order with no overlap after the `ScrollView` fix.
Zero console errors throughout. **Still not verified**: real device/Expo Go rendering (this is
still react-native-web specifically, not true native iOS/Android — the same screens were also
re-confirmed to bundle cleanly for `--platform ios`/`--platform android`, but bundling clean and
rendering identically-correctly on-device aren't the same claim), and genuine touch/swipe gesture
feel for the drawer on a real screen.

### Theming on native was broken in a way this sandbox's own verification couldn't catch — found and fixed against a real device

Jack reported the styling looking wrong in Expo Go itself (text rendering near-invisible/unstyled)
despite every earlier round's own `--platform ios`/`--platform android` bundle checks passing
clean — a real, concrete gap in this whole section's own verification method up to this point:
"the bundle builds" and "the CSS variable mechanism actually resolves on a real device's JS
runtime" are different claims, and only the first had ever actually been checked. Diagnosed this
time against Jack's own physical Pixel 10 Pro, plugged in over USB — `adb`/`scrcpy`
(`nix shell nixpkgs#android-tools nixpkgs#scrcpy`, no root needed) gave this sandbox, for the
first time, a way to screenshot and interact with a *real* native Android runtime rather than only
`react-native-web` through a browser, which is all the nix-chromium setup documented elsewhere in
this file could ever exercise — worth remembering as a second real-device verification path
alongside that one.

**Root cause, traced through `react-native-css-interop`'s (0.2.7, what this NativeWind 4.2.7
ships) actual source, not guessed**: `ThemeProvider.tsx`'s original design matched the web app's
own mechanism as closely as possible — resolved theme colors applied as real CSS custom properties
via NativeWind's `vars()`, so `className="bg-accent"` would mean the same thing on both platforms.
This *looked* right (confirmed correct in every `react-native-web` bundle/screenshot check this
file already documents) but was never actually correct on true native: `vars()` creates a fresh,
WeakMap-identity-keyed observable for every CSS variable on every call, and switching themes
(`useMemo(() => vars({...}), [colors])`) produces a *brand-new* set of observables each time — any
already-rendered descendant `className` (`bg-background`, `text-foreground`, ...) had subscribed
to the *old* observable on its first render and is never notified when a *new* one is created, and
`react-native-css-interop`'s own guard system only re-resolves a component's styles when that
component's *own* `className`/`style` prop changes, not when an ancestor's provided variable value
does — so a static className gets stuck on whichever color it first resolved to, forever. Confirmed
directly on-device: anything reading `colors` as a plain JS value (icon `color` props, inline
`style`) updated instantly on a theme switch; anything styled via a `className` color token did
not. A `:root` CSS fallback (added first, to fix an even more basic problem — nothing resolved to
*any* color at all without one) made this worse, not better: it turned out to be
`global.__css_interop`'s `rootVariables` store, not the `vars()`-scoped context override, actually
driving resolution — confirmed with a deliberately absurd test value (`--background: #ff00ff`),
which rendered on-device regardless of which theme was actually selected.

**Fixed by not using `vars()`/CSS custom properties for color at all** — rather than chase
`react-native-css-interop`'s internals (a `StyleSheet.registerCompiled({rootVariables})` runtime
API exists and would plausibly work, since `injectData` correctly `.set()`s existing observables
in place rather than creating new ones, but reaches deeper into unstable/undocumented territory
for a problem with a much simpler standard answer). Color now flows entirely through
`useAppTheme().colors` (the plain React Context this file already had, which was never actually
broken) applied as inline `style` props — the ordinary, "native to Expo" way color theming is done
in React Native (the same shape react-navigation's or react-native-paper's own theme objects use),
per Jack's own explicit direction once the `vars()` rabbit hole became clear: get the Expo app
using the *same theme data* as the web app (still true — `@jam-practice/core/themes` is
unchanged, still the one shared source of truth) without needing the same *mechanism* to apply it.
`className`/NativeWind is still used everywhere for *layout* (flex, spacing, rounded corners, type
scale) — only color moved off it. Touched: `ThemeProvider.tsx` (dropped `vars()`/the `nativewind`
import entirely, now just resolves `colors` and renders a plain `<View style={{backgroundColor:
colors.background}}>`), `tailwind.config.js` (dropped the `theme.extend.colors` block pointing at
`var(--x)`), `global.css` (dropped the color `:root` block, keeping only the pre-existing font
vars), and every screen/component that had a color `className` — `Home` (`index.tsx`), `Sidebar`,
`ToolList`, `Wordmark`, `MenuButton`, `theme.tsx`, `tool/[slug].tsx` — converted to inline
`style={{color: colors.x}}`/`style={{backgroundColor: colors.x}}`, with `active:bg-x-hover`
press-state classNames replaced by `Pressable`'s own functional `style={({pressed}) => ({...})}`
prop (a plain React Native mechanism, not dependent on NativeWind's CSS-interop at all).

**Verified for real, on the actual device, not just reasoned through**: cold-reloaded the app
(Expo Go's own dev-menu "Reload," not Fast Refresh, to rule out any hot-reload-specific
artifact) on "Gruvbox Dark" — background, wordmark, nav row text, icons, section headers all
correctly dark/orange from the very first frame. Then, with zero reload, opened the drawer →
Theme → picked "Midnight" (a completely different hue) and confirmed *live*, in place: the Theme
screen itself, the drawer, and — navigating back — the Home screen's background, wordmark, tagline,
search pill, and every nav row all switched to the new navy/blue theme immediately, the exact
scenario that was silently broken before (screenshots of both the broken and fixed states were
compared directly, not just described). `tsc --noEmit` and `eslint` both clean across every
touched file, and all three `expo export --platform {web,ios,android}` still bundle cleanly after
the rewrite. **Not verified**: how this looks/feels on a real iOS device (only Android was
available to test against this session), and whether the `Pressable` functional-`style`
press-state replacement feels identical to the original `active:` classNames — reasoned to be
behaviorally equivalent (both are "a different background while actively pressed"), not
specifically tapped-and-held to confirm by feel.

### Home and the menu redesigned into a card-based "app-like" look — plus a second real device-only bug, worse than suspected

A direct follow-up, after installing the `expo-ui` and `vercel-react-native-skills` skills:
"redesign the home page and menu to be more mobile friendly and app like." The skills' own default
advice (native `@expo/ui` `List`/`BottomSheet`, a native large-title header + search bar) was
proposed first and explicitly turned down — "fully native components tend to look very generic
... think of apps like instagram, airbnb," with a few Dribbble references (most usefully, a
smart-home app's 2-column grid of rounded "Favorite Actions" tiles). The `frontend-design` skill
was loaded for the actual build, adapted for a mobile app with a pre-existing, fixed 30-preset
color system rather than a from-scratch brand palette — structural/layout choices (cards, grid,
grouping, a featured banner) carry the "distinctive, not templated" goal here, not new colors.

**What shipped**: `ToolList.tsx` (flat rows) was replaced outright by `components/ToolGrid.tsx` — a
plain `ScrollView` over hand-chunked 2-column rows (not `SectionList`'s own `numColumns`-less
layout, and not a `FlatList`/`FlashList` switch either — this is a small, fixed-length list of 16
tools, not a feed, so none of the virtualization machinery either would earn its keep), each tile a
rounded card with an accent-tinted icon chip, plus a "featured" Community banner (solid `accent`
background) above the category grid. `Home` (`app/index.tsx`) and `Sidebar.tsx` both shrank to a
fixed (non-scrolling) compact top bar + fixed search pill, with `ToolGrid` as the only scrolling
content beneath — the "search always reachable, chrome doesn't scroll away" pattern the reference
apps use. A new floating pill tab bar (`components/FloatingTabBar.tsx`, Home/Community/Profile, a
filled accent circle behind the active icon) was added per a direct follow-up with its own
reference screenshot — mounted once in `_layout.tsx` as a sibling of `Stack` inside `Drawer`'s own
main-content slot, so the drawer sliding open naturally covers it with no manual z-index/visibility
logic, and persists correctly across navigation since it's outside any one screen. It's a plain
hand-built `View`/`Pressable` row, not `expo-router`'s `Tabs`/native-tabs layout — same "not fully
native" steer, and the existing single flat `Stack` (not per-tab stacks) didn't need restructuring
to get it. "Profile" has no screen of its own yet (no auth on the Expo side — still an unstarted
spike), so `app/profile.tsx` is a plain placeholder, the same honest "not built yet" treatment
`tool/[slug].tsx` already uses for every unported tool, not a faked signed-out state.

**A second real, confirmed-on-device bug, found immediately once there was something to actually
look at**: the very first version of the new Community banner rendered as a conspicuous empty gap
— no visible background, no visible text, despite `uiautomator`'s own UI dump confirming the text
nodes genuinely existed with correct bounds and content. Root-caused by elimination, not guessed:
swapping the banner's dynamic `style={({pressed}) => ({backgroundColor: ...})}` for a *hardcoded*
`style={{backgroundColor: 'red'}}` still rendered nothing, which ruled out a bad color value and
pointed at the function itself — confirmed by then testing a plain *static* object in place of the
function, which rendered correctly immediately. **A NativeWind-wrapped `Pressable`'s functional
`style` prop (`style={(state) => ({...})}`, React Native's own documented, standard way to vary a
`Pressable`'s style by press state) is silently dropped outright on this device/version — not even
its initial, unpressed value ever applies.** This is the same underlying class of bug as the
`vars()`/CSS-variable issue two rounds earlier in this file (`react-native-css-interop` mishandling
a *dynamic*, non-compiled value passed through `style`) — different code path, same root category:
this version of the library's style-interception layer only reliably handles compile-time-known
inputs (literal classNames, plain style objects), not anything decided at runtime inside a
function. Directly connects to an open, under-examined caveat from the *previous* round's own
entry (above): "whether the `Pressable` functional-`style` press-state replacement feels identical
... not specifically tapped-and-held to confirm by feel" — it didn't just feel different, it never
worked at all, on *any* of the four Pressables using that pattern (`MenuButton`, `Sidebar`'s close
button and Theme row, `ToolGrid`'s own tiles), confirming this was a real, pre-existing, silent gap
in every one of this session's own earlier "it's probably fine, just unconfirmed by feel" caveats,
not a new regression introduced by this round's redesign.

**Fixed project-wide, not just on the one banner that happened to get noticed**: every Pressable in
`MenuButton.tsx`, `Sidebar.tsx`, and `ToolGrid.tsx` moved to a plain (non-function) `style` object
plus `android_ripple` for Android's own native press feedback — sidesteps the bug entirely rather
than working around it, and `android_ripple` is itself a genuinely native touch cue, not a step
down in "app-like" feel. iOS has no equivalent replacement here and so has no visual press feedback
on these elements for now — not independently verified, no iOS device available this session
either. The same fix also directly explains why the grid's tiles looked "flat, no real card
background" when first reported (a direct quote: "the cards in the grid you currently have dont
look like cards they need a background") — their own card fill was never actually applying either,
for the identical reason; tiles also gained a 1px `surface-hover`-colored border on top of the fix,
for crisp card definition even in whichever of the 30 presets happen to keep `surface` and
`background` very close in value (several do, by design).

**Verified for real, on the actual device** (adb/scrcpy over USB, per
[[android-device-verification-possible]]) at every step, not just reasoned through — this is
exactly the kind of bug no amount of `expo export --platform ios/android` bundle-compiles-clean
checking would ever catch, since it's a runtime styling behavior, not a build error: the red/static
test isolating the actual bug; the real redesign (accent Community banner, bordered surface tiles,
all legible) rendering correctly afterward across at least two different active presets; all three
floating tab bar destinations (Home/Community/Profile) navigating correctly and showing the right
active state via `usePathname()`; the tab bar correctly persisting across in-app navigation
(visible on a pushed tool-detail screen, none of the three tabs active, as expected) and correctly
hidden behind the opened drawer; and `ToolGrid`'s scroll content clearing the floating bar with
clean space at the very last row, confirming the `bottomInset` prop actually does its job. `tsc`
and `eslint` both clean, and all three `expo export --platform {web,ios,android}` bundle cleanly
afterward, with `/profile` now showing up as a genuine fourth static route.

This exact "does the floating tab bar collide with a screen's own bottom-pinned content" concern
was real, not hypothetical — checked directly, right after writing it down as an open question
rather than left as a guess: `theme.tsx`'s own "Active theme" strip, already pinned to the bottom
of that screen, sat partially *underneath* the tab bar (the strip's own text, and part of the
"Monokai" preset row above it, visibly obscured). Fixed with `marginBottom: insets.bottom + 80` on
the strip itself (`useSafeAreaInsets`, the same input `FloatingTabBar.tsx`'s own `insets.bottom +
16` offset uses) — pushes the strip up to clear the bar instead of sitting under it, re-confirmed
on-device afterward showing clean separation between the two. `tool/[slug].tsx` wasn't similarly
checked (its content is short and top-anchored, a much lower-risk shape for this exact collision,
but genuinely not tapped through this round either). **Not verified**: iOS rendering/feel at all
(no device available this session); and genuine touch/swipe feel for the ripple effects and the
floating tab bar's own tap targets on a real finger rather than a scripted `adb` tap.

### Home collapsed into the menu, Convex actually connected, Profile made real, and the Metronome fully ported

Three direct follow-ups in one session: "I don't really want a home page at all, I want the menu
to be the home page, also remove the community link from the menu since its at the bottom, also I
want you to figure out how to get convex connected, also implement the profile page" — then,
separately, "fully implement the metronome... all the same features as the nextjs app but
optimized for mobile."

**Home *is* the menu now.** The separate hamburger-triggered drawer (`Sidebar.tsx`) is gone
outright, along with `MenuButton.tsx` and `DrawerController`/`react-native-drawer-layout` — `Home`
(`app/index.tsx`) now renders exactly what the drawer used to (wordmark, search, the tool grid,
a "Theme" row), since `FloatingTabBar` already gives Home its own permanent tab and nothing was
left for a second "get back to the menu" panel to do. Community is gone from the grid entirely too
(not just de-featured) — it has its own tab now, so a second entry in the list would just be a
duplicate. `_layout.tsx` simplified to a plain `Stack` + `FloatingTabBar`, no `Drawer` wrapper.

**Convex is genuinely connected**, not just planned: `apps/mobile` now depends on
`@jam-practice/convex` (the same backend `apps/web` already uses — one Convex deployment, not two)
via `@convex-dev/auth/react`'s `ConvexAuthProvider`, with an `expo-secure-store`-backed token
storage on native (that package's own doc comment is explicit that a browser-storage default
"must" be replaced for React Native) and a plain `localStorage` fallback on web specifically —
`expo-secure-store`'s own web implementation doesn't actually implement the method this storage
interface calls (confirmed directly: `ExpoSecureStore.default.getValueWithKeyAsync is not a
function`, a real thrown error, not a guess), and since web is this sandbox's own most reliable
verification path (see below), that fallback isn't optional polish — without it, every screen
crashed the moment anything touched auth, in a real browser.

**A real, easy-to-hit gotcha found and fixed along the way, saved to memory**
([[expo-dev-server-stale-env-vars]]): the dev server had been running continuously since early in
the session, *before* `.env.local`/`EXPO_PUBLIC_CONVEX_URL` ever existed. `npx expo start` reads
`.env.local` exactly once, at its own startup — adding the file afterward did nothing until the
process was actually restarted, so every screen in the running app was silently serving a 500
(`No address provided to ConvexReactClient`) for a while, invisible to `tsc`/`eslint`/`expo export`
(a fresh one-shot process each time, which always picks the env up fine) — exactly the kind of gap
this project's own usual verification habits don't catch, since none of them touch a long-running
dev server specifically. Fixed by killing and restarting it; worth checking for first next time
something that type-checks and bundles clean still behaves wrong at runtime.

**Profile is real, not a placeholder** (`app/profile.tsx`): email/password sign-in and sign-up with
the same `@convex-dev/auth` email-verification-code state machine `apps/web`'s own `AuthForm`
already uses (same backend, same `flow`/`step` shape, same honest-but-generic per-flow error
messages) — ported as a full screen instead of a flyout, since there's no sidebar for a flyout to
anchor to and `FloatingTabBar` already points straight here. Once signed in: who's signed in
(`@username` if claimed, else name/email) and a sign-out button. Deliberately scoped down from
web's fuller `/account` page for this pass — no password change, no Google linking, no account
deletion yet, and Google sign-in itself is deferred (on native it needs an in-app browser + deep-
link redirect handshake, a separate task from plain email+password) — real, documented gaps, not
forgotten corners.

**The Metronome is fully ported** — `app/tool/metronome.tsx`, shadowing the generic `[slug]`
placeholder for that one route (the exact mechanism this app's own placeholder screen was always
built to allow). Same settings shape, same tempo/meter math, same five click sounds, same
Structures (chained odd-meter sections) feature as `apps/web/components/Metronome.tsx` — the pure
logic (`@jam-practice/core/clickSounds`, `meterControls`, `meters`, `structure`) is pulled into the
shared package verbatim from the web files, the same "pull, don't push" rule this package has
followed since Phase 0, since this is the first time something outside `apps/web` has needed it.

**The one piece that couldn't just be ported: audio.** There's no Web Audio API on native — no
`AudioContext`, no `OscillatorNode` to synthesize a click's exact frequency on the fly the way
`apps/web/lib/clickEngine.ts` does. `scripts/generate-click-sounds.mjs` pre-renders one short WAV
per `CLICK_SOUNDS` entry at build time (baked with the *exact* exponential-decay envelope the web
engine's own `GainNode` ramp produces), each at that sound's own `accentFreq` — always the
*highest* of its three frequencies — so the lower `normalFreq`/`subFreq` can be reached at playback
time by pitch-shifting that one sample down via `expo-audio`'s `AudioPlayer.playbackRate`
(`shouldCorrectPitch: false`, so rate genuinely changes pitch rather than just speed) — the same
"one reference sample + playbackRate" trick `apps/web/lib/sampledTones.ts` already uses for
arbitrary note frequencies from a sparse sample set, and specifically rendering at the *highest*
frequency keeps every needed ratio comfortably inside `expo-audio`'s 0.1–2.0 range rather than
needing to exceed it. A small round-robin pool of `AudioPlayer`s per sound (not one) avoids an
audible cutoff when subdivisions retrigger faster than one click's own playback finishes — the same
voice-stealing idea a polyphonic synth uses. `lib/metronomeClickEngine.ts`'s own doc comment is
explicit about the one real, accepted precision gap this leaves versus web: scheduling happens
against wall-clock `Date.now()` (the same class of precision most JS-timer-based mobile metronome
apps use), not a sample-accurate audio clock, since `expo-audio` exposes no equivalent to
schedule a click for an exact future sample the way `osc.start(time)` does — tight under normal
load, but not literally sample-accurate, and not yet confirmed by ear on a real device.

**Two deliberate mobile-specific simplifications, not cut corners**: no continuous BPM/volume drag
slider (large ±1 steppers, direct numeric entry, and Tap Tempo instead — genuinely easier to hit
precisely with a finger than a log-scaled slider, and how most real mobile metronome apps are
built in the first place); and the Structure editor's form reordering is plain ‹ › move buttons
instead of the web version's drag-to-reorder gesture — a risk call, not a feature gap, made because
this session's own device connection was too unreliable to trust a hand-rolled touch-drag
implementation without being able to iterate against a real finger.

**Verified for real, end to end, in a real browser** — the phone's own USB connection dropped
again partway through this work (same flakiness as earlier in the session), so the nix-chromium +
playwright-core setup ([[browser-verification-possible]]) carried the *entire* verification load
this time, not just a spot-check: the full settings/tempo/sound UI renders with real values (not
just mounting — actual beat-level colors, the correct single "4" accent-grouping readout for the
default `[2,1,1,1]` accents, etc.); Start → Stop → Start toggling works; tapping a beat bar cycles
its level in the correct accent→muted→normal order and updates its own accessible label
immediately; enabling "Use a structure" swaps in the real `StructureEditor`, adding a section and
appending it to the form both work, expanding a section card reveals its own embedded meter
controls, and starting a structure-driven run correctly shows "Section A · bar 1 of 4"; zero
console/page errors through all of it. `tsc` and `eslint` are both clean, and all three
`expo export --platform {web,ios,android}` bundle cleanly, with the five generated WAV files
correctly showing up as real bundled assets for iOS/Android. **Not verified, and the one thing that
actually matters most here**: how any of this *sounds* — real native audio playback through
`expo-audio`'s actual native players (AVAudioEngine/AAudio under the hood, a genuinely different
code path from whatever `expo-audio` does on web, which is what the browser-based check above
exercised instead) has not been heard on a real device this session. The pitch-shifted click
timbres, the pool's voice-stealing at fast subdivisions, and the wall-clock scheduler's real-world
tightness are all reasoned through and internally consistent, but genuinely unconfirmed by ear.

**Two real on-device-only bugs, found the moment Jack actually ran it, neither catchable from this
sandbox**: (1) `AudioPlayer.playbackRate` is read-only at runtime — "Cannot assign to property
'playbackRate' which has only a getter" — despite its own type declarations showing it as a plain,
seemingly-settable `playbackRate: number` field sitting right next to the real setter,
`setPlaybackRate()`; fixed by calling that method instead of assigning the property directly. (2)
`BeatIndicator`'s active-bar highlight set `transform: active ? [...] : undefined` — RN's native
style validator crashed on the `undefined` branch ("Cannot read property 'forEach' of null" inside
`processTransform.js`), which only reproduces on a real device, not through `react-native-web`;
fixed by spreading the `transform` key in only when there's an actual value (`...(active ? {...} :
null)`), so the key is genuinely *absent* rather than present-with-an-undefined-value. Both
confirm the limits of this session's own web-only verification — neither would ever have surfaced
there.

**The pitch-shifting approach itself turned out to be wrong, not just unverified** — reported
directly once actually heard: "the click sounds weird and too beep like, it should be clicky." The
cause was exactly the risk its own doc comment had flagged, just bigger in practice than expected:
slowing `playbackRate` down to reach `normalFreq`/`subFreq` stretches a sample's *duration* right
along with its pitch, and since "normal" is the most commonly heard level (3 of 4 beats in the
default accent pattern), most clicks were audibly ringing out longer than intended — a soft beep,
not a short click. Fixed properly rather than tuned around: `scripts/generate-click-sounds.mjs` now
bakes all four `ClickVariant`s (`accent`/`normal`/`subAccent`/`subNormal`) as their own real files
per sound (20 total, still trivially small), each already at its own correct frequency *and*
length; the engine plays every one back at a flat rate of 1.0, no pitch-shifting, no duration
coupling, no `playbackRate` left anywhere in the engine at all. `@jam-practice/core/clickSounds`'s
`resolveMainBeatClick`/`resolveSubClick` now return which `ClickVariant` to play directly, so the
engine doesn't need to reverse-engineer "which file" from a frequency match.

Re-verified after all three fixes: `tsc`/`eslint` clean, all three `expo export` platforms bundle
cleanly with all 20 per-variant assets showing up as real bundled files, and a browser smoke-test
(Start → Stop, no console errors) confirms the engine rewrite didn't regress anything structurally.
**Still the one thing that actually matters most and still isn't confirmed**: whether the new
fixed-length-per-variant samples genuinely read as "clicky" rather than "beepy" now, by ear, on the
real device that reported the problem in the first place.

