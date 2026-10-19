"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CapIcon, PersonBadge, errorText, field } from "@/components/lessons/parts";
import { AddToCalendar, SlotGrid, lessonEvent, localTz, slotLabel } from "@/components/lessons/schedule";
import { CheckIcon } from "@/components/tools";
import { zoneName, type Slot } from "@jam-practice/core/lessonSchedule";

/**
 * `/lessons/book?offer=` — the times a teacher emailed: pick one and it's booked (no sign-in
 * needed — the link is the key). Then the time, with Google Calendar / .ics buttons, and a way to
 * your lessons.
 */
export default function BookPage({ token }: { token: string }) {
  const { isAuthenticated } = useConvexAuth();
  const offer = useQuery(api.lessonSchedule.offer, token ? { token } : "skip");
  const book = useAction(api.lessonSchedule.bookOffer);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ slot: Slot; emailed: boolean } | null>(null);

  async function confirm() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await book({ token, start: picked.start, tz: localTz(), email: email.trim() || undefined });
      setBooked({ slot: picked, emailed: res.emailed });
    } catch (e) {
      setError(errorText(e, "Couldn't book that time."));
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 px-4 py-16">{children}</main>;

  if (offer === undefined && token)
    return shell(
      <div className="flex justify-center">
        <LoadingSpinner />
      </div>,
    );
  if (!offer)
    return shell(
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-8 text-center">
        <CapIcon className="h-8 w-8 text-accent" />
        <h1 className="text-xl font-extrabold">This link doesn&apos;t work</h1>
        <p className="text-sm text-muted">Ask your teacher to send you new lesson times.</p>
      </div>,
    );

  const lessonsHref = offer.joined ? `/lessons/teacher?id=${offer.lessonId}` : offer.inviteCode ? `/lessons/join?invite=${offer.inviteCode}` : "/lessons";
  const done = booked ?? (offer.booking && offer.booking.status === "confirmed" ? { slot: offer.booking, emailed: false } : null);
  const bookingId = offer.booking?.id;

  if (done)
    return shell(
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-6 sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{booked ? "You're booked!" : "This lesson is booked"}</h1>
          <p className="text-sm text-muted">With {offer.teacher.name}</p>
        </div>
        <p className="rounded-2xl bg-accent/10 px-4 py-3 text-lg font-bold text-accent">{slotLabel(done.slot)}</p>
        {booked && (
          <p className="text-sm text-muted">
            {booked.emailed ? "A confirmation with a calendar invite is on its way to your inbox." : `${offer.teacher.name} has been told.`}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-muted">Add it to your calendar</p>
          <AddToCalendar ev={lessonEvent({ id: bookingId ?? `${token}-${done.slot.start}`, ...done.slot }, offer.teacher.name)} />
        </div>
        {!offer.isTeacher && (
          <Link href={lessonsHref} className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent-hover">
            {offer.joined ? `Open ${offer.teacher.name}'s lessons` : "See your lessons on soniroll"}
          </Link>
        )}
      </div>,
    );

  const open = offer.slots.filter((s) => !s.taken);
  return shell(
    <div className="flex flex-col gap-5 rounded-3xl bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <PersonBadge url={offer.teacher.avatarUrl} name={offer.teacher.name} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-accent">Lessons on soniroll</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Pick a lesson time</h1>
          <p className="text-sm text-muted">
            {offer.teacher.name} offered {offer.studentName} {offer.slots.length === 1 ? "this time" : "these times"}
          </p>
        </div>
      </div>
      {offer.isTeacher && (
        <p className="rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          This is your own offer — send the link to {offer.studentName}.
        </p>
      )}
      {offer.message && (
        <blockquote className="rounded-2xl border-l-4 border-accent bg-background px-4 py-3 text-sm">
          {offer.message}
          <span className="mt-1 block text-xs text-muted">— {offer.teacher.name}</span>
        </blockquote>
      )}
      {offer.status === "withdrawn" ? (
        <p className="rounded-2xl bg-background p-4 text-sm text-muted">{offer.teacher.name} took these times back. Ask them for new ones.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Times in your time zone ({zoneName(localTz())})</p>
            <SlotGrid
              slots={offer.slots}
              selected={picked ? [picked.start] : []}
              onToggle={(s) => setPicked((p) => (p?.start === s.start ? null : s))}
              emptyText="No times here."
            />
            {open.length === 0 && <p className="text-sm text-danger">All of these times have passed or been taken — ask {offer.teacher.name} for new ones.</p>}
          </div>
          {!isAuthenticated && !offer.hasEmail && (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Your email <span className="font-normal text-muted">(for the confirmation and calendar invite)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={field} />
            </label>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={!picked || busy || offer.isTeacher}
            onClick={() => void confirm()}
            className="rounded-full bg-accent px-5 py-3 text-base font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
          >
            {busy ? "Booking…" : picked ? `Book ${slotLabel(picked)}` : "Pick a time"}
          </button>
        </>
      )}
    </div>,
  );
}
