<!-- Moved word for word from the old single PROJECT.md (lines 736–1342) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

### A new, generalized tool-screen layout: no scrolling, essentials on the main display, everything else in a tabbed sheet

A direct follow-up, explicitly meant to apply to every future mobile tool, not just this one: "make
it so that the options for the metronome (all all tools in the future for the mobile app) are in
some kind of menu drawer. I want the mobile app to avoid scrolling on main tool pages. the tool
should have the most common options built into the main display of the tool... and everything else
will be in a menu that can be opened with a button somewhere and that menu will have tabs for the
different sections."

**`components/ToolOptionsSheet.tsx` is the new, generic piece** — a hand-built `Modal` + dimmed
backdrop + sliding-up panel (not a native bottom sheet; same "fully native looks generic" steer as
the rest of this redesign), taking a `tabs: {key, label, content}[]` prop. The tab row itself only
renders when there's more than one tab, so a simpler tool with one options group doesn't show a
pointless single-tab row. Each tab's own content scrolls independently inside the sheet — "avoid
scrolling" was specifically about a tool's *main* page, not its secondary options, which are
expected to scroll normally once there's more than a screen's worth, the same as any settings panel.

**The Metronome screen itself was restructured around it, not just given a drawer bolted on**:
`MetronomeControls.tsx` split into main-display pieces (`TimeSignatureControls` — just the beats/
unit steppers, compact enough to sit directly under the tempo, per the request's own literal
example; `TempoControls` — BPM + steppers + Tap Tempo, with the note-value picker and conversion
hint pulled *out* into their own `TempoNoteValueControls`) and options-sheet pieces
(`TempoNoteValueControls`, `AccentAndSubdivisionControls`, `SoundOptions`) — `MeterOptions` (the
full bundle) is kept as its own unchanged export too, since `StructureEditor`'s own section cards
still want everything in one place and have no "main display" of their own to split fields out of.
The screen's main view is now a plain `View` (no `ScrollView` at all): a small Options button
(new `SlidersIcon`, top-right) opens the sheet with two tabs — "Meter" (subdivision, accent
grouping, tempo note value, the "Use a structure" toggle + `StructureEditor`) and "Sound" (tone +
volume) — while time signature, tempo, the beat indicator, and Start/Stop stay directly on the main
screen, now visually grouped as one centered cluster (`flex-1 items-center justify-center gap-10`)
rather than spread to the screen's own edges.

Verified for real, via the same nix-chromium + playwright-core setup carrying this whole session's
verification load: the main screen's `scrollHeight === clientHeight` at a real 390×844 phone
viewport (844 === 844, exactly) — no scrolling is actually possible, not just visually absent; the
Options button opens the sheet, both tabs switch correctly and show their own real content (Accent
grouping/Subdivision/Tempo note value/Use-a-structure on "Meter," Tone/Volume on "Sound"); zero
console errors throughout. `tsc`, `eslint`, and both native platform bundles are clean. **Not
verified**: how this feels to actually open/swipe/tap through on a real phone — the sheet's own
slide-up animation and backdrop-tap-to-dismiss are standard, well-understood RN `Modal` behavior,
but genuinely unconfirmed by touch in this session.

