# Site settings (Account → Settings)

## 2026-10-19: a Settings group on the account page

Jack asked for a settings page for account holders with global settings for the whole site, the
theme picker moved onto it, built into the account page by extending the old "Preferences" group,
with as much as possible configurable: turning features off and changing defaults (hiding stats,
folding things by default).

**Where it lives.** The account page's nav group "Preferences" became **Settings**, with six
sections (`?tab=`): General (`general`), Appearance (`appearance`), Sidebar (`sidebar`), Dashboard
(`dashboard`), Tools (`tools`) and Shed Log (`practice`). `/settings[?tab=]` redirects to
`/account?tab=general` (or the given tab). The sections are in
`components/settings/SettingsSections.tsx`. Each card's options have a `?` that reveals their
descriptions (`HintsContext`), per the style guide.

**Storage.**
- `lib/siteSettings.ts`: `useSiteSettings()` over one synced key, `jam-practice-site-settings`
  (`useSyncedSettings`, so it follows the account). Every default is how the site behaved before.
  A copy goes to `jam-practice-site-settings-cache` in localStorage once the real values load;
  until then the hook returns that copy, so a reload doesn't flash the defaults.
  `cachedSiteSettings()` reads it for code outside React.
- `lib/display.ts`: device-only display settings (`jam-practice-display`): text size (root
  `font-size` %, everything is in rem) and "Less motion" (`html.less-motion`, see the end of
  `globals.css`). `DISPLAY_INIT_SCRIPT` is inlined in `app/layout.tsx` next to the theme's, so
  they're applied before paint. It's kept in a file with no React/Convex imports so the server
  layout can import the string.
- The theme stays device-only (`lib/theme.ts`, unchanged). `ThemeModal` was split: `ThemePicker`
  is the picker itself (inline on Appearance); `ThemeModal` wraps it in the dialog.
- Some switches write existing keys rather than new ones: tool stats → `jam-practice-tool-stats`
  `hidden`; tool time → the Shed Log's `prefs.trackTools`; the Shed Log's stats and day panel →
  `jam-practice-practice-log-view` (`showStats`, `dayHidden`; `VIEW_KEY`/`VIEW_DEFAULTS` are now
  exported from `PracticeLog.tsx`); the bug report button → `FeedbackFab`'s own key
  (`hideFeedbackFab` was added).

**What each setting does, and where it's read.**
- Clock 12/24 h: `setClock24` in `packages/core/practiceLog.ts` changes `formatTime`. It's a
  module flag set by `components/SiteSettingsEffects.tsx` (mounted in the root layout): from the
  cached copy when the module loads (before anything renders), then from the real value once
  `ready`. Calendar hour labels and the time picker's quick picks drop ":00" only before AM/PM
  (`/:00(?= )/`), so 24 h labels read "15:00". Mobile's default (12 h) is unchanged.
- Confetti and sparkles: `setCelebrationEffects` in `Celebrations.tsx` stops `burstAt` and the
  confetti rain; `html.no-confetti` hides `.confetti-piece` elsewhere (level complete). Toasts
  still show; sounds are the Shed Log's own setting.
- Features: Shed Log / Community / Lessons off hide them in the sidebar (the Shed Log card,
  Community and Lessons tiles), on the dashboard (Today's practice, Lessons) and the streak badge.
  The pages still open by URL. Nothing is deleted.
- Sidebar: "Start with tool groups folded" is the default for groups you haven't opened or closed
  yourself (`collapsedCategories[key] ?? site.sidebarCategoriesCollapsed`); Support row; streak
  badge (`StreakBadge`). Hidden tools (pill toggles by category) leave the sidebar and the
  dashboard's Favorites/Get started/All tools; a search still finds them.
- Dashboard: a switch per card (`DASHBOARD_CARDS`). The grid is now `grid-flow-row-dense` so a
  hidden card doesn't leave a hole.
- Tools: option descriptions shown by default (`useHints` in `lib/panels.ts`: panels now store
  `hints` "on"/"off"/"" alongside the old `showHints`; "" follows the setting); colorful option
  chips (`ToolLayout`'s `rewardOn`); explaining a page the first time (`useIntro`), and "Show them
  again" (`resetIntros()` clears `jam-practice-intros-seen`).
- Shed Log: "Opens on" Last used / Month / Week / Day (`PracticeLog` keeps the view picked in this
  visit in state; otherwise the setting, or the stored last view for "Last used").
- General → Reset settings puts `SITE_DEFAULTS` back (not the theme, display or other keys).

**Sidebar menus.** Signed in, the ⋮ menus' "Theme" item is now "Settings" (gear icon,
`GearIcon` added to `tools.tsx`) and goes to `/account?tab=general`. Signed out it's still "Theme",
opening the dialog, since the settings page is for account holders.

**Verified** in headless Chromium against the dev server, signed out with the account page's
sign-in check bypassed temporarily (so the synced path ran on localStorage): every tab at 1440
dark and two at 390 dark (no overflow, no console errors); hiding Metronome, folding groups,
hiding Support, turning off Community, two dashboard cards off, 24 h clock and Large text all
took effect on the dashboard and sidebar and survived a reload; the Shed Log opened on Day with
24 h times. **Not verified:** signed in (the account sync and the cache handoff on a fresh
device), real phones, light mode for every tab, hover styles.
