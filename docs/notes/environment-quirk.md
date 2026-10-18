<!-- Moved word for word from the old single PROJECT.md (lines 8074–8082) on 2026-10-18. Older entries give paths relative to apps/web/ (or packages/convex/ for convex/...); see docs/notes/repo-structure.md. -->

## Environment quirk (may not apply on a different machine)

On the machine this was developed on, something outside of any explicit `git commit` call was
auto-committing file edits to `main` as Jack's own git identity — `git status` looked clean
mid-session even though a lot had just changed. If that's not the case on a fresh clone/machine,
don't assume it — check `git log`, but also remember to actually commit (and push, which needs
Jack's hardware security key and can't be done from a sandboxed/non-interactive session) when work
should be saved.