**A direct follow-up reordered the main screen and replaced the tempo-note-value picker's pill row
with a real dropdown**: "tempo note value should be above the tempo number and time signature
should be under tap tempo, tempo note value should be a drop down and it should have the Beat unit
option, the default option should be quarter." Three changes: `TempoNoteValueControls` (BPM's own
note-value picker) moved from the Options sheet's "Meter" tab onto the main screen, rendered
*first*, above `TempoControls`; `TimeSignatureControls` moved from first to last in the main-screen
cluster, now sitting directly below `TempoControls`'s own Tap Tempo button. New
`components/Dropdown.tsx` is a small, generic `Dropdown<T>` (a pill button showing the current
selection, opening a centered `Modal` list on tap — not an anchored popover measured off the
trigger's own layout, simpler to get right without a real device to iterate anchor math against) —
`TempoNoteValueControls` now renders through it instead of a row of pills, with options built from
`NOTE_VALUES` plus a `{value: null, label: "Beat unit"}` entry for the "match beat unit" default.
`tempoNoteValue`'s own default (`DEFAULT_SETTINGS.tempoNoteValue = 4`, quarter note) was already
correct from the original port and needed no change.

Verified the same way as every other round of this feature, via the nix-chromium +
playwright-core setup: at a real 390×844 viewport, `scrollHeight === clientHeight` still holds
(844 === 844, still no scrolling introduced); the rendered order reads dropdown → BPM/Tap tempo →
time signature steppers → beat indicator → Start, confirmed both via a body-text dump and two
screenshots; opening the dropdown shows "Beat unit" first, then every note value with "Quarter
note" correctly highlighted as the current selection; zero console errors. `tsc` and `eslint` both
clean, all native platform bundles export cleanly. **Not verified**: how the dropdown's modal-list
style (versus a true anchored popover) feels to open/tap through on a real phone.

**Two more direct follow-ups, reported together against a real device screenshot**: "put a label
on the options button. also can you vertically center the whole metronome thing so that the
bottom is the top of the bottom tab menu?" Both small, targeted fixes in `app/tool/metronome.tsx`:
the Options button (previously an icon-only round button) became a labeled pill — the same
`flex-row items-center gap-1.5 rounded-full px-4 py-2` shape `Dropdown.tsx`'s own trigger button
already uses, icon plus a "Options" `<Text>` — rather than inventing a new button shape. Separately,
the main centered cluster's `flex-1 items-center justify-center` previously centered against the
*full* screen height inside the `SafeAreaView`, which includes the area the floating tab bar
(`FloatingTabBar.tsx`, a global overlay sibling of `Stack` in `_layout.tsx`, not part of this
screen's own layout) visually sits on top of — so the true empty space actually usable for
centering was smaller than what React Native's centering math assumed, pulling the whole content
cluster visually low and unevenly balanced relative to the tab bar. Fixed with a new
`TAB_BAR_RESERVE = 80` constant (`FloatingTabBar.tsx`'s own gap-16 + pill-height-64, reasoned from
its real `h-12`/`p-2` classes, not guessed) applied as `paddingBottom` on the centered `View` —
`insets.bottom` itself is deliberately *not* added a second time here, since the screen's own
`SafeAreaView edges={['bottom']}` already reserves that separately; stacking both would have
double-counted it. This shrinks the box the centering math operates on to stop exactly at the tab
bar's own top edge, so the empty space above the dropdown and the empty space below Start are now
symmetric relative to that boundary, not the true (partly-hidden) screen bottom.

Verified against the real dev deployment via the nix-chromium + playwright-core setup: a 390×844
screenshot confirms the "Options" label renders next to the icon; and visually, the gap between
the top of the "Quarter note" dropdown and the header matches the gap between the bottom of
"Start" and the floating tab bar's own top edge, with the tab bar no longer visually crowding or
overlapping the Start button. `tsc` and `eslint` both clean, zero console errors. **Not verified**:
how this reads on a real device, where `insets.bottom` is actually nonzero (this headless browser
environment reports it as 0, so the real-device balance — while reasoned through the same way the
constant itself was derived — hasn't been seen with a genuine safe-area inset in the mix).

### The whole app switched from the system default font to Inter

A short back-and-forth over the Metronome's new "=" conversion hint (now just a bold "=" sign, no
BPM number or trailing text — two quick direct follow-ups: "no converted bpm, literally just a
bold equel sign," then "make it bigger and bold") led into a broader request: "i dont like the
font its using... can you use inter?" — confirmed, when asked, to mean **the entire app**, not just
that one hint.

**Nothing in this app had ever actually loaded a custom font before this** — `global.css`'s own
`--font-display` CSS variable (`Spline Sans, Inter, ui-sans-serif, ...`) was dead weight, grepped
for directly and confirmed to be referenced by zero `fontFamily` anywhere in `src/`; every screen
was rendering in whichever system default React Native falls back to (Roboto/San Francisco).

**The obvious fix doesn't work on this React Native version**: the usual "set a global default
font" trick, `Text.defaultProps.style = {...}`, no longer applies at all — confirmed directly by
reading RN's own `Text.js` source (`node_modules/react-native/Libraries/Text/Text.js`): `Text` is
now a plain function component, not a class, so it has no `defaultProps` mechanism for React to
merge in — and separately confirmed by `tsc`, which correctly refuses `Text.defaultProps` as a
type error (a first attempt at this hit exactly that error and had to be reworked). There's also no
CSS-style inheritance from a wrapping `<View>` the way a real stylesheet would give a whole page a
default font — RN `Text` only inherits style from an *ancestor `Text`*, never from a `View`.

**Fixed per-element instead, via NativeWind classNames** — `@expo-google-fonts/inter` (Inter_400
Regular/600SemiBold/700Bold/800ExtraBold, the four weights this app's own `font-bold`/
`font-semibold`/`font-extrabold`/unweighted classes actually need) is loaded once in `_layout.tsx`
via `useFonts`, gating the whole tree behind `if (!fontsLoaded) return null;` so the native splash
screen (already held via the existing `SplashScreen.preventAutoHideAsync()`) stays up rather than
flashing the system font for one frame before Inter swaps in. `tailwind.config.js` gained a
`fontFamily` extension mapping four new utility classes — `font-inter`/`font-inter-semibold`/
`font-inter-bold`/`font-inter-extrabold` — to the four loaded font names directly. Critically, a
single static-weight TTF has no synthetic-bold fallback the way a system font does (`fontWeight:
'700'` on a custom one-weight font just renders that font's only cut, not a bolded version of it),
so every one of this app's existing `font-bold`/`font-semibold`/`font-extrabold` classNames needed
its own matching `font-inter-*` companion to actually look bold rather than silently falling back
to Inter's regular-weight glyphs — grepped and confirmed mechanically (`perl -pi -e` across all 11
files using a font-weight utility) rather than left for `font-bold` to quietly lose its boldness
app-wide. Every remaining plain (unweighted) `<Text>`/`<TextInput>` — the ~28 left over, mostly
captions, hints, and small glyphs (`‹ › × − + ▾ ▸`) — got a `font-inter` companion class by hand
instead, one file at a time (`profile.tsx`, `theme.tsx`, `metronome.tsx`, `[slug].tsx`,
`index.tsx`, `Dropdown.tsx`, `MetronomeControls.tsx`, `StructureEditor.tsx`, `ToolGrid.tsx`), since
a blind regex over full JSX tags (several spanning multiple lines, several sharing identical
className text for genuinely different elements) was judged too fragile to trust unreviewed —
`BeatIndicator.tsx`'s one `Text` (a plain inline `style` object, no `className` at all) got
`fontFamily: 'Inter_700Bold'` added directly instead, matching its own existing mechanism. One
nested `<Text>` (inside the Structure "Section X · bar Y of Z" sentence) was deliberately **left
alone** — it's a child of another `Text`, which already inherits that parent's own weighted font
via RN's normal nested-Text style inheritance, so adding `font-inter` there would have wrongly
downgraded it back to regular weight.

A final automated sweep (a small Node script scanning every `<Text`/`<TextInput>` tag across every
file containing one) confirmed zero remaining tags without a `font-inter*`/`fontFamily` reference
— the four flagged "misses" it surfaced were all false positives from the script's own crude
regex (two were the `_layout.tsx` doc comment's own literal `` `<Text>` `` text, one was a
multi-line arrow function's `=>` token being mistaken for a tag's closing `>`, and one was the
deliberately-inherited nested Section/bar `Text` described above) — each checked by hand and
confirmed correct, not just dismissed.

Verified for real: `tsc` and `eslint` both clean across every touched file; all three
`expo export --platform {web,ios,android}` bundle cleanly, with the real `Inter_400Regular`/
`600SemiBold`/`700Bold`/`800ExtraBold` `.ttf` files (and their generated codepoint names) both
present as real bundled assets and referenced by name in the compiled web bundle — not just
assumed from the import succeeding. Against the real running dev server (nix-chromium +
playwright-core over CDP): `getComputedStyle().fontFamily` on the Metronome's "Options" pill
resolves to the literal string `Inter_700Bold`, the BPM hero number resolves to `Inter_800ExtraBold`,
and the Home screen's own "sheddex" wordmark resolves to `Inter_700Bold` — three different
components, two different weights, all genuinely rendering through the loaded Inter files rather
than a same-looking system-font coincidence; zero console errors throughout. A screenshot of the
Metronome screen confirms the same thing by eye. **Not verified**: how this looks/feels on a real
device (only react-native-web, through this sandbox's one working browser path, has actually been
seen) — whether Inter reads as a clear, intentional improvement over the system default once seen
on an actual phone, and whether any of the ~28 hand-edited "regular" spots were missed by eye
despite the automated sweep finding none.

### Offline-first account sync for tool settings, and a real account page

A direct request bundling three things together: "the options for metronome shuld be pulled from
the account that is signed in, along with all the other tools. i also want the tools to work if
offline so if the account data is noty avaliable resort to using whatever is stored on the device.
also make the account page more completed with all the same features as the nextjs app." Since
Metronome is still the only real ported tool on mobile (everything else is still `tool/[slug].tsx`'s
generic placeholder — see that section's own doc comment), "along with all the other tools" is
covered by building the *mechanism* generically now, applied to the one tool that exists; it'll
need no changes when a second tool lands.

**`lib/useSyncedSettings.ts` is not a straight port of `apps/web/lib/useSyncedSettings.ts`** — web
has no offline story at all (signed in, it reads *only* an in-memory/Convex cache, nothing ever
persists to `localStorage`), which doesn't satisfy "fall back to whatever is stored on the device"
for a cold, offline app launch. This hook always keeps `AsyncStorage` as a real local cache, signed
in or not, with a three-step precedence per settings `key`, reset at each sign-out so a different
account signing in later re-seeds fresh rather than quietly inheriting a previous session's cache:
1. `AsyncStorage`'s own stored value, applied the instant it loads — alone enough for a fully
   offline cold start, same as `lib/useDeviceSettings.ts` already was.
2. The account's own synced value (`convex/syncedSettings.ts`'s existing `get`/`set` — the same
   generic one-JSON-blob-per-`(user, key)` table every synced web tool already uses), applied
   **once**, the first time a real query result arrives — allowed to override #1 (a device's local
   cache might be stale relative to the account), but only up until #3.
3. A real local edit (`update()`), which always wins from then on for the rest of the session and
   blocks #2 from ever overwriting it later — the same "last touch wins, no merge" rule
   `apps/web/lib/syncedStore.ts` already documents for its own stale-closure-race fix, just with a
   local-storage read ahead of the server one instead of starting every signed-in session from
   nothing. A debounced (600ms) push to Convex fires on every edit while signed in, same
   module-level-cache-plus-single-collapsed-write shape as web's own fix for "adding several tunes
   quickly silently drops all but the last" — failures (genuinely offline, or any other rejection)
   are caught and ignored: the edit already landed in `AsyncStorage`, so nothing is lost, it just
   doesn't reach the account until the next successful write.

`lib/useSyncedTunes.ts` is the tune-list sibling — `createSyncedTuneListHook(key, accountOnly)` is
the one engine behind both `useSyncedTunes` (`"tunes"`, same key web's own Jam Practice list uses)
and `useTunesToLearn` (`"jam-practice-tunes-to-learn"`, `accountOnly: true` — matching web's own
`useTunesToLearn.ts`, this one has no signed-out local fallback at all, since the only way to ever
add to it is visiting someone else's public profile, which already requires being signed in).
`app/tool/metronome.tsx` switched from `useDeviceSettings` to `useSyncedSettings` as a one-line
swap — identical `[settings, update]` contract, nothing else in the component changed.

**One real import question, chased down rather than left ambiguous**: both new hooks pull
`useConvexAuth` from `@convex-dev/auth/react` (matching every other call site in this app) after
briefly importing it from plain `convex/react` instead — both actually work (traced through
`@convex-dev/auth/react`'s own `ConvexAuthProvider` source: it wraps children in its own
`AuthProvider` *and*, nested inside that, `ConvexProviderWithAuth` fed the same internal `useAuth`
hook, so the generic Convex-level auth context plain `convex/react` reads is populated from the
exact same state, not a different or stale one), but every other file in this app reaches for
`@convex-dev/auth/react`'s own copy, so this switched to match rather than leave one inconsistent
import source for a future reader to wonder about.

**The account page itself (`app/profile.tsx`) is now a real multi-section page**, not just sign-in
+ a bare signed-in summary — a horizontal pill tab bar (the same "pool of choices" convention this
app's option pickers already use) switches between five sections mirroring web's own
`AccountPage.tsx` sidebar nav:
- **Profile** (`components/account/ProfileTab.tsx`) — username (live availability check via
  `api.profiles.usernameAvailable`), a picture (`components/account/AvatarUpload.tsx`), instruments
  played (free-text chips + `@jam-practice/core/profileInstruments`'s suggestion list — moved there
  from `apps/web/lib/profileInstruments.ts`, the usual re-export shim left at that path, the first
  time something outside `apps/web` needed it), live tune/tunes-to-learn counts, and the public/
  private toggle (`components/SwitchRow.tsx`, new — RN's own native `Switch` instead of web's
  hand-built track/thumb). Same `upsertProfile`/`getMine` Convex functions web's own
  `PublicProfileEditor.tsx` uses, same "seed local form state once from the query, then the form
  owns it" pattern (the one legitimate `react-hooks/set-state-in-effect` exception, same as web's
  own version already documents).
- **Avatar upload** reaches for Expo's own platform facilities instead of web's `<canvas>`
  crop/resize: `expo-image-picker` (newly installed, with its own config plugin added to
  `app.json` for the iOS/Android photo-permission strings) gives a native square-crop UI at pick
  time (`allowsEditing: true, aspect: [1, 1]`), then `expo-image-manipulator` (also newly installed)
  resizes+compresses that already-square result down to a fixed 400px JPEG before the same two-step
  Convex upload flow (`generateAvatarUploadUrl` → POST → `setAvatar`) web already uses.
  `components/UserAvatar.tsx` (new, `expo-image` for its own disk/memory caching of the remote
  Convex-storage URL) is the shared "picture, or a plain fallback icon" renderer, same role as
  web's own.
- **Tunes** / **Tunes to Learn** (`components/account/TunesTab.tsx`/`TunesToLearnTab.tsx`, both
  thin wrappers around a shared `components/account/TuneListManager.tsx`) — search, add, edit
  (name/time signature/tempos/keys/notes), delete. The *same* `Tune` shape
  (`@jam-practice/core/types`, already shared) round-trips correctly either direction with web,
  including a tune's multiple possibly-enabled tempos/keys — just edited through one
  comma-separated text field each instead of web's own `TempoPicker`/`KeyPicker` chip UI.
  **Deliberately scoped down from web's `TuneListManager.tsx`, both documented in that file's own
  doc comment rather than silently dropped**: no jazz-standards picker (porting web's own ~630-song
  `lib/standards.ts` dataset and its search UI is a separate, sizeable task on its own — `+` here
  always opens a blank tune editor instead of a standards browser), and no CSV import/export or
  multi-select/bulk-delete (the latter existed on web mainly to support the former — a
  desktop-shaped feature with no obvious native-share-sheet equivalent attempted here yet; without
  it, bulk selection had little left to do).
- **Security** (`components/account/SecurityTab.tsx`) — change/set password, the same two-step
  emailed-confirmation flow as web (`requestPasswordConfirmation`/`confirmPassword`, the new
  password never leaving component state until the second call succeeds). **Google sign-in
  connect/disconnect is deliberately not ported** — Google itself still isn't wired up anywhere on
  mobile (needs an in-app-browser + deep-link redirect handshake, a separate, already-documented
  unstarted spike), so a "Connect Google" button here would have nothing to actually do.
- **Danger zone** (`components/account/DangerZoneTab.tsx`) — delete account, same two-path flow as
  web depending on `linkedProviders` (a password account needs the emailed-code confirmation;
  Google-only — not currently reachable on mobile in practice, but handled correctly regardless —
  just needs typing `DELETE`). Same `requestDeleteConfirmation`/`confirmDelete`/`deleteAccount`
  Convex actions, same sign-out-then-redirect-home finish.
- **Web's own "Following" tab is also deliberately not ported** — there's no way to follow anyone
  yet without a Community search or public-profile-viewing screen, neither of which exist on
  mobile yet, so an empty Following list here would have nothing real to show.

New shared primitives, each a native sibling of an existing web component: `ConfirmDialog.tsx` (a
real `Modal` instead of a `fixed inset-0` div), `LoadingSpinner.tsx` (a plain native
`ActivityIndicator` rather than reimplementing web's hand-animated beat-indicator-styled dots —
the platform's own spinner already reads as "native" the way that animation was built to read as
"on-brand," so there was nothing to gain copying it), and three new icons ported 1:1 from web's own
path data (`PlusIcon`, `TrashIcon`, `CheckIcon`, added to `icons.tsx`'s existing `strokeIcon`
helper).

Verified for real: `tsc` and `eslint` both clean across every touched/new file; all three
`expo export --platform {web,ios,android}` bundle cleanly; `apps/web`'s own `tsc` is unaffected by
the `profileInstruments.ts` move (confirmed directly, not assumed from the shim pattern alone).
Against the real running dev server (nix-chromium + playwright-core over CDP): the signed-out
`/profile` screen renders with zero console errors and the Sign in/Sign up toggle still works;
more importantly, a direct functional check of the new sync hook itself — bump the Metronome's BPM
by one, reload the whole page, confirm the new value survived — passed (100 → 101 → still 101
after reload), reading the actual `TextInput`'s DOM value directly rather than `body.innerText()`
(which, as this file's own earlier Metronome-dropdown verification already noted, never includes a
`TextInput`'s live value on react-native-web). **Not verified, and this is the big one**: none of
the actual signed-in behavior — this sandbox has no way to authenticate as a real user, so nothing
about the three-step AsyncStorage/server precedence, the debounced push actually reaching the
account, username availability checking live, the avatar upload round-trip, or any of the five
account-page tabs' own Convex calls succeeding end to end has been clicked through. Every one of
these is verified only as far as "type-checks against the real generated Convex API, and renders
with no console errors in whatever state is reachable signed out" — the same honest limit this
whole document has applied to every other signed-in Convex flow since Phase 1.

**Two real layout bugs in the new account page's own tab bar, both caught from real screenshots
and both root-caused rather than patched at the symptom.** First: every pill in the horizontal tab
row rendered as a tall vertical capsule instead of its own natural pill shape, and tapping a
different tab made *every* pill (not just the newly active one) grow tall. Root cause: a horizontal
`ScrollView`'s children default to `alignItems: 'stretch'` on the cross axis (the standard React
Native gotcha for exactly this symptom) — fixed by adding `alignItems: 'center'` to the tab row's
own `contentContainerStyle`. Second, immediately after that fix: a large empty gap appeared *above*
the tab row. Root cause, confirmed by reading RN's own `ScrollView.js` source directly rather than
guessing: `ScrollView` bakes in a default `flexGrow: 1` on its own outer wrapper regardless of
orientation — inside this screen's column layout, that made the *horizontal* tab-bar ScrollView
compete with the vertical content `ScrollView` below it for the column's own leftover height, so it
ballooned vertically with the (now correctly-sized, centered) pills floating inside a mostly-empty
box. Fixed with `style={{ flexGrow: 0, flexShrink: 0 }}` on the tab row's own `ScrollView` (the
`flexShrink: 0` added defensively after the first fix, once a synthetic test — see below —
confirmed `flexGrow: 0` alone already fully immunized the row against height changes in the content
below it). Verified both times via a temporary, deleted-after-use debug route
(`_debug-tabbar.tsx`, outside the real account page, so none of it needed real sign-in) rendering
the exact same tab-row JSX in isolation: the final check swapped the simulated content below
between 60px and 500px tall (mimicking Profile's brief loading-spinner moment vs. Tunes' fuller
list) and measured the tab row's own pill height via Playwright — exactly 32px in every case, no
squish, confirming the fix is robust rather than coincidentally working in whatever state the
screenshot happened to catch.

### Home's tool browser: a flat list (grid reserved for Favorites), real capitalization, and account-synced favorites

Three more direct requests landed together, all screenshot-driven: "make that search bar more
porportional so bigger text and less y padding. also get rid of the section logos and just have
the titles but make sure the titles are not all uppercase and just capitalized. Also I want all
the tools to be in a list not a grid, except for the favorites section which will be at the top in
a grid; there shuold be a way to favorite and unfavorite tools and make sure you get the favorites
from convex." This reverses the specific redesign an earlier round of this same file made (the
2-column icon-card grid, itself a deliberate departure from an even earlier flat list) — not a
contradiction, just the next round of the same "show Jack a screenshot, adjust" cycle this whole
migration runs on.

- **Search bar**: `index.tsx`'s own search pill went from `px-4 py-3`/`text-sm` to `px-4 py-2`/
  `text-base`, with the leading `SearchIcon` bumped `16 → 18` to stay proportional to the larger
  text — less vertical padding, bigger text, exactly as asked.
- **Category headers**: lost their small leading icon entirely, and the `.toUpperCase()` +
  `tracking-wide` styling that was making them shout — `@jam-practice/core/navLinks`'s own
  `CATEGORIES` array was *already* properly capitalized ("Timing & Tuning," not "TIMING & TUNING"),
  confirmed directly rather than assumed; the all-caps look was coming entirely from this
  component's own rendering, not the source data, so removing one `.toUpperCase()` call and one
  className was the whole fix. `CATEGORY_ICONS` (`icons.tsx`) became fully unreferenced once the
  header icon was dropped and was deleted outright rather than left as dead code, grepped first to
  confirm nothing else used it.
- **List, not grid, for everything except Favorites**: every category's own tools now render as
  plain rows (`ToolRow` — icon, name, a star toggle) via a straightforward `.map()`, not the
  previous `chunk(items, 2)`-into-card-rows grid. **Favorites** (new) renders *first*, still as the
  original 2-column `ToolTile` card grid — the one place that style still earns its keep, since a
  short, hand-picked set of favorites is exactly the "a few special things deserve more visual
  weight" case a card grid suits, unlike a long flat list of everything. Both `ToolRow` and
  `ToolTile` now carry a `StarIcon` toggle (filled once favorited, in the theme's own accent color)
  — nested inside each row/card's own `Pressable` (RN, unlike web's `<button>`-in-`<a>` DOM
  nesting rule, hit-tests touches to whichever interactive element is actually under the finger,
  so a star `Pressable` nested inside a row `Pressable` works correctly with no sibling-not-child
  workaround needed).
- **`lib/useFavorites.ts`** (new) is the native sibling of `apps/web/lib/useFavorites.ts` — the
  *same* fixed `"jam-practice-favorites"` `syncedSettings` key and `{hrefs: string[]}` shape, built
  on this app's own `useSyncedSettings` (already offline-first/AsyncStorage-backed), but
  **deliberately account-only, matching web's own explicit design choice rather than this app's
  usual offline-first default**: the returned `favorites` array is forced to `[]` whenever
  signed out, exactly like web's own doc comment reasons through ("which tools you reach for most
  is tied to *you*, not a particular device") — `useSyncedSettings`'s own `AsyncStorage` cache still
  exists underneath regardless, it's just never surfaced in this one case, same as web's own
  "technically still exists, never surfaced" note. A tool favorited on mobile shows up favorited on
  web too, and vice versa — one shared list, not a second mobile-only one.

Verified two ways. `tsc`/`eslint` clean, all three `expo export --platform {web,ios,android}`
bundle cleanly. Against the real running dev server (nix-chromium + playwright-core over CDP),
signed out: the new list renders with zero console errors, category headers read correctly
capitalized with no icon, every row shows its star, and tapping a star while signed out doesn't
crash (a real no-op, matching `useFavorites`'s own documented signed-out behavior — the tap does
write through `useSyncedSettings`'s local cache, but the hook's own forced-`[]` return while signed
out means nothing visibly changes, exactly as intended). Since the Favorites grid specifically
can't be seen this way (always empty signed out), it was verified separately by temporarily
hardcoding three fake `favorites` hrefs directly in `useFavorites.ts`, confirming via screenshot
that the grid renders at the top with filled stars and that the *same* three tools' star also
shows filled down in their own category rows below (proving both views share one real state, not
two that could drift) — then reverting the hardcoded value back to the real
`isAuthenticated ? hrefs : []` before moving on. **Not verified**: an actual signed-in
favorite/unfavorite round-trip actually reaching the account (same standing limit as every other
Convex-backed feature this session — this sandbox can't authenticate as a real user), and how the
list rows/star targets feel to tap with a real finger rather than a scripted click.

**A handful of quick follow-up polish passes on the same screen**, each confirmed with a real
screenshot: the search pill's own vertical padding went through several direct corrections in a
row (`py-2` → briefly `py-4` on a misreading of "match the left padding" → corrected to `py-1.5`
once Jack clarified he meant *less*, not matched to the horizontal padding → `py-1` on "slightly
less" again) — worth noting only because it's a reminder that "same as X" instructions can go
either direction, and the smart move once corrected was to just ask less and verify by eye each
time rather than keep re-guessing. The Home hero's own `Wordmark` grew from `height={30}`/
`text-lg` to `height={40}`/`text-2xl`. Category/Favorites section titles grew again, this time to
`text-2xl font-bold`, and moved *outside* their own rounded `surface` card (previously the first
line inside the card) per "make section titles much bigger and put them outside the background
container" — each card's own top padding adjusted from `p-3` to `px-3` (no more top/bottom padding
competing with the title that used to live there). A faint `surface-hover`-colored bottom border
was added between every `ToolRow` within one category's card (`showDivider`, `true` for every row
but the last) per "put faint separators between all the tools in the sections." Tool row labels
also dropped from `font-semibold` to plain `font-inter` (regular weight) per "make the tools text
less bold," and `ToolTile`'s own background moved from `colors.surface` (same as its new outer
card, which would've made the tile invisible against it) to `colors.background`, so the favorite
tiles now read as distinct cards sitting *inside* the Favorites card rather than blending into it.

### A real icon pack, replacing every hand-drawn SVG

A direct, pointed request: "can you use an actual icon pack? alot of the icons are just kinda
sketch." Fair — every icon in this app until now was a hand-drawn `react-native-svg` path, ported
1:1 from `apps/web/components/tools.tsx`'s own hand-drawn SVGs (themselves a from-scratch icon set,
not a real library either). `@expo/vector-icons` (newly installed — bundles `MaterialCommunityIcons`,
`FontAwesome5`, and several other icon families as real, professionally-designed icon fonts, the
standard icon package nearly every Expo app ships with) replaces all 27 of them.

**Every exported icon component kept its exact original name and `{color, size}` signature**
(`StarIcon` also kept its own `filled` prop) — this was purely an internal swap of *how* each icon
renders, not a new API, so every one of the 11 files importing from `icons.tsx` needed zero changes.
Two tiny factory helpers, `mci(name)`/`fa5(name)`, each return a component matching that same
signature, rendering a single `<MaterialCommunityIcons>`/`<FontAwesome5>` element — `FontAwesome5`
only for `DrumIcon`, the one icon `MaterialCommunityIcons` has no good glyph for (its own "drum"
matches only hit `food-drumstick`-family icons, not a drum kit); everything else is
`MaterialCommunityIcons`, which turned out to have a genuinely rich, on-the-nose catalog for a
music app specifically (`metronome`, `metronome-tick`, `waveform`, `ear-hearing`, `book-music`,
`piano`, `tune`/`tune-vertical`, ...). **Every glyph name was checked directly against the
installed package's own real glyph-map JSON** (`MaterialCommunityIcons.json`/`FontAwesome5Free.json`
under its real `node_modules` path) before use, not guessed from memory or a remembered icon-name
convention — a wrong name would render nothing (or silently fall back to a "?" box) with no type
error to catch it, since `name` only needs to be *some* real glyph, not necessarily the intended
one. A same-meaning substitution was chosen per tool rather than a literal one-for-one geometric
match to the old sketch (e.g. Scale Trainer's old "ascending staircase of bars" sketch became the
real `stairs` glyph; Interval Trainer's old "two dots joined by a line" became `ruler`, since an
interval is a distance; Tempo Trainer became `speedometer`).

