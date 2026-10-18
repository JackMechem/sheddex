<!-- Moved word for word from the old single PROJECT.md (lines 7123–7512) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

## Advanced layouts (tiling panes)

An opt-in tiling-window-manager-style arrangement for the main content area, built from a
reference screenshot (an old project of Jack's own — "put a button on the top right of every page
that opens the tool search menu for splitting or tiling the window... options to tile down or
right... resize the windows by clicking and dragging the edges... URL [should] correspond to
[the active pane]... disabled by default... option in the bottom of the sidebar"). Off by default
(`lib/useTilingLayout.ts`'s `enabled: false`), toggled from a new button at the bottom of both
sidebar footers (desktop and mobile), right under Theme.

**Data model** (`lib/tilingLayout.ts`, pure functions, no React) — a `PaneTree` is a binary tree:
a `PaneLeaf` (`{ id, href }`) shows one tool; a `PaneSplit` holds exactly two children, a
`direction` (`"row"` = tile right, `"col"` = tile down — deliberately only those two, matching the
request, which never asked for up/left), and a `[number, number]` `sizes` pair summing to 100.
`splitLeaf`/`removePane`/`resizeSplit`/`collectLeaves` are the whole API; `removePane` collapses a
closed leaf's parent split into just the surviving sibling (standard tiling-WM "close window"
behavior), returning `null` only when the closed leaf was the tree's only one.

**Why panes can't just be Next.js pages.** Next's App Router can only ever resolve and render one
route's page per request — there's no built-in way to have several different routes' pages
mounted simultaneously side by side. `lib/toolRegistry.tsx`'s `TOOL_COMPONENTS` sidesteps this: a
hand-written `href -> next/dynamic(() => import(...))` map (hand-written, not derived from
`NAV_LINKS` automatically, since `next/dynamic`'s `import()` needs a static, literal path for
webpack/Next to code-split correctly — it can't be built from a variable). `TILEABLE_LINKS` is
`NAV_LINKS` filtered down to just the hrefs in that map — deliberately every real tool and nothing
else (not `/account`, `/community`, or the legal pages), per an explicit scoping call. Every pane,
including the one whose href happens to match the real current URL, renders its tool directly from
this registry — `TilingLayout` never reads `children` at all while active (see `AppShell.tsx`,
below). This does mean Next still resolves/renders the Server Component tree for whatever route
`router.replace` lands on, even though the result is thrown away — an accepted, minor waste for an
opt-in "advanced" feature, not a bug.

**URL sync** ("whatever window is currently active, make the url correspond to it... so when
copied and shared it opens that tool") — `TilingLayout.tsx` tracks one `activePaneId`; focusing a
pane (clicking anywhere inside it, via `onPointerDownCapture` so it fires regardless of what the
mounted tool's own event handlers do internally), splitting (the new pane becomes active), or
closing (falls back to the first remaining leaf if the previously-active one was the one just
closed) all call `router.replace(href, { scroll: false })` — `replace`, never `push`, so tiling
around doesn't flood the back button with history entries, and only when the href actually
*changes* (an explicit guard in `focusPane`), so clicking around inside an already-active pane's
own UI doesn't spam the router on every click. A copied link only ever restores that **one** tool
normally — never the saved tiled arrangement itself, which is deliberately not encoded in the URL
at all, just this browser's own `localStorage` (same category as the sidebar's width/theme — a
device preference, not account data, so it isn't synced).

**Persistence** (confirmed with Jack before building it, over resetting each page load) —
`lib/useTilingLayout.ts` is the exact same module-level-cache + listener-`Set` +
`useSyncExternalStore` pattern `components/Sidebar.tsx`'s own width/collapsed store already uses,
under its own `jam-practice-tiling` key. The tree is seeded (a single leaf showing wherever you
currently are, not some fixed default tool) the first time `TilingLayout` ever mounts with no tree
yet — i.e. the first time "Advanced layouts" is turned on, or after `localStorage` is cleared.

**Resizing** — `SplitContainer`'s divider is the same drag mechanics as `Sidebar.tsx`'s own resize
handle (`setPointerCapture`, an absolute pointer-position-to-size mapping recomputed on every
`pointermove` rather than a drag-origin delta), just computing a percentage of the split
container's own box instead of an absolute pixel width, clamped to 20–80% so neither side can be
dragged to nothing.

**The split picker** (`SplitPicker`, reached via a small button fixed to each pane's own top-right
corner — "put a button on the top right of every page," read as *every pane*, the way a real
tiling WM gives every individual window its own controls, not one single global button) is a
portaled, `getBoundingClientRect`-positioned popover — the exact anchoring technique
`components/Select.tsx` already uses, extended with a search box (reusing `tools.tsx`'s own
`filterLinks`, narrowed to `TILEABLE_LINKS`); the direction is already fixed by which edge button
opened it, so picking a tool immediately performs that split (superseded below — see "four direct
follow-ups" for how this moved from one corner button + a direction choice to four edge buttons).

**Mobile is now disabled outright, not a graceful fallback** (superseding the original
single-pane-fallback design described above — see "four direct follow-ups" below).

**Verified in a real browser** (the nix-chromium + `playwright-core`-over-CDP setup — see this
file's own Home-page bullet above for how that works): enabling the toggle, splitting right and
down, dragging the resize divider, clicking to refocus a different pane (confirmed the URL
actually changes), closing a pane (confirmed it collapses into its sibling and the close button
itself disappears once only one pane is left — a real bug caught this way: the close button
initially showed, and did nothing, even on a single un-split pane, since `canClose` was hardcoded
`true` for every leaf regardless of how many there were; fixed by threading a real
`collectLeaves(tree).length > 1` check down through `PaneNode`), reloading the page (confirmed the
whole tree, not just `enabled`, survives via `localStorage`), and turning "Advanced layouts" back
off (confirmed it cleanly reverts to the plain single-page view with zero leftover tiling UI) — all
checked directly, not assumed, with zero console errors throughout. `tsc`, `eslint`, and
`next build` all pass. **Not verified**: how well any given tool's own internal layout actually
holds up once squeezed into a narrow pane (the Tuner's own right-hand reference-pitch column, in
particular, visibly needed to horizontal-scroll inside a ~580px-wide pane during testing) — no
tool in this app was built with "might be rendered at less than its own natural width" in mind,
and making every one of them gracefully reflow that far down is its own, separate, unstarted
project, not something this feature attempted to fix. Also not verified: real touch/mobile drag
behavior on an actual phone (only checked via a simulated viewport width, which exercises the
`useIsDesktop` fallback path but not genuine touch input), and whether running the same
audio-heavy tool (e.g. two Metronomes) in two panes simultaneously behaves sensibly — `lib/
metronome.ts`'s `getAudioContext()` is a module-level singleton shared by every mounted instance
(the one `AudioContext` an audio-heavy app like this one is *supposed* to have per tab, not a
bug), so this should work, but it's never actually been tried with two real click engines running
at once.

**Four direct follow-ups, all from one round of feedback** ("you got the right idea, let's fix
some things"), landed on top of the design above:

1. **"Completely disable this feature on mobile, don't show the option in the menu."** The
   `useIsDesktop()` check moved from inside `TilingLayout` (where it used to fall back to a
   single-pane view) to `AppShell.tsx` itself, which now gates mounting `TilingLayout` at all on
   `enabled && isDesktop` — so even `enabled: true` left over in `localStorage` from an earlier
   desktop session renders as the plain, untiled page on a phone, not a degraded tiling view.
   `AdvancedLayoutsButton` itself is now only ever mounted in the desktop `<aside>` footer; the
   mobile menu's own footer lost its copy of the button entirely (it used to be there too). The
   `large` prop `AdvancedLayoutsButton` used to take for the mobile context is gone along with that
   call site, since the button is desktop-only now.
2. **"Instead of the button in the top right of every tool, put a little button in the middle of
   every side of the page/tool."** `Pane`'s single top-right split button became four small,
   hover-revealed buttons (`opacity-0 group-hover:opacity-100`, the same reveal-on-hover
   convention the sidebar's own favorite star already uses), one centered on each edge — which
   also means splits genuinely support all four directions now (up/down/left/right), not just the
   original two (right/down). `lib/tilingLayout.ts`'s `splitLeaf` signature changed from a
   `"row"|"col"` direction to a `PaneEdge` (`"up"|"down"|"left"|"right"`), deriving both the
   `"row"|"col"` direction *and* which child the new pane becomes (first or second) from which
   edge was clicked — "left"/"up" put the new pane before the existing one, "right"/"down" put it
   after. `SplitPicker` simplified to match: no more two icon buttons per result row (direction was
   already fixed by which edge button opened it), just one click per tool. One real React-Compiler
   lint catch fixing this: the original design read a ref (`buttonRefs.current[edge]`) *during
   render* to build the popover's anchor prop, which `react-hooks/refs` correctly rejects ("Cannot
   access ref value during render") — fixed by capturing the actual clicked button element
   straight from the click event (`e.currentTarget`) into a bit of state instead, so `SplitPicker`
   now takes a plain `anchor: HTMLElement`, not a ref object, and nothing reads a ref outside an
   effect/handler anymore.
3. **"For whatever window is active, the sidebar should reflect it, and I should be able to change
   the current active window's tool by clicking a nav link in the sidebar or by searching by
   pressing '/'."** The sidebar reflecting the active pane already worked (the active pane's href
   was always mirrored into the real URL via `router.replace`, which is what drives
   `NavItems`' own `pathname === href` highlighting) — what didn't work was the reverse direction.
   Clicking a sidebar `<Link>` or picking a `/`-palette result navigates through the *real* Next.js
   router, which `AppShell` completely ignores while tiling is active (see this section's own
   explanation above for why there's no way around that) — so before this fix, clicking a nav link
   silently changed the URL and did nothing visible at all. `TilingLayout` now has a second effect
   watching `pathname`: whenever it drifts from the active pane's own href, that's by definition an
   outside navigation (its own `router.replace` calls always leave the two in sync immediately
   after), so it retargets the active pane to the new href via the new `updateLeafHref` helper in
   `lib/tilingLayout.ts`. No feedback loop, since the effect is a no-op the instant the URL and the
   active pane's href agree — which is always true right after this component's own navigation
   calls.
4. **"When I initially turned the feature on, the tool I was using stopped displaying and there was
   text saying 'unknown tool'."** A real, reproduced-and-fixed bug: `TilingLayout`'s own
   tree-seeding effect only ever fires when there's *no* saved tree at all, so turning "Advanced
   layouts" back on after having used (and left) it earlier silently resumed whatever tree was
   last saved — the wrong tool, or "unknown tool" if that stale tree's href somehow no longer
   matched anything. Fixed at the source: `AdvancedLayoutsButton`'s own click handler now resets
   the tree explicitly, synchronously, at the exact moment "Advanced layouts" is turned on —
   reading `usePathname()` right there and seeding a single fresh pane from wherever you currently
   are (falling back to `TILEABLE_LINKS[0]` if you happen to enable it from a page that isn't a
   tool at all, e.g. the home page), so every time you turn it on you get exactly the page you're
   looking at, never a resurrected old arrangement. `TilingLayout`'s own seeding effect is now just
   a fallback for the rare case this didn't already run first. The "unknown tool" message itself
   also got friendlier wording (acknowledging a tool can still go missing from a stale saved tree
   if `TOOL_COMPONENTS` itself ever loses an entry later) instead of being purely a dead end.

Verified with the same nix-chromium setup, working against the actual dev server this time (not
just synthetic scripts): enabling while actively on a real tool confirmed it keeps displaying, not
"unknown tool"; splitting right via the new edge button confirmed the URL and pane both update
correctly; disabling, navigating to a different tool normally, then re-enabling confirmed a fresh
single pane seeded from wherever you'd navigated to (not the old stale multi-pane arrangement — 0
close buttons present, proving it was genuinely a single fresh pane); clicking a sidebar nav link
while two panes were open confirmed only the *active* pane retargeted, the other left untouched;
pressing `/` and picking a search result confirmed the same; and loading the app at a phone
viewport with `enabled: true` already in `localStorage` confirmed the plain untiled page renders
regardless, with zero tiling UI present and "Advanced layouts" absent from the opened mobile menu
(a `getByText` match was still found in the DOM at that viewport, but confirmed via
`offsetParent !== null` to be the *desktop* sidebar's own copy — present but genuinely
`display: none`-hidden under the `hidden lg:flex` class at that width, not actually shown). One
pure test-environment artifact hit and resolved along the way, not an app bug: this headless
Chromium build still reports no hover capability at all (see this file's own Home-page bullet,
"Caveat found 2026-10-03"), so `group-hover`-gated edge buttons can't be visually hover-triggered
here, but they're still reachable and clickable via Playwright locators regardless of their
`opacity-0` state, which is what every edge-button check above actually exercised. `tsc`, `eslint`,
and `next build` all pass. **Not verified**: how the four hover-revealed edge buttons actually look
and feel to discover and click with a real mouse, since this sandbox still can't trigger `:hover`
to see them appear.

**Three more direct follow-ups, reported together**, after Jack actually clicked through the four
rounds above for the first time:

1. **"The right arrow is messed up"** (with a screenshot) — a real, confirmed-by-reading-the-path
   bug: `EdgeIcon`'s `"right"` SVG path was `"M5 12h14M19 12l-5-5M19 12l5 5"` — the second diagonal
   stroke (`l5 5`, a *relative* lineto) moved forward from the arrow's own tip instead of mirroring
   the first one backward, landing at `(24,17)`, just outside the 24×24 viewBox, instead of
   `(14,17)` — the same place `"up"`/`"down"`/`"left"`'s own (correct) arrowheads converge their
   two diagonals. One flipped sign (`l5 5` → `l-5 5`) fixed it; `"up"`/`"down"`/`"left"` were
   already correct (re-derived and checked by hand against the same pattern, not just assumed
   innocent because they weren't the one named).
2. **"When I click one of those I want the same search menu that shows when I press / ... to
   open."** The bespoke `SplitPicker` popover (its own small search box + results list, described
   in this section's earlier rounds above) is gone outright — an edge button now opens the *exact*
   `CommandPalette.tsx` every other search in this app already uses. `lib/useTilingLayout.ts`
   gained `pendingSplit: { paneId, edge } | null` (deliberately **not** persisted to
   `localStorage` — stripped out in `write()` before serializing, since a half-finished split
   request has no business surviving a reload) plus three functions: `requestSplit` (what an edge
   button calls — records the pending request, then `TilingLayout` dispatches
   `OPEN_PALETTE_EVENT` itself), `clearPendingSplit`, and `applyPendingSplit(href)` (what
   `CommandPalette.tsx`'s own `go()` now calls first on every pick — performs the split and
   returns `true` if there was a pending request, leaving `go()` to fall back to its own ordinary
   `router.push` only when there wasn't). This does make `CommandPalette.tsx` — previously a
   fully tiling-*unaware* component — lightly coupled to the tiling feature, but through exactly
   one conditional branch in `go()`, not logic spread across the file; the palette also swaps its
   placeholder to "Pick a tool to tile…" while a request is pending, and the palette's own `close()`
   now clears any pending request unconditionally (a pick already clears it itself, so this only
   actually matters for "opened an edge button's picker, then hit Escape instead" — otherwise a
   stale pending request could silently hijack the *next*, unrelated `/` search). A real lint catch
   along the way: the original `SplitPicker` design read a ref (`buttonRefs.current[edge]`) *during
   render* to build its anchor prop, which `react-hooks/refs` correctly flags ("Cannot access ref
   value during render") — moot now that `SplitPicker` is gone entirely, but worth remembering as
   the reason the edge buttons capture `e.currentTarget` from the click event itself rather than a
   ref if anything like this gets built again.
3. **"I also want all pages including community and account page to work."** `TOOL_COMPONENTS`
   (`lib/toolRegistry.tsx`) only ever covered the ~13 actual *tools* before this (an explicit
   scoping call from when this feature was first built) — meaning navigating to `/community` or
   `/account` while tiling was active hit the pane's own "this tool isn't available anymore"
   fallback, since neither had a registered component. Fixed by adding `"/"` (`Home`), `/community`
   (`Community`), and `/account` (`AccountPage`) to the registry — straightforward, since all three
   already follow the same "a page.tsx that just returns one component" shape every other
   registered tool does. `/privacy`, `/terms`, and `/credits` are still *not* registered, and
   documented as such directly in `toolRegistry.tsx` now — those three are the one different shape
   in this app (their content is written directly inline in their own `app/*/page.tsx` file, not a
   separate importable component at all), so registering them would mean first extracting that
   content into real components, a bigger change this round didn't attempt for three static prose
   pages unlikely to be tiled next to a practice tool anyway; visiting one while tiling is active
   still falls back to the same "not available" message. `TILEABLE_LINKS` (what actually populates
   the `/`-search results list, including when that same search is opened for a split) is still
   derived from `NAV_LINKS` alone, deliberately unchanged — Home and Account aren't `NAV_LINKS`
   entries and so still won't show up as *searchable*, same as Account was never globally
   searchable anywhere else in this app before now; being paneable and being searchable are
   different questions, and this request was about the former.

Verified against the real dev server with the same nix-chromium setup: the right-edge button's
icon, inspected close up (forced to `opacity: 1` + `transform: scale(4)` via an injected style tag,
since this headless build still can't trigger real `:hover` to reveal it — see this file's own
earlier caveat on that), is now a clean, symmetric arrow, matching the already-correct
up/down/left ones checked the same way; clicking an edge button opens a real `role="dialog"
aria-label="Search tools"` palette (not a custom popover) showing the "Pick a tool to tile…"
placeholder, and picking a result (Community, in the actual check) correctly splits the pane and
updates the URL to `/community`, with Community's own real UI rendering inside; and navigating
directly to `/account` while tiling is active now renders the real Account page (confirmed
correctly showing its signed-out empty state, not "unknown tool"). `tsc`, `eslint`, and
`next build` all pass, with zero console errors across every check. **Not verified**: whether
`/privacy`/`/terms`/`/credits` not being tileable actually reads as expected/acceptable rather than
as a surprise gap, and — the same running caveat every round of this feature has had — how any of
this genuinely looks and feels with a real mouse and real `:hover`.

**Two more direct follow-ups, reported together with a screenshot** ("the community and account
page have a little border they shouldn't have. also the search menu doesn't always open the tool
that I click on, uit seems to open a different tool than the one i select, this is a bug with
every instance of it"):

1. **The border.** Compared screenshots of Community and Metronome, each tiled as a lone,
   un-split pane — both showed the exact same subtle `ring-1 ring-inset ring-accent/40` outline,
   confirming this was never actually page-specific, just only noticed on whichever page happened
   to be open alone at the time. Root cause: `Pane`'s active-ring styling was gated on `active`
   alone (`active ? "ring-1 ring-inset ring-accent/40" : ""`), and a single, un-split pane is
   *trivially* always "active" — there's nothing else in the tree for it to not be the active one
   relative to — so the ring was unconditional whenever "Advanced layouts" was on at all, reading
   as an unwanted border rather than a useful indicator. Fixed by gating on `active && canClose`
   instead — `canClose` already means "more than one pane exists" (it's the same check that shows
   or hides each pane's own close button), so it doubles as "there's actually something to
   distinguish this pane *from*," which is the only time the ring means anything.
2. **The palette bug** — a real, pre-existing defect, not something introduced by any of the
   rounds above (it was simply exercised, and so noticed, more often once edge buttons started
   reusing the real palette). `Palette`'s `go(index)` indexed into `results` (`filterLinks(query)`'s
   flat return, in `NAV_LINKS`' own declaration order), but the `index` actually passed to `go()`
   on each row's `onClick` was assigned while iterating `groups` — `groupByCategory(results)`,
   re-sorted into `CATEGORIES`' *display* order (`["Community", "Timing & Tuning", "Ear Training",
   "Practice", "Audio"]`), which does not match `NAV_LINKS`' declaration order. Concretely:
   "Community" is the *last* entry in `NAV_LINKS` but renders *first* on screen (its category sorts
   first), so clicking it called `go(0)`, which resolved to `results[0]` — a *different* tool
   entirely. Every row whose rendered position didn't coincidentally match its `results` position
   was affected, which in practice was almost every row. Fixed by computing
   `const ordered = groups.flatMap((g) => g.items)` once — the actual on-screen order — and
   switching every consumer of `results`/`results.length` (`go`, the `activeIndex` clamp, the
   `ArrowDown` handler, and the "No tools found" empty check) to use `ordered`/`ordered.length`
   instead.

Verified against the real dev server with the same nix-chromium setup. For the border: forced
`"advanced layouts"` on with a single-leaf tree for `/community`, `/account`, and `/metronome` in
turn and confirmed, via both a DOM query for any element with `ring` in its class and a full-page
screenshot, that none show the ring anymore (screenshot of `/community` checked by eye too, not
just the DOM query); then forced a genuine two-pane split (`/jam-practice` + `/metronome`) and
confirmed via the same DOM query that *exactly one* element carries `ring-1 ring-inset
ring-accent/40` — proving the fix narrows the ring correctly rather than just removing it outright.
For the palette bug: scripted opening the palette (via the real `/` key, from `/jam-practice`) and
clicking six different results spanning every category — Community, Chord Charts, Recorder, Tuner,
Metronome, Scale Trainer — and confirmed each one navigated to exactly the URL that tool should own
(`/community`, `/chord-charts`, `/recorder`, `/tuner`, `/metronome`, `/scale-trainer`
respectively), with zero mismatches across all six, including "Community" specifically — the exact
row the bug's own reasoning above predicts would most reliably misfire under the old code, since
it's about as far as a row's `results`-order position and its on-screen position can diverge.
`tsc`, `eslint`, and `next build` all pass, with zero console errors. (One genuine false alarm
during this verification pass, not an app bug: an early version of the two-pane-split check fed a
malformed `PaneSplit` directly into `localStorage` — `{a, b, ratio}` instead of the real shape,
`{children: [PaneTree, PaneTree], sizes: [number, number]}` — which crashed `collectLeaves` with a
real `TypeError` and `__next_error__`'d the whole page; once corrected to the actual shape from
`lib/tilingLayout.ts`, it rendered and resolved cleanly, confirming the crash was a bad test
fixture, not a reachable app bug — nothing a real user's own `requestSplit`/`splitLeaf` path could
ever produce, since that always builds a well-formed tree.) **Not verified**: the same running
caveat as every round of this feature — how the now-correctly-gated ring and the now-correct
palette picks actually feel to use with a real mouse, since this sandbox still can't trigger real
`:hover`, only confirm the underlying DOM/behavior is right.

**Three more direct follow-ups, reported together with a screenshot** ("the x is positioned badly,
should go to the left a bit (this is only an issue for windows that are tiled to the right).
community and account page still have an accent border when active, remove that. also if i have 2
windows open, do something in a window like start a metronome, go to another window, the metronome
will keep going but if i go back to the metronome it will refresh the window and the metronome will
stop, this is true for every kind of page; try to find a way to not refresh windows when switching
active windows"):

1. **The close button's position.** `right-2 top-2` sits exactly where `AppShell`'s own
   `lg:rounded-xl` outer corner curves inward — only a problem for a pane tiled at the *right* edge
   of the whole tiling area, since that's the only position where the button's corner coincides
   with that curve rather than an internal (straight) divider line between sibling panes. Fixed
   with a slightly larger inset, `right-3 top-3` — a no-op everywhere else, which has plenty of
   room either way.
2. **The accent border, again.** The previous round's fix (gating the ring on `active && canClose`)
   was behaviorally correct — it only showed once there were genuinely 2+ panes — but a screenshot
   of Community tiled with a sibling showed it still there, doing exactly what it was designed to
   do, and that still read as an unwanted border rather than a useful indicator. Rather than tune
   it a third time, the whole `ring-1 ring-inset ring-accent/40` active-pane indicator was removed
   from `Pane` outright (`components/TilingLayout.tsx`) — the sidebar already reflects which pane
   is active (see the next point), so this wasn't the only way to tell, and clearly wasn't earning
   its keep against how often it got reported as a stray border.
3. **The real bug: focusing a pane stopped its audio.** Reproduced directly with the nix-chromium
   setup: start a metronome in one pane, click to focus a sibling pane (metronome keeps running,
   confirmed), click back to refocus the metronome's own pane — the "Stop" button silently reverted
   to "Start." Root-caused with targeted instance-id tracing (a `useRef` set once per real mount,
   logged on every render) added temporarily to `AppShell`, `Pane`, and `Metronome`: `AppShell` and
   `Pane` both stayed on the *exact same* component instance throughout — proving neither of them,
   nor anything above them in the tree, ever remounted — while `Metronome`'s own instance changed
   to a fresh one, and only at the exact moment `focusPane` called `router.replace(leaf.href)` to
   keep the address bar in sync. Narrowing further (also tracing `TOOL_COMPONENTS[href]`'s own
   object identity, which stayed referentially stable throughout) isolated it precisely:
   **navigating via Next's router to a URL matching an already-mounted `TOOL_COMPONENTS` entry
   remounts that specific tool's component, wherever it's currently rendered** — regardless of
   whether the navigation's *destination* is even the pane being focused (it's keyed to the href,
   not the pane) — independent of whatever internal Next.js/Turbopack mechanism actually causes
   this (not fully traced to source, but the *trigger* was conclusively isolated: calling
   `router.replace`/`push` to that href, full stop). Fixed by eliminating the trigger rather than
   chasing the exact internal cause: `lib/useTilingLayout.ts`'s new `syncAddressBar(href)` updates
   the address bar via the raw History API (`window.history.replaceState`) instead of Next's
   router — since `TilingLayout` always renders every pane itself from `TOOL_COMPONENTS`, Next
   never actually needs to fetch or render anything for a focus/close/split, so the address-bar
   update was always purely cosmetic (for copy-paste shareability) and never needed to go through
   Next's navigation machinery at all. `focusPane`/`closePane` (`TilingLayout.tsx`) and the
   split-apply branch of `CommandPalette.tsx`'s `go()` all switched to it; `useRouter()` became
   entirely unused in `TilingLayout.tsx` as a result and was dropped.

   This surfaced two real knock-on fixes, not just the one swap:
   - **The outside-navigation sync effect** (the one that retargets the active pane's tool when a
     sidebar Link or `/` search changes the *real* URL) used to compare `active.href` against
     `pathname` on *every* render, trusting any mismatch as "an outside navigation happened." Once
     `focusPane` stopped calling `router.replace`, that stopped holding: Next's own `pathname`
     (from `usePathname()`) no longer updates in response to our own focus changes at all, so
     merely focusing a different pane (changing `activePaneId`, which the effect also depends on)
     would leave `pathname` looking "stale" relative to the newly active pane's own href, and the
     effect would misfire, overwriting that pane's href with the stale value — silently turning the
     pane you just focused into whatever tool the URL last *really* navigated to. Fixed by tracking
     the last `pathname` value this effect actually saw (`lastSeenPathnameRef`) and only reacting
     when `pathname` itself has genuinely changed since then, not merely whenever it fails to match
     the active pane — which only happens from an actual Next router transition (a Link, `/`
     search, or browser back/forward), exactly the case this effect exists to catch.
   - **The sidebar's own active-link highlighting** (`components/Sidebar.tsx`'s `NavItems`) was
     driven by `pathname === href` — which, for the identical reason above, stopped tracking pane
     focus changes once those moved off Next's router. Fixed by making it tiling-aware: while
     "Advanced layouts" is genuinely in effect (on, and desktop-sized — the same condition
     `AppShell.tsx` gates `TilingLayout` on), it reads the *active pane's own href* directly from
     `useTilingState()` instead of `pathname`; otherwise (tiling off, or on mobile where it's
     force-disabled) it falls back to plain `pathname`, unchanged from before.

   Verified against the real dev server with the nix-chromium setup, the same instance-id tracing
   methodology used to find the bug now used to confirm the fix: starting a metronome, focusing a
   sibling pane, and focusing back no longer changes the Metronome component's own instance id at
   all (previously confirmed via the same trace to always get a fresh one) — and functionally, the
   "Stop" button now stays "Stop" across a refocus instead of silently reverting to "Start."
   Separately confirmed: the sidebar now correctly re-highlights "Tuner" after focusing a Tuner pane
   (a scripted check reading which nav link currently carries the active styling, before and after
   a programmatic pane-focus click — matches "Metronome" before, "Tuner" after); no pane, single or
   tiled with a sibling, shows the removed ring/border anymore (a DOM query for any `ring-accent`/
   `ring-inset` class found only unrelated, legitimate `focus-visible:ring-accent` styling on
   existing buttons/inputs elsewhere on the page, confirmed by inspecting each match directly rather
   than trusting the count alone); and the close button's class list now reads `right-3 top-3` as
   intended. `tsc`, `eslint`, and `next build` all pass, with zero console errors throughout.
   **Not verified**: whether the close button's new inset is visually enough clearance from the
   rounded corner once actually seen (reasoned from the geometry, not measured against a render),
   and — the same standing caveat on this whole feature — how any of this feels with a real mouse,
   since this sandbox still can't trigger genuine `:hover`.

