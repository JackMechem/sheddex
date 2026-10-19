"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@jam-practice/convex/_generated/api";
import FollowLists from "@/components/FollowLists";
import LoadingSpinner from "@/components/LoadingSpinner";
import MyPostsTab from "@/components/MyPostsTab";
import PublicProfileEditor from "@/components/PublicProfileEditor";
import GoalDialog from "@/components/practicelog/GoalDialog";
import { SignInButtons } from "@/components/practicelog/ShedLogGate";
import ThemeModal from "@/components/ThemeModal";
import UserAvatar from "@/components/UserAvatar";
import ProfileBanner from "@/components/ProfileBanner";
import SwitchRow from "@/components/SwitchRow";
import { getServerThemeState, getThemeState, setPreset, subscribeTheme } from "@/lib/theme";
import { CUSTOM_THEME_ID, PRESETS, getPreset } from "@/lib/themes";
import { WEEKDAY_LETTER, formatMinutesShort } from "@/lib/practiceLog";
import { usePracticeLog } from "@/lib/usePracticeLog";
import TunesTab from "@/components/TunesTab";
import TunesToLearnTab from "@/components/TunesToLearnTab";
import {
  BookIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GoogleIcon,
  ListIcon,
  LogOutIcon,
  NoteIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from "@/components/tools";

/** `wide` widens the page to fit the Profile/Security/Danger zone sidebar layout (the signed-in
    view below); the loading and not-signed-in states stay at the original narrower width, since
    neither has anything to put a sidebar next to. */
function PageShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-6 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-16 ${
        wide ? "max-w-5xl lg:max-w-none lg:px-8" : "max-w-md"
      }`}
    >
      {children}
    </main>
  );
}

type AccountView = "profile" | "tunes" | "tunesToLearn" | "posts" | "following" | "practice" | "appearance" | "security" | "danger";

/** Turns a thrown Error into UI text — Convex actions surface a real message (e.g. our own
    "Enter your password to confirm."), but a wrong password comes back as a long, internal-
    looking Convex/Auth.js error, so anything that doesn't look like a short, deliberate message
    gets replaced with a plain one instead of leaking implementation detail. */
function friendlyError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message && err.message.length < 150 ? err.message : fallback;
}

/** Change password (accounts that already have one) or set one for the first time (a Google-only
    account adding a password so it can also sign in with email+password from then on) — same
    section, different verification underneath depending on `hasPassword`, but both now go
    through an emailed confirmation code before actually taking effect: step 1
    (`requestPasswordConfirmation`) verifies the current password if there is one and emails a
    code; step 2 (`confirmPassword`) takes that code plus the new password — which has been
    sitting in this component's own state the whole time, never sent anywhere in step 1 — and
    actually applies it. */
function PasswordSection({ hasPassword, email }: { hasPassword: boolean; email: string | null }) {
  const requestConfirmation = useAction(api.account.requestPasswordConfirmation);
  const confirmPassword = useAction(api.account.confirmPassword);
  const [step, setStep] = useState<"form" | "code">("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("form");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setCode("");
  }

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmNewPassword) {
      setError("New passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await requestConfirmation(hasPassword ? { currentPassword } : {});
      setStep("code");
    } catch (err) {
      setError(
        friendlyError(
          err,
          hasPassword ? "Couldn't verify your current password." : "Couldn't send a code.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await confirmPassword({ code, newPassword });
      reset();
      setSuccess(true);
    } catch (err) {
      setError(friendlyError(err, "Couldn't confirm that code."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 text-left">
      <div>
        <h2 className="text-lg font-semibold">
          {hasPassword ? "Change password" : "Set a password"}
        </h2>
        <p className="text-sm text-muted">
          {step === "code"
            ? `Enter the code we emailed to ${email ?? "your email"} to finish.`
            : hasPassword
              ? "Changing your password signs you out on every other device. We'll email a code to confirm it's really you."
              : `Lets you also sign in with ${email ?? "your email"} and a password, not just Google. We'll email a code to confirm.`}
        </p>
      </div>

      {step === "form" ? (
        <form onSubmit={onSubmitForm} className="flex flex-col gap-3">
          {hasPassword && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Current password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Confirm new password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && (
            <p className="text-sm text-accent">
              {hasPassword ? "Password changed." : "Password set — you can now sign in with it too."}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {hasPassword ? "Send confirmation code" : "Send code to set password"}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Confirmation code</span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !code}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
            >
              {hasPassword ? "Confirm password change" : "Confirm and set password"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Session-storage marker key for the "did Connect Google actually land on the same account"
    check — see the comment on `useGoogleLinkWarning` for why this needs a best-effort check at
    all instead of just trusting the redirect. */
const LINK_CHECK_KEY = "jam-practice-google-link-check";

/** After "Connect Google" redirects out to Google and back, this reports whether the Google
    account that came back actually landed on the *same* account (Convex Auth links by matching
    verified email — see `convex/account.ts`'s `setPassword` for the same mechanism from the other
    direction). If someone connects a Google account with a different email, Convex Auth doesn't
    error — it just signs into (or creates) a *different* account instead, which would otherwise
    be a silently confusing account switch. Records the email right before redirecting to Google;
    the *next* mount (a fresh page load once Google redirects back) reads it once via this lazy
    `useState` initializer, then derives the warning as a plain value compared against whoever's
    actually signed in — the effect below only clears the marker (a real side effect against
    sessionStorage), it never calls setState itself, so there's no render-cascading setState-in-
    effect for the same reason the "derive state during render, don't setState from an effect"
    rule exists. */
function useGoogleLinkWarning(userEmail: string | null | undefined) {
  const [pendingCheck] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(LINK_CHECK_KEY);
    } catch {
      return null;
    }
  });
  const [dismissed, setDismissed] = useState(false);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!pendingCheck || clearedRef.current || userEmail === undefined) return;
    clearedRef.current = true;
    try {
      sessionStorage.removeItem(LINK_CHECK_KEY);
    } catch {
      // ignore
    }
  }, [pendingCheck, userEmail]);

  const warning =
    !dismissed && pendingCheck && userEmail !== undefined && userEmail !== pendingCheck
      ? `That Google account uses a different email (${userEmail ?? "none"}) than this account (${pendingCheck}), so it signed in as a separate account instead of connecting to this one. To link Google here, use a Google account with the same email address as this account.`
      : null;

  function markPending() {
    if (!userEmail) return;
    try {
      sessionStorage.setItem(LINK_CHECK_KEY, userEmail);
    } catch {
      // ignore
    }
  }

  return { warning, dismissWarning: () => setDismissed(true), markPending };
}