Verified for real: `tsc` — notably, this alone confirms every one of the 27 glyph names used is a
*real* member of that icon family's own TypeScript glyph-name union, since `MaterialCommunityIcons`/
`FontAwesome5`'s own `name` prop is typed as a literal string union generated from the real font,
not a loose `string` — a typo would have been a compile error, not just a runtime blank icon. Also
clean: `eslint`, and all three `expo export --platform {web,ios,android}` bundles, with the real
`.ttf` font files for both families confirmed present in the bundled output (not just assumed from
the import succeeding). Against the real running dev server (nix-chromium + playwright-core over
CDP): a screenshot confirms every icon on the Home screen's tool list and floating tab bar renders
as a real, crisp vector glyph — not a missing-glyph "tofu" box, not blank — with zero console
errors. **Not verified**: how these look on true native iOS/Android specifically (`expo export`
only confirms each platform's bundle includes the right font files, not that they render
pixel-perfect on a real device), and whether any individual glyph choice reads as immediately
recognizable at a glance to someone who hasn't seen this list explained, versus merely "a
reasonable icon for the concept" on paper.

### A real EAS Build failure, root-caused and fixed (not worked around)

Jack's own first EAS Build attempt (`eas build --platform android --profile preview`, the
`eas.json` `"preview"` profile → a real, installable `.apk` rather than the Play-Store-only
`.aab` `"production"` would make) failed during Gradle's `:app:createBundleReleaseJsAndAssets`
task with `TypeError: Cannot read properties of undefined (reading 'transformFile')`, deep inside
`@expo/metro-config`'s own serializer (`packedMap.js`) calling back into a `Bundler` instance.

