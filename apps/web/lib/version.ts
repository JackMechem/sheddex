/**
 * sheddex's version: semantic versioning (MAJOR.MINOR.PATCH), set in this app's package.json and
 * passed in at build time (next.config.ts). Bump PATCH for fixes, MINOR for new features, MAJOR
 * for 1.0 and breaking changes. `CHANNEL` says how finished it is ("beta" until 1.0) — see
 * CHANGELOG.md at the repo root.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const CHANNEL: "beta" | "stable" = "beta";

/** "v0.9.0 beta". */
export const VERSION_LABEL = `v${APP_VERSION}${CHANNEL === "beta" ? " beta" : ""}`;