function SignInMethodsSection({
  hasPassword,
  hasGoogle,
  userEmail,
}: {
  hasPassword: boolean;
  hasGoogle: boolean;
  userEmail: string | null | undefined;
}) {
  const { signIn } = useAuthActions();
  const disconnectGoogle = useAction(api.account.disconnectGoogle);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { warning, dismissWarning, markPending } = useGoogleLinkWarning(userEmail);

  async function onConnect() {
    setError(null);
    markPending();
    try {
      // Redirects the page; only resolves-without-navigating on a real failure.
      await signIn("google");
    } catch {
      setError("Couldn't start connecting Google.");
    }
  }

  async function onDisconnect() {
    setError(null);
    setSubmitting(true);
    try {
      await disconnectGoogle();
    } catch (err) {
      setError(friendlyError(err, "Couldn't disconnect Google."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 text-left">
      <div>
        <h2 className="text-lg font-semibold">Sign-in methods</h2>
        <p className="text-sm text-muted">
          {hasGoogle
            ? "Google is connected to this account."
            : "Connect a Google account so you can also sign in with it."}
        </p>
      </div>

      {warning && (
        <div className="flex flex-col gap-1 rounded-lg bg-background p-3 text-xs text-muted">
          <p>{warning}</p>
          <button
            type="button"
            onClick={dismissWarning}
            className="self-start font-medium text-foreground hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {hasGoogle ? (
        <>
          {!hasPassword && (
            <p className="text-xs text-muted">
              Set a password above before disconnecting Google, so you don&apos;t lose access to
              your account.
            </p>
          )}
          <button
            type="button"
            onClick={() => void onDisconnect()}
            disabled={!hasPassword || submitting}
            className="flex items-center justify-center gap-2 self-start rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
          >
            <GoogleIcon className="h-4 w-4" />
            Disconnect Google
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            Only links automatically if the Google account uses the same email address as this
            account{userEmail ? ` (${userEmail})` : ""} — a different Google account signs into a
            separate account instead.
          </p>
          <button
            type="button"
            onClick={() => void onConnect()}
            className="flex items-center justify-center gap-2 self-start rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            <GoogleIcon className="h-4 w-4" />
            Connect Google
          </button>
        </>
      )}
    </section>
  );
}

/** Password accounts go through an emailed confirmation code (`requestDeleteConfirmation` then
    `confirmDelete`) before anything is actually deleted; a Google-only account skips straight to
    deleting once "DELETE" is typed — the explicitly requested exception, since there's no
    password to gate a confirmation email behind and the typed confirmation is considered enough
    friction on its own for that case (`deleteAccount`, unchanged from before). */
function DeleteAccountModal({
  requiresPassword,
  email,
  onClose,
}: {
  requiresPassword: boolean;
  email: string | null;
  onClose: () => void;
}) {
  const requestConfirmation = useAction(api.account.requestDeleteConfirmation);
  const confirmDelete = useAction(api.account.confirmDelete);
  const deleteAccount = useAction(api.account.deleteAccount);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<"form" | "code">("form");
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function finish() {
    // The account's rows are already gone server-side at this point; sign out just clears this
    // device's cached token so the UI actually reflects that.
    await signOut();
    router.push("/");
  }

  async function onConfirmForm() {
    setError(null);
    setSubmitting(true);
    try {
      if (requiresPassword) {
        await requestConfirmation({ password });
        setStep("code");
      } else {
        await deleteAccount({});
        await finish();
      }
    } catch (err) {
      setError(
        friendlyError(
          err,
          requiresPassword
            ? "Couldn't verify your password."
            : "Couldn't delete your account.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirmCode() {
    setError(null);
    setSubmitting(true);
    try {
      await confirmDelete({ code });
      await finish();
    } catch (err) {
      setError(friendlyError(err, "Couldn't confirm that code."));
      setSubmitting(false);
    }
  }

  const canSubmitForm = requiresPassword
    ? password.length > 0
    : confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-label="Delete account"
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-5 text-left text-foreground shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold">Delete your account</h2>
          <p className="text-sm text-muted">
            {step === "code"
              ? `Enter the code we emailed to ${email ?? "your email"} to finish.`
              : "This permanently deletes your account and signs you out everywhere. It doesn't touch anything already saved on this device."}
          </p>
        </div>

        {step === "form" ? (
          requiresPassword ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Enter your password to confirm</span>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">
                Type <span className="font-semibold text-foreground">DELETE</span> to confirm
              </span>
              <input
                type="text"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          )
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Confirmation code</span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Cancel
          </button>
          {step === "form" ? (
            <button
              type="button"
              onClick={() => void onConfirmForm()}
              disabled={!canSubmitForm || submitting}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {requiresPassword ? "Send confirmation code" : "Delete my account"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onConfirmCode()}
              disabled={!code || submitting}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              Delete my account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3a9 9 0 000 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.4-4-7.8-9-7.8z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7" r="1" />
      <circle cx="15.5" cy="7.5" r="1" />
    </svg>
  );
}

type NavItem = { id: AccountView; label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "You", items: [{ id: "profile", label: "Profile", icon: UserIcon }] },
  {
    group: "Library",
    items: [
      { id: "tunes", label: "Tunes I Know", icon: ListIcon },
      { id: "tunesToLearn", label: "Tunes to Learn", icon: BookIcon },
    ],
  },
  {
    group: "Community",
    items: [
      { id: "posts", label: "Posts", icon: NoteIcon },
      { id: "following", label: "Following", icon: UsersIcon },
    ],
  },
  {
    group: "Preferences",
    items: [
      { id: "practice", label: "Shed Log", icon: CalendarIcon },
      { id: "appearance", label: "Appearance", icon: PaletteIcon },
    ],
  },
  {
    group: "Account",
    items: [
      { id: "security", label: "Sign-in & security", icon: ShieldIcon },
      { id: "danger", label: "Delete account", icon: TrashIcon, danger: true },
    ],
  },
];
const ALL_VIEWS = NAV.flatMap((g) => g.items.map((i) => i.id));
const isView = (v: string | null | undefined): v is AccountView => !!v && (ALL_VIEWS as string[]).includes(v);

/** The account settings page (`/account[?tab=…]`). A header card (picture, @username, email,
    public/private, sign-in methods, View profile, Sign out), then settings grouped in a left nav —
    You (profile), Library (Tunes I Know / to Learn), Community (posts, following), Preferences
    (the Shed Log's daily goal and sounds, the theme), Account (password and Google, delete). On a
    phone the nav is a list you tap into, with a back button. The section is kept in the address
    bar (`?tab=`), so other pages can link straight to one. Signed out it says so (no redirect). */
export default function AccountPage({ initialTab }: { initialTab?: string }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);
  const profile = useQuery(api.profiles.getMine, isAuthenticated ? {} : "skip");
  const providers = useQuery(api.account.linkedProviders);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [view, setView] = useState<AccountView>(isView(initialTab) ? initialTab : "profile");
  // Phones: the list of sections first, then one section with a back button.
  const [mobileOpen, setMobileOpen] = useState(isView(initialTab));

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname !== "/account") return;
    url.searchParams.set("tab", view);
    window.history.replaceState(window.history.state, "", url);
  }, [view]);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-6 text-left">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <UserIcon className="h-6 w-6 text-accent" /> Account
          </h1>
          <p className="text-sm text-muted">You&apos;re not signed in. Sign in to manage your profile, library and settings.</p>
          <SignInButtons />
        </div>
      </PageShell>
    );
  }

  const hasPassword = providers?.includes("password") ?? false;
  const hasGoogle = providers?.includes("google") ?? false;
  const username = profile?.username || null;
  const current = NAV.flatMap((g) => g.items).find((i) => i.id === view)!;

  function handleSignOut() {
    void signOut();
    router.push("/");
  }

  function pick(id: AccountView) {
    setView(id);
    setMobileOpen(true);
    window.scrollTo({ top: 0 });
  }

  return (
    <PageShell wide>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        <UserIcon className="h-6 w-6 shrink-0 text-accent sm:h-7 sm:w-7" /> Account
      </h1>

      {/* Who you are. */}
      <section className={`overflow-hidden rounded-3xl bg-surface ${mobileOpen ? "hidden sm:block" : ""}`}>
        <ProfileBanner banner={profile?.banner} className="h-24 sm:h-32" />
        <div className="-mt-12 flex flex-col gap-3 px-5 pb-5">
          <div className="flex items-start gap-3">
            <span className="relative z-10 rounded-full ring-[6px] ring-surface">
              <UserAvatar url={profile?.avatarUrl ?? null} size="xl" />
            </span>
            <div className="ml-auto flex shrink-0 gap-2 pt-14">
              {username && profile?.isPublic && (
                <Link href={`/u/${username}`} className="rounded-full bg-background px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
                  View profile
                </Link>
              )}
              <button type="button" onClick={handleSignOut} aria-label="Sign out" className="flex items-center gap-1.5 rounded-full bg-background px-3 py-2 text-sm font-semibold hover:bg-surface-hover sm:px-4">
                <LogOutIcon className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-2xl font-extrabold tracking-tight">{username ? `@${username}` : user?.name || "Your account"}</div>
            <div className="truncate text-sm text-muted">{user?.email ?? ""}</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-0.5 ${profile?.isPublic ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-background text-muted"}`}>
                {profile?.isPublic ? "Public profile" : "Private profile"}
              </span>
              {hasPassword && <span className="rounded-full bg-background px-2.5 py-0.5 text-muted">Password</span>}
              {hasGoogle && (
                <span className="flex items-center gap-1 rounded-full bg-background px-2.5 py-0.5 text-muted">
                  <GoogleIcon className="h-3 w-3" /> Google
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <nav aria-label="Account sections" className={`flex w-full flex-col gap-4 sm:sticky sm:top-6 sm:w-56 sm:shrink-0 ${mobileOpen ? "hidden sm:flex" : ""}`}>
          {NAV.map((g) => (
            <div key={g.group}>
              <h2 className="mb-1 px-3 text-xs font-semibold text-muted">{g.group}</h2>
              <div className="flex flex-col overflow-hidden rounded-2xl bg-surface sm:gap-0.5 sm:bg-transparent">
                {g.items.map((item, i) => {
                  const on = view === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pick(item.id)}
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 py-3 text-left text-sm font-semibold transition-colors sm:rounded-xl sm:py-2 ${i ? "border-t border-background sm:border-0" : ""} ${
                        on ? "sm:bg-accent/10 sm:text-accent" : item.danger ? "text-danger hover:bg-surface-hover" : "hover:bg-surface-hover sm:text-muted sm:hover:text-foreground"
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-auto sm:w-auto sm:bg-transparent ${item.danger ? "bg-danger/10" : "bg-accent/10 text-accent sm:text-current"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      <ChevronRightIcon className="h-4 w-4 text-muted sm:hidden" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`min-w-0 flex-1 flex-col gap-6 ${mobileOpen ? "flex" : "hidden sm:flex"}`}>
          <button type="button" onClick={() => setMobileOpen(false)} className="-ml-1 flex items-center gap-1 self-start rounded-full px-2 py-1 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground sm:hidden">
            <ChevronLeftIcon className="h-4 w-4" /> Account
          </button>
          <h2 className="text-xl font-extrabold tracking-tight sm:hidden">{current.label}</h2>

          {view === "profile" && <PublicProfileEditor />}

          {view === "tunes" && <TunesTab />}

          {view === "tunesToLearn" && <TunesToLearnTab />}

          {view === "posts" && <MyPostsTab />}

          {view === "following" && <FollowLists />}

          {view === "practice" && <PracticeSettings />}

          {view === "appearance" && <AppearanceSettings />}

          {view === "security" && (
            <>
              <PasswordSection hasPassword={hasPassword} email={user?.email ?? null} />
              <SignInMethodsSection hasPassword={hasPassword} hasGoogle={hasGoogle} userEmail={user === undefined ? undefined : (user?.email ?? null)} />
            </>
          )}

          {view === "danger" && (
            <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 text-left ring-1 ring-danger/30">
              <div>
                <h2 className="text-lg font-semibold text-danger">Delete your account</h2>
                <p className="text-sm text-muted">
                  Permanently deletes your account, your profile and posts, your Shed Log, recordings and everything synced. This can&apos;t be undone.
                </p>
              </div>
              <button type="button" onClick={() => setDeleteOpen(true)} className="self-start rounded-full bg-danger px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
                Delete my account
              </button>
            </section>
          )}
        </div>
      </div>

      {deleteOpen && <DeleteAccountModal requiresPassword={hasPassword} email={user?.email ?? null} onClose={() => setDeleteOpen(false)} />}
    </PageShell>
  );
}

function SettingsCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 text-left">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** The Shed Log's preferences: the daily goal (the full goal window), sounds, counting tool time. */
function PracticeSettings() {
  const log = usePracticeLog();
  const { data } = log;
  const [goalOpen, setGoalOpen] = useState(false);
  const by = data.prefs.goalByWeekday;
  const perDay = Array.isArray(by) && by.length === 7;
  return (
    <>
      <SettingsCard title="Daily goal" description="How much practice makes a full day. Hitting it fills the ring, stars the day and keeps the celebrations coming.">
        <div className="flex flex-wrap items-center gap-3">
          {perDay ? (
            <div className="flex gap-1">
              {by!.map((m, i) => (
                <span key={i} className="flex w-10 flex-col items-center rounded-xl bg-background py-1.5">
                  <span className="text-[11px] font-bold text-muted">{WEEKDAY_LETTER[i]}</span>
                  <span className="text-xs font-extrabold tabular-nums">{m > 0 ? m : "–"}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-3xl font-extrabold tabular-nums">{formatMinutesShort(data.prefs.dailyGoal)}</span>
          )}
          <span className="text-sm text-muted">{perDay ? "minutes, by weekday" : "every day"}</span>
          <button type="button" onClick={() => setGoalOpen(true)} className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            Change
          </button>
        </div>
      </SettingsCard>
      <SettingsCard title="While you practice">
        <SwitchRow label="Sounds when you check things off" checked={data.prefs.sounds} onChange={(sounds) => log.setPrefs({ sounds })} />
        <Link href="/shed-log" className="self-start text-sm font-semibold text-accent hover:underline">
          Open the Shed Log →
        </Link>
      </SettingsCard>
      {goalOpen && <GoalDialog data={data} onSave={log.setPrefs} onClose={() => setGoalOpen(false)} />}
    </>
  );
}

/** The theme: the current one, a few swatches to switch in one tap, and the full picker. */
function AppearanceSettings() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeState, getServerThemeState);
  const [open, setOpen] = useState(false);
  const name = theme.id === CUSTOM_THEME_ID ? "Custom" : (getPreset(theme.id)?.label ?? theme.id);
  return (
    <SettingsCard title="Theme" description="Colors for the whole site. Saved on this device.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PRESETS.slice(0, 10).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            aria-pressed={theme.id === p.id}
            className={`flex flex-col gap-1.5 rounded-xl p-2 text-left text-xs font-semibold ring-2 transition-colors ${theme.id === p.id ? "ring-accent" : "ring-transparent hover:ring-surface-hover"}`}
            style={{ background: p.colors.background, color: p.colors.foreground }}
          >
            <span className="flex gap-1">
              <span className="h-4 w-4 rounded-full" style={{ background: p.colors.accent }} />
              <span className="h-4 w-4 rounded-full" style={{ background: p.colors.surface }} />
            </span>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">
          Current: <strong className="text-foreground">{name}</strong>
        </span>
        <button type="button" onClick={() => setOpen(true)} className="ml-auto rounded-full bg-background px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
          More themes & custom colors
        </button>
      </div>
      {open && <ThemeModal onClose={() => setOpen(false)} />}
    </SettingsCard>
  );
}