**Root-caused, not reasoned-around-blind** — this sandbox can't trigger a real EAS cloud build, so
getting this right the first time (rather than burning Jack's own build minutes on a guess)
mattered. A local `expo export:embed --platform android --bytecode --minify` (the same underlying
command the failing Gradle task runs) reproduced *nothing* — bundled clean every time — which
turned out to be the actual clue, not a dead end: `pnpm why metro` showed **two different `metro`
versions resolved in the same install**, `0.84.5` (reached via `@expo/metro@56.0.2`, what the rest
of the Expo SDK 57 toolchain actually uses) and `0.84.6` (reached via
`@react-native/community-cli-plugin@0.86.3`'s own dependencies). `pnpm peers check` confirmed the
proximate cause: `@react-native/metro-config` resolved to `0.87.1` where
`@react-native/community-cli-plugin@0.86.3` wants exactly `0.86.3` — and reading that plugin's own
`package.json` directly confirmed it *also* declares `"metro"`/`"metro-config"`/`"metro-core"`/
`"metro-resolver"` as a loose `"^0.84.3"` each, independently resolving to `0.84.6` even with the
`metro-config` mismatch fixed on its own. `expo export:embed` (my own local repro) goes through
`@expo/cli` directly, which only ever touches the *correct* `0.84.5` tree — explaining exactly why
it never reproduced the crash locally while the real Gradle task (which routes through
`@react-native/community-cli-plugin` instead) hit the mismatched one every time.

**Fixed with `pnpm-workspace.yaml`'s own `overrides` field** (not `package.json`'s `"pnpm"` key —
this sandbox's pnpm version, 12.3.4, warns that key is "no longer read," and moved the setting
here instead — worth knowing if a different pnpm version somewhere ever contradicts this), pinning
`@react-native/metro-config`, `metro`, `metro-config`, `metro-core`, and `metro-resolver` all to
the exact versions the rest of the Expo SDK 57 toolchain already uses. Confirmed directly after
reinstalling: `pnpm why metro` now shows exactly one resolved version everywhere in the tree, and
`pnpm peers check` reports zero issues (both empty before this was the point of confusion in the
first place). All three `expo export --platform {web,ios,android}` still bundle clean afterward,
same as before the fix — this change only removes a duplicate dependency tree, it doesn't touch
any application code. **Not verified**: whether this actually fixes the *real* EAS cloud build —
this sandbox still has no way to trigger one; Jack needs to re-run `eas build` himself and this is
the one thing in this whole section that's a strong, well-evidenced diagnosis rather than a
confirmed fix.

**The other line in that build log — "Deprecated Gradle features were used in this build, making
it incompatible with Gradle 10"** — is a *separate*, non-fatal warning, not what failed the build
(the Metro crash above is), and not something arising from any code in this repo: it's Gradle
commenting on its own Android Gradle Plugin/Gradle version, which comes entirely from Expo's own
`expo prebuild`-generated native Android project template for React Native 0.86.3 / Expo SDK 57 —
nothing this repo's own `apps/mobile` source controls directly. Deliberately not "fixed" by
pinning a different Gradle/AGP version by hand here — that's a deeper native-build-config change
with its own real risk of introducing a *new* incompatibility, and the warning itself doesn't
block a build the way the Metro crash did.

### Strategic pivot: Expo is mobile-only now, not a Next.js replacement

After the EAS build fix above, Jack reconsidered the original plan's own eventual goal ("get rid
of the Next.js site" — see this section's own earlier "look exactly the same" round) out loud and
asked for a second opinion; the call made was **Expo targets mobile only, permanently — the
Next.js web app stays as the real web product, unchanged, maintained in parallel.** This reverses
the specific thing that round's own doc comments assumed (`_layout.tsx`'s old comment explicitly
framed the responsive `isWide` branch as "match the web sidebar's own breakpoint," `MenuButton.tsx`
explained hiding itself on wide screens as "the sidebar's already permanently visible there") —
all of that reasoning is now gone, not just superseded, since there's no desktop-parity goal left
driving it.

