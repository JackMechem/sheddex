"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CloseIcon } from "@/components/tools";

type Flags = {
  maintenance: boolean;
  maintenanceMessage: string;
  banner: string;
  bannerTone: "info" | "warning";
  communityOff: boolean;
  postingPaused: boolean;
  signupsPaused: boolean;
  uploadsPaused: boolean;
  feedbackPaused: boolean;
};
type BoolFlag = "maintenance" | "communityOff" | "postingPaused" | "signupsPaused" | "uploadsPaused" | "feedbackPaused";

const SWITCHES: { key: BoolFlag; title: string; what: string; when: string; severity: "red" | "orange" | "amber" }[] = [
  {
    key: "communityOff",
    title: "Community off",
    what: "Hides the feed, posts, public profiles, people search and shared setlist / routine links. Nothing is deleted; flip it back and it's all there.",
    when: "Someone's posting something awful and you can't clean it up right now.",
    severity: "orange",
  },
  {
    key: "postingPaused",
    title: "Pause posting",
    what: "Nobody can make new Community posts. Existing posts stay up. (Everyone's already limited to 10 posts a day.)",
    when: "A flood of spam posts, or a bug in posting.",
    severity: "amber",
  },
  {
    key: "signupsPaused",
    title: "Pause sign-ups",
    what: "No new accounts, by email or Google. Existing accounts sign in as usual, and every tool still works without an account.",
    when: "Bots are making accounts, or you've hit the email limit.",
    severity: "amber",
  },
  {
    key: "uploadsPaused",
    title: "Pause uploads",
    what: "No new files: recordings, songs, pictures, banners, lesson files, hand-ins, screenshots. Files already uploaded still play and show.",
    when: "Storage is filling up fast, or someone's uploading things they shouldn't.",
    severity: "amber",
  },
  {
    key: "feedbackPaused",
    title: "Pause feedback",
    what: "Closes the feedback form and hides the bug button. (Signed-out feedback is already capped at 30 an hour site-wide.)",
    when: "The inbox is being spammed.",
    severity: "amber",
  },
];

const TONE = {
  red: { on: "bg-rose-600", ring: "ring-rose-500/50", glow: "shadow-[0_0_40px_-8px_rgba(225,29,72,0.6)]", text: "text-rose-600 dark:text-rose-400" },
  orange: { on: "bg-orange-500", ring: "ring-orange-500/50", glow: "shadow-[0_0_40px_-8px_rgba(249,115,22,0.55)]", text: "text-orange-600 dark:text-orange-400" },
  amber: { on: "bg-amber-500", ring: "ring-amber-500/50", glow: "shadow-[0_0_40px_-8px_rgba(245,158,11,0.5)]", text: "text-amber-600 dark:text-amber-400" },
};

function BigSwitch({ on, onClick, disabled, color }: { on: boolean; onClick: () => void; disabled: boolean; color: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? color : "bg-foreground/15"}`}
    >
      <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${on ? "left-8" : "left-1"}`} />
    </button>
  );
}

/**
 * Admin → Mayday: the site's emergency switches (`packages/convex/lib/site.ts`). Only the owner can
 * flip them; other admins can see what's on. Everything is enforced on the server and reversible.
 */