**Everything "desktop-sized screen" shaped was removed, not just hidden**, in the same session this
decision was made: `apps/mobile/src/hooks/useIsWideScreen.ts` (the `min-width: 1024px` breakpoint
hook built specifically to answer "should the sidebar be permanent") and
`apps/mobile/src/app/menu.tsx` (a native-header-search screen that existed only as what a narrow
drawer pushed to instead of overlaying, back when `/menu` and the drawer were two different things)
are both deleted outright — `git rm`, not left unreferenced. `_layout.tsx`'s `Drawer` lost its
`isWide ? 'permanent' : 'front'` branch (always `drawerType="front"` now) and its fixed `width: 260`
drawer style (now `useWindowDimensions().width` — genuinely full-width, per a direct request: "the
menu should be full width," pointing at a screenshot of the old narrow 260px drawer as the thing to
fix). `MenuButton.tsx` lost its `if (isWide) return null` early-out — it always renders now, and
also gained a real SVG hamburger glyph (`icons.tsx`'s `MenuIcon`) in place of the `☰` text
character it used before, for the same cross-platform-font-rendering-consistency reason the close
button got a real `CloseIcon` SVG too instead of a bare `✕`.

### Home scoped down to hero + flat filtered tool list; the drawer redesigned to match the real web mobile menu

Two more pieces of the same request, both driven by reference screenshots rather than
re-approximated from memory: a mockup of the intended Home hero (hamburger, wordmark, tagline,
search bar — nothing else), a screenshot of the *then-current* (wrong) drawer — narrow, with a
description under every tool row — and a screenshot of the **real web app's own mobile drawer**,
used as the literal target: "sheddex" wordmark + close icon header, a rounded search box, Community
rendered as its own standalone row directly under search (no category header above it), then
normal categories (each with its own small icon next to the collapsible header) whose rows show
only an icon + name, no description, no trailing chevron.

- **`apps/mobile/src/components/icons.tsx`** is new — every icon `apps/web/components/tools.tsx`
  uses for `NAV_LINK_ICONS`/`CATEGORY_ICONS`, ported 1:1 from their exact `<path>` data (read
  directly out of the web source file, not redrawn from memory) into `react-native-svg`
  components. The one real porting difference: web's icons share one `svgProps()` helper that
  sets `stroke="currentColor"`, relying on ordinary CSS color inheritance from a parent's
  `className="text-foreground"` etc. — `react-native-svg` has no `currentColor`/CSS-inheritance
  equivalent, so every ported icon instead takes an explicit `color: string` prop, resolved by
  each caller from `useAppTheme().colors` (the same theme system already in place, just passed
  down as a value instead of inherited as a style). `react-native-svg` itself needed installing
  (`expo install react-native-svg`) — this app's first new native dependency since the NativeWind
  setup.
- **`ToolList.tsx`** dropped its per-row description `<Text>` and trailing `›` chevron entirely
  (a tool row is now just an icon + its name), added a leading icon per row and per
  category-header (via the new `icons.tsx` lookup tables), and — the Community-specific
  behavior — pulls the Community entry out of the filtered list *before* calling
  `groupByCategory` and renders it through the SectionList's own `ListHeaderComponent` instead,
  ahead of every other section, with no "COMMUNITY" category label above it — mirroring
  `PROJECT.md`'s own documented web behavior ("Community isn't a collapsible category like the
  others — a direct request to pull it out as its own always-visible item right under the search
  box"). `ToolList` also gained an optional `header?: ReactNode` prop specifically so the Home
  screen (below) can inject its own hero content as the *same* SectionList's scrolling header,
  rather than nesting a second scrollable `ScrollView` around it — avoids the nested-scroll-view
  footgun entirely rather than working around it after the fact.
- **`Sidebar.tsx`** (the drawer's content) lost its `dismissible` prop (always shows the close
  button now — there's no more permanent, non-dismissible mode to distinguish from) and gained a
  real search-icon-plus-input row (`SearchIcon` + `TextInput` inside one rounded `bg-background`
  pill, replacing a bare unstyled `TextInput`) matching the reference screenshot's own rounded
  search box.
- **`index.tsx`** (Home) is a near-total rewrite — stripped down to *only* the hero (hamburger +
  `Wordmark` + tagline + search bar) per the mockup, with every single thing the previous "look
  exactly the same as web desktop" round had added — `PreviewCluster` (the tappable tool-preview
  cards), the "Buy me a coffee" donate blurb, the accounts/Community explainer paragraph, and the
  footer (Made-by/GitHub/Privacy/Terms/Credits links) — deleted outright, not commented out or
  hidden. The search `TextInput`'s `value`/`onChangeText` now drives local `query` state passed
  straight into `<ToolList query={query} header={<hero JSX>} />`, so typing filters the real tool
  list rendered directly on the page — it no longer navigates to a separate `/menu` screen the way
  the previous version's search-bar-shaped `Pressable` did (that screen is gone — see above).

**Verified against a real running Expo web dev server** (the nix-chromium +
`playwright-core`-over-CDP setup this file documents elsewhere, pointed at `localhost:8081`, a dev
server already running — left it alone rather than restarting it, consistent with Jack having said
earlier in this same overall effort that he wanted to run/test the app himself): a 390px-wide
screenshot of Home shows exactly the requested shape (hamburger, wordmark, tagline, rounded search
bar, then the full flat tool list beginning with Community right underneath, no description text
anywhere); typing "chord" into Home's own search bar correctly narrows the list live to "Guess the
Chord" and "Chord Charts" under their real categories, with the hero staying pinned above it since
both scroll as one `SectionList`; clicking the hamburger button opens a genuinely full-width drawer
matching the reference screenshot's structure almost exactly — wordmark + close icon header,
rounded search box, Community as a standalone row with no category label, then icon-labeled
category headers (Timing & Tuning, Ear Training, Practice, Drummers, Audio) each holding
icon-plus-name-only rows, "Theme" still pinned at the bottom (a placeholder for where a signed-in
account footer will eventually go, since Convex Auth's own Expo integration — the migration plan's
spike #3 — is still unstarted); scrolling the drawer down confirms every remaining category
(Drummers, Audio) renders correctly with no layout breakage; and typing "tuner" into the *drawer's*
own search box correctly narrows it to just Timing & Tuning → Tuner, confirming both search boxes
filter independently and correctly. Zero console errors across every check. `tsc --noEmit` and
`eslint` are both clean on every touched file, and all three `expo export --platform
{web,ios,android}` bundle cleanly (`web`'s own route listing directly confirms `/menu` is gone and
no longer a static route). **Not verified**: genuine on-device rendering (still react-native-web
under this verification method, not true native iOS/Android — the three platforms were only
confirmed to *bundle*, matching this file's own standing distinction between "compiles" and
"renders correctly on-device" elsewhere), real touch/swipe gesture feel for the now-full-width
drawer, and how the drawer's close-icon/search-icon sizing and spacing read next to a real finger
on an actual phone screen rather than a simulated 390px CDP viewport.

**One leftover console warning, caught in the dev server log Jack pasted directly**: `props.
pointerEvents is deprecated. Use style.pointerEvents`, from React Native Web. `grep -rn
pointerEvents src/` found exactly one offender, `Wordmark.tsx`'s own waveform-bar overlay —
`pointerEvents="none"` passed as a plain prop rather than inside `style`. Fixed by moving it into
the existing `style={{ gap }}` object (`style={{ gap, pointerEvents: 'none' }}`) instead of a
separate prop — same behavior (the bar row stays click-through so it never intercepts taps meant
for whatever's behind/around it), just through the API React Native Web now expects. Verified
against the real running dev server (nix-chromium + playwright-core over CDP): captured every
console message on page load before and after the fix — the `pointerEvents`-deprecation warning is
gone, zero matches, 2 total console messages left (down from however many this one produced before,
not counted directly, but confirmed absent specifically rather than just "fewer logs overall").
`tsc --noEmit` and `eslint` both clean, and `expo export --platform web` still bundles cleanly.