export default function Mayday() {
  const data = useQuery(api.admin.siteSwitches, {});
  const role = useQuery(api.admin.myRole, {});
  const set = useMutation(api.admin.setSiteFlags);
  const reset = useMutation(api.admin.resetSiteFlags);
  const signOutAll = useAction(api.admin.signEveryoneOut);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; word: string; action: () => Promise<unknown> }>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [maintText, setMaintText] = useState<string | null>(null);

  if (!data || role === undefined)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  const f = data.flags as Flags;
  const owner = role === "owner";
  const anyOn = f.maintenance || SWITCHES.some((s) => f[s.key]) || !!f.banner;
  const flip = (patch: Partial<Flags>) => void set({ patch }).catch((e: Error) => setMsg(e.message));
  const bannerDraft = banner ?? f.banner;
  const maintDraft = maintText ?? f.maintenanceMessage;

  return (
    <div className="flex flex-col gap-5">
      {/* Status strip */}
      <div className={`flex flex-wrap items-center gap-3 rounded-3xl p-4 ring-1 ${anyOn ? "bg-rose-500/10 ring-rose-500/30" : "bg-emerald-500/10 ring-emerald-500/25"}`}>
        <span className="relative flex h-3 w-3">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${anyOn ? "bg-rose-500" : "bg-emerald-500"}`} />
          <span className={`relative inline-flex h-3 w-3 rounded-full ${anyOn ? "bg-rose-500" : "bg-emerald-500"}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{anyOn ? "Mayday measures are on" : "All systems normal"}</p>
          <p className="text-xs text-muted">
            {data.updatedAt
              ? `Last changed ${new Date(data.updatedAt).toLocaleString()}${data.updatedBy ? ` by ${data.updatedBy}` : ""}`
              : "Nothing has ever been switched."}
            {!owner && " · Only the owner can flip these."}
          </p>
        </div>
        {anyOn && owner && (
          <button type="button" onClick={() => void reset()} className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90">
            Everything back to normal
          </button>
        )}
      </div>
      {msg && (
        <p className="flex items-center justify-between rounded-2xl bg-danger/10 px-4 py-2 text-sm text-danger">
          {msg}
          <button type="button" onClick={() => setMsg(null)} aria-label="Dismiss">
            <CloseIcon className="h-4 w-4" />
          </button>
        </p>
      )}

      {/* The big one */}
      <section
        className={`relative overflow-hidden rounded-3xl p-5 ring-1 transition-shadow sm:p-6 ${
          f.maintenance ? `bg-zinc-950 text-white ring-rose-500/60 ${TONE.red.glow}` : "bg-surface ring-foreground/5"
        }`}
      >
        {f.maintenance && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ background: "repeating-linear-gradient(135deg, #e11d48 0 14px, transparent 14px 28px)" }}
          />
        )}
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-bold ${f.maintenance ? "text-rose-300" : TONE.red.text}`}>The big red switch</p>
            <h2 className="text-2xl font-extrabold">Maintenance mode</h2>
            <p className={`mt-1 max-w-2xl text-sm ${f.maintenance ? "text-white/70" : "text-muted"}`}>
              The whole site shows a &quot;Back soon&quot; screen to everyone except admins (you can still sign in from it). The tools, Community, everything. Nothing is
              lost; flip it off and people carry on.
            </p>
          </div>
          <BigSwitch
            on={f.maintenance}
            disabled={!owner}
            color={TONE.red.on}
            onClick={() =>
              f.maintenance
                ? flip({ maintenance: false })
                : setConfirm({
                    title: "Take the whole site down?",
                    body: "Everyone who isn't an admin sees the maintenance screen until you switch it off.",
                    word: "maintenance",
                    action: () => set({ patch: { maintenance: true, maintenanceMessage: maintDraft } }),
                  })
            }
          />
        </div>
        <div className="relative mt-4 flex flex-col gap-2">
          <textarea
            value={maintDraft}
            onChange={(e) => setMaintText(e.target.value)}
            disabled={!owner}
            rows={2}
            maxLength={500}
            placeholder="sheddex is down for a little maintenance. Your stuff is safe — check back in a bit."
            className={`w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none ring-1 focus:ring-2 focus:ring-rose-500 ${
              f.maintenance ? "bg-white/10 text-white ring-white/15 placeholder:text-white/40" : "bg-background ring-foreground/5"
            }`}
          />
          {owner && maintText !== null && maintText !== f.maintenanceMessage && (
            <button
              type="button"
              onClick={() => {
                flip({ maintenanceMessage: maintText });
                setMaintText(null);
              }}
              className="self-start rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white"
            >
              Save message
            </button>
          )}
        </div>
      </section>

      {/* Smaller switches */}
      <div className="grid gap-3 md:grid-cols-2">
        {SWITCHES.map((sw) => {
          const on = f[sw.key];
          const t = TONE[sw.severity];
          return (
            <section
              key={sw.key}
              className={`flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-1 transition-shadow ${on ? `${t.ring} ${t.glow}` : "ring-foreground/5"}`}
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-lg font-extrabold">
                    {sw.title}
                    {on && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${t.on}`}>On</span>}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{sw.what}</p>
                </div>
                <BigSwitch on={on} disabled={!owner} color={t.on} onClick={() => flip({ [sw.key]: !on })} />
              </div>
              <p className="text-xs text-muted">
                <span className="font-semibold text-foreground">Use it when:</span> {sw.when}
              </p>
            </section>
          );
        })}

        {/* Banner */}
        <section className={`flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-1 ${f.banner ? "ring-sky-500/50" : "ring-foreground/5"}`}>
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold">
              Announcement banner
              {f.banner && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">Showing</span>}
            </h3>
            <p className="mt-1 text-sm text-muted">A message across the top of every page, e.g. &quot;Maintenance tonight at 9pm&quot;. People can close it.</p>
          </div>
          <textarea
            value={bannerDraft}
            onChange={(e) => setBanner(e.target.value)}
            disabled={!owner}
            rows={2}
            maxLength={300}
            placeholder="Heads up: …"
            className="w-full resize-y rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-foreground/5 focus:ring-2 focus:ring-accent"
          />
          {owner && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full bg-background p-1">
                {(["info", "warning"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => flip({ bannerTone: tone })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${f.bannerTone === tone ? "bg-foreground text-background" : "text-muted"}`}
                  >
                    {tone === "info" ? "Info" : "Warning"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!bannerDraft.trim() || bannerDraft.trim() === f.banner}
                onClick={() => {
                  flip({ banner: bannerDraft });
                  setBanner(null);
                }}
                className="rounded-full bg-sky-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {f.banner ? "Update" : "Show it"}
              </button>
              {f.banner && (
                <button
                  type="button"
                  onClick={() => {
                    flip({ banner: "" });
                    setBanner(null);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-background"
                >
                  Take it down
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* One-shot buttons */}
      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-5 ring-1 ring-foreground/5">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold">Sign everyone out</h3>
          <p className="mt-1 text-sm text-muted">
            Ends every session on every device, except yours. For when an account or password might have leaked. People just sign in again; no data is touched.
          </p>
        </div>
        <button
          type="button"
          disabled={!owner}
          onClick={() =>
            setConfirm({
              title: "Sign everyone out?",
              body: "Every account (except yours) is signed out on every device right now.",
              word: "sign out",
              action: async () => setMsg(`Signed out ${await signOutAll()} session(s).`),
            })
          }
          className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40"
        >
          Sign everyone out
        </button>
      </section>

      {confirm && <TypedConfirm {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function TypedConfirm({ title, body, word, action, onClose }: { title: string; body: string; word: string; action: () => Promise<unknown>; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-overlay sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex w-full flex-col gap-4 rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Type <code className="self-start rounded bg-background px-1.5">{word}</code> to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="rounded-xl bg-background px-3.5 py-2.5 text-sm outline-none ring-1 ring-foreground/5 focus:ring-2 focus:ring-rose-500"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-background">
            Cancel
          </button>
          <button
            type="button"
            disabled={typed.trim().toLowerCase() !== word || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await action();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0] : "Something went wrong.");
                setBusy(false);
              }
            }}
            className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "Working…" : "Do it"}
          </button>
        </div>
      </div>
    </div>
  );
}
