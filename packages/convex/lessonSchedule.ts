import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { sendEmail } from "./lib/resend";
import { escapeHtml, featuresOf, personOf, sessionCancelled, sessionForBooking } from "./lessons";
import {
  base64Utf8,
  cleanAvailability,
  formatSlot,
  googleCalendarUrl,
  isOpenSlot,
  isValidTimeZone,
  lessonIcs,
  openSlots,
  slotsOverlap,
  zoneName,
  type Availability,
  type LessonEvent,
  type Slot,
} from "@jam-practice/core/lessonSchedule";

/**
 * Scheduling lessons. A teacher sets their usual teaching times (`lessonAvailability`); a student
 * can ask for one of the open times they give (a `requested` booking the teacher accepts or
 * declines), or a teacher can email a student a few times to pick from (`lessonOffers`, a link that
 * needs no sign-in) — picking one books it. Booked lessons are emailed to both with a calendar
 * invite (.ics) and a Google Calendar link; either can cancel, which emails the other.
 */

const MAX_OFFER_SLOTS = 24;
const MAX_PENDING_REQUESTS = 3;
const MAX_NOTE = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR = 3_600_000;

const slotArg = v.object({ start: v.number(), end: v.number() });

function site() {
  return (process.env.SITE_URL ?? "https://www.soniroll.com").replace(/\/$/, "");
}

function newToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

async function avRow(ctx: QueryCtx, teacherId: Id<"users">) {
  return ctx.db
    .query("lessonAvailability")
    .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
    .first();
}

function avFrom(row: Doc<"lessonAvailability"> | null): Availability | null {
  return row ? cleanAvailability(row, row.timeZone) : null;
}

/** The teacher's lessons (booked or asked for) from a day ago on — what new times mustn't overlap. */
async function busyOf(ctx: QueryCtx, teacherId: Id<"users">, now: number, except?: Id<"lessonBookings">): Promise<Slot[]> {
  const rows = await ctx.db
    .query("lessonBookings")
    .withIndex("by_teacher_start", (q) => q.eq("teacherId", teacherId).gte("start", now - 24 * HOUR))
    .collect();
  return rows.filter((b) => b._id !== except && (b.status === "confirmed" || b.status === "requested")).map((b) => ({ start: b.start, end: b.end }));
}

/** Who the caller is to a lesson: its teacher, its (joined) student, or nobody. */
async function roleIn(ctx: QueryCtx, lessonId: Id<"lessonStudents">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const row = await ctx.db.get(lessonId);
  if (!row) return null;
  if (row.teacherId === userId) return { row, role: "teacher" as const, userId };
  if (row.studentId === userId) return { row, role: "student" as const, userId };
  return null;
}

function validSlot(s: Slot) {
  const len = s.end - s.start;
  return Number.isFinite(s.start) && Number.isFinite(s.end) && len >= 10 * 60_000 && len <= 6 * HOUR;
}

function bookingView(b: Doc<"lessonBookings">) {
  return {
    id: b._id,
    lessonId: b.lessonId,
    start: b.start,
    end: b.end,
    status: b.status,
    source: b.source,
    note: b.note ?? null,
    reply: b.reply ?? null,
    cancelledBy: b.cancelledBy ?? null,
    createdAt: b.createdAt,
  };
}

// ---------------------------------------------------------------- availability (teacher)

export const myAvailability = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await avRow(ctx, userId);
    return row ? { ...avFrom(row)!, updatedAt: row.updatedAt } : null;
  },
});

export const saveAvailability = mutation({
  args: {
    timeZone: v.string(),
    windows: v.array(v.object({ weekday: v.number(), start: v.string(), end: v.string() })),
    lengthMin: v.number(),
    bufferMin: v.number(),
    noticeHours: v.number(),
    aheadDays: v.number(),
    blockedDates: v.array(v.string()),
    allowRequests: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to set your availability.");
    if (!isValidTimeZone(args.timeZone)) throw new Error("That time zone isn't one we know.");
    const clean = cleanAvailability(args, args.timeZone);
    const row = await avRow(ctx, userId);
    const doc = { ...clean, updatedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, doc);
    else await ctx.db.insert("lessonAvailability", { teacherId: userId, ...doc });
  },
});

// ---------------------------------------------------------------- reading

/** Everything scheduled across your lessons: as a teacher (requests to answer, upcoming lessons)
    and as a student (your lessons and requests, and times you've been offered). */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const now = Date.now();
    const teaching = (await featuresOf(ctx, userId)).scheduling
      ? await ctx.db
          .query("lessonBookings")
          .withIndex("by_teacher_start", (q) => q.eq("teacherId", userId).gte("start", now - 2 * HOUR))
          .collect()
      : [];
    const names = new Map<string, string>();
    const nameOf = async (id: Id<"lessonStudents">) => {
      if (!names.has(id)) names.set(id, (await ctx.db.get(id))?.name ?? "A student");
      return names.get(id)!;
    };
    const asTeacher = await Promise.all(
      teaching.filter((b) => b.status === "confirmed" || b.status === "requested").map(async (b) => ({ ...bookingView(b), studentName: await nameOf(b.lessonId) })),
    );
    const mine = await ctx.db
      .query("lessonStudents")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const asStudent = [];
    const offers = [];
    for (const row of mine) {
      if (!(await featuresOf(ctx, row.teacherId)).scheduling) continue;
      const teacher = await personOf(ctx, row.teacherId);
      const bookings = await ctx.db
        .query("lessonBookings")
        .withIndex("by_lesson", (q) => q.eq("lessonId", row._id))
        .collect();
      for (const b of bookings) {
        if (b.end < now - 2 * HOUR || (b.status !== "confirmed" && b.status !== "requested")) continue;
        asStudent.push({ ...bookingView(b), teacher });
      }
      const open = await ctx.db
        .query("lessonOffers")
        .withIndex("by_lesson", (q) => q.eq("lessonId", row._id))
        .collect();
      for (const o of open)
        if (o.status === "open" && o.slots.some((s) => s.start > now)) offers.push({ id: o._id, token: o.token, lessonId: row._id, teacher, count: o.slots.length });
    }
    asStudent.sort((a, b) => a.start - b.start);
    asTeacher.sort((a, b) => a.start - b.start);
    return { asTeacher, asStudent, offers };
  },
});

/** One lesson's schedule, for its teacher or student. */
export const forLesson = query({
  args: { lessonId: v.id("lessonStudents") },
  handler: async (ctx, { lessonId }) => {
    const who = await roleIn(ctx, lessonId);
    if (!who || !(await featuresOf(ctx, who.row.teacherId)).scheduling) return null;
    const now = Date.now();
    const rows = await ctx.db
      .query("lessonBookings")
      .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
      .collect();
    rows.sort((a, b) => a.start - b.start);
    const upcoming = rows.filter((b) => b.end >= now - HOUR && (b.status === "confirmed" || b.status === "requested"));
    const past = rows
      .filter((b) => b.end < now - HOUR && b.status === "confirmed")
      .slice(-5)
      .reverse();
    const recent = rows.filter((b) => (b.status === "declined" || b.status === "cancelled") && b.updatedAt > now - 14 * 24 * HOUR && b.start > now).slice(-5);
    const offers = await ctx.db
      .query("lessonOffers")
      .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
      .collect();
    const av = avFrom(await avRow(ctx, who.row.teacherId));
    return {
      role: who.role,
      teacher: await personOf(ctx, who.row.teacherId),
      studentName: who.row.name,
      upcoming: upcoming.map(bookingView),
      past: past.map(bookingView),
      recent: recent.map(bookingView),
      offers: offers
        .filter((o) => o.status === "open" && o.slots.some((s) => s.start > now))
        .map((o) => ({
          id: o._id,
          token: o.token,
          slots: o.slots.filter((s) => s.start > now),
          message: o.message,
          email: o.email ?? null,
          sentAt: o.sentAt ?? null,
          createdAt: o.createdAt,
        })),
      canRequest: !!av && av.allowRequests && av.windows.length > 0,
      hasAvailability: !!av && av.windows.length > 0,
      teacherTz: av?.timeZone ?? null,
      lengthMin: av?.lengthMin ?? 60,
      studentEmail: who.role === "teacher" ? (who.row.studentId && (await ctx.db.get(who.row.studentId))?.email) || who.row.inviteEmail || null : null,
    };
  },
});

/** The open times from the teacher's availability — what a student can ask for, or a teacher can
    offer. `lengthMin` defaults to the teacher's lesson length. */
export const freeSlots = query({
  args: { lessonId: v.id("lessonStudents"), lengthMin: v.optional(v.number()) },
  handler: async (ctx, { lessonId, lengthMin }) => {
    const who = await roleIn(ctx, lessonId);
    if (!who || !(await featuresOf(ctx, who.row.teacherId)).scheduling) return null;
    const av = avFrom(await avRow(ctx, who.row.teacherId));
    if (!av || av.windows.length === 0) return { slots: [], timeZone: av?.timeZone ?? null, lengthMin: av?.lengthMin ?? 60 };
    if (who.role === "student" && !av.allowRequests) return { slots: [], timeZone: av.timeZone, lengthMin: av.lengthMin };
    const now = Date.now();
    const len = lengthMin && lengthMin >= 10 && lengthMin <= 240 ? Math.round(lengthMin) : av.lengthMin;
    // The teacher can offer times inside their notice window; students can't ask for them.
    const rules = who.role === "teacher" ? { ...av, noticeHours: 1 } : av;
    const slots = openSlots(rules, await busyOf(ctx, who.row.teacherId, now), now, len).slice(0, 400);
    return { slots, timeZone: av.timeZone, lengthMin: len };
  },
});

/** An emailed offer — open to anyone with the link. Times already taken (or past) come back
    `taken`. */
export const offer = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const o = await ctx.db
      .query("lessonOffers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!o) return null;
    const row = await ctx.db.get(o.lessonId);
    if (!row) return null;
    const now = Date.now();
    const busy = await busyOf(ctx, o.teacherId, now, o.bookingId);
    const booking = o.bookingId ? await ctx.db.get(o.bookingId) : null;
    const userId = await getAuthUserId(ctx);
    return {
      teacher: await personOf(ctx, o.teacherId),
      studentName: row.name,
      message: o.message,
      status: o.status,
      slots: o.slots.map((s) => ({ ...s, taken: s.start <= now || busy.some((b) => slotsOverlap(b, s)) })),
      booking: booking ? { start: booking.start, end: booking.end, status: booking.status, id: booking._id } : null,
      isTeacher: userId === o.teacherId,
      joined: !!userId && row.studentId === userId,
      lessonId: row._id,
      inviteCode: row.studentId ? null : row.code,
      hasEmail: !!o.email || !!row.studentId || !!row.inviteEmail,
    };
  },
});

// ---------------------------------------------------------------- emails

type Party = { name: string; email: string | null; tz: string };

export const bookingInfo = internalQuery({
  args: { bookingId: v.id("lessonBookings") },
  handler: async (ctx, { bookingId }) => {
    const b = await ctx.db.get(bookingId);
    if (!b) return null;
    const row = await ctx.db.get(b.lessonId);
    if (!row) return null;
    const av = await avRow(ctx, b.teacherId);
    const teacherUser = await ctx.db.get(b.teacherId);
    const studentUser = row.studentId ? await ctx.db.get(row.studentId) : null;
    const tTz = av?.timeZone ?? b.studentTz ?? "UTC";
    const teacher: Party = { name: (await personOf(ctx, b.teacherId)).name, email: teacherUser?.email ?? null, tz: tTz };
    const student: Party = { name: row.name, email: studentUser?.email ?? b.studentEmail ?? row.inviteEmail ?? null, tz: b.studentTz ?? tTz };
    return {
      id: b._id,
      lessonId: b.lessonId,
      slot: { start: b.start, end: b.end },
      status: b.status,
      note: b.note ?? "",
      reply: b.reply ?? "",
      cancelledBy: b.cancelledBy ?? null,
      sequence: b.sequence,
      joined: !!row.studentId,
      inviteCode: row.code,
      teacher,
      student,
    };
  },
});

type Info = {
  id: Id<"lessonBookings">;
  lessonId: Id<"lessonStudents">;
  slot: Slot;
  status: Doc<"lessonBookings">["status"];
  note: string;
  reply: string;
  cancelledBy: "teacher" | "student" | null;
  sequence: number;
  joined: boolean;
  inviteCode: string;
  teacher: Party;
  student: Party;
};

function when(slot: Slot, tz: string) {
  return `${formatSlot(slot, tz)} (${zoneName(tz, slot.start)})`;
}

function shell({ kicker, heading, body, button, footer }: { kicker: string; heading: string; body: string; button?: { href: string; label: string }; footer?: string }) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:13px;font-weight:700;color:#6366f1;margin:0 0 8px">${escapeHtml(kicker)}</p>
  <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(heading)}</h1>
  ${body}
  ${button ? `<p style="margin:24px 0"><a href="${button.href}" style="background:#6366f1;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(button.label)}</a></p>` : ""}
  ${footer ? `<p style="font-size:12px;color:#999;margin-top:24px;line-height:1.5">${footer}</p>` : ""}
</div>`;
}

const p = (html: string) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${html}</p>`;
const quote = (text: string, who: string) =>
  `<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #6366f1;background:#f4f4f6;font-size:15px;line-height:1.5">${escapeHtml(text).replace(/\n/g, "<br>")}<br><span style="color:#666">— ${escapeHtml(who)}</span></blockquote>`;
const timeBox = (text: string) =>
  `<p style="margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#eef0ff;font-size:17px;font-weight:700;color:#3730a3">${escapeHtml(text)}</p>`;

/** Sends without throwing: the booking already happened, so a failed email is reported, not fatal. */
async function trySend(args: Parameters<typeof sendEmail>[0]): Promise<boolean> {
  try {
    await sendEmail(args);
    return true;
  } catch (e) {
    console.error("Lesson email failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

function eventFor(info: Info, forTeacher: boolean, cancelled = false): LessonEvent {
  const other = forTeacher ? info.student.name : info.teacher.name;
  return {
    uid: `${info.id}@sheddex.com`,
    slot: info.slot,
    title: `Lesson with ${other}`,
    description: forTeacher ? `Lesson with ${info.student.name} (soniroll).` : `Lesson with ${info.teacher.name} (soniroll).`,
    url: pageFor(info, forTeacher),
    sequence: info.sequence,
    cancelled,
  };
}

function pageFor(info: Info, forTeacher: boolean) {
  if (forTeacher) return `${site()}/lessons/student?id=${info.lessonId}`;
  return info.joined ? `${site()}/lessons/teacher?id=${info.lessonId}` : `${site()}/lessons/join?invite=${info.inviteCode}`;
}

function icsAttachment(ev: LessonEvent) {
  return [
    {
      filename: ev.cancelled ? "lesson-cancelled.ics" : "lesson.ics",
      content: base64Utf8(lessonIcs(ev)),
      contentType: `text/calendar; charset=utf-8; method=${ev.cancelled ? "CANCEL" : "PUBLISH"}`,
    },
  ];
}

/** "Lesson booked" to both, each with a calendar invite in their own time zone. */
async function sendConfirmed(info: Info) {
  const sent = { student: false, teacher: false };
  for (const forTeacher of [false, true]) {
    const to = forTeacher ? info.teacher : info.student;
    if (!to.email) continue;
    const other = forTeacher ? info.student.name : info.teacher.name;
    const ev = eventFor(info, forTeacher);
    const time = when(info.slot, to.tz);
    const gcal = googleCalendarUrl(ev);
    const text = [
      `Your lesson with ${other} is booked:`,
      "",
      time,
      ...(info.reply && !forTeacher ? ["", `“${info.reply}” — ${info.teacher.name}`] : []),
      "",
      "Add it to your calendar: open the attached lesson.ics, or use Google Calendar:",
      gcal,
      "",
      `Details: ${pageFor(info, forTeacher)}`,
    ].join("\n");
    const html = shell({
      kicker: "Lessons on soniroll",
      heading: `Lesson booked with ${other}`,
      body:
        timeBox(time) +
        (info.reply && !forTeacher ? quote(info.reply, info.teacher.name) : "") +
        p(`The calendar invite is attached (<b>lesson.ics</b>) — open it to add the lesson to Apple Calendar, Outlook or Google Calendar.`) +
        p(`<a href="${gcal}" style="color:#6366f1;font-weight:700">Add to Google Calendar →</a>`),
      button: { href: pageFor(info, forTeacher), label: forTeacher ? `Open ${other}'s page` : "Open your lessons" },
      footer: "Can't make it? You can cancel from your lessons page — they'll get an email.",
    });
    const ok = await trySend({ to: to.email, subject: `Lesson booked: ${formatSlot(info.slot, to.tz)}`, text, html, attachments: icsAttachment(ev) });
    if (forTeacher) sent.teacher = ok;
    else sent.student = ok;
  }
  return sent;
}

// ---------------------------------------------------------------- offers (teacher → student)

export const createOffer = internalMutation({
  args: { userId: v.id("users"), lessonId: v.id("lessonStudents"), slots: v.array(slotArg), message: v.string(), email: v.optional(v.string()), tz: v.string() },
  handler: async (ctx, { userId, lessonId, slots, message, email, tz }) => {
    const row = await ctx.db.get(lessonId);
    if (!row || row.teacherId !== userId) throw new Error("That student isn't one of yours.");
    if (!(await featuresOf(ctx, userId)).scheduling) throw new Error("Lesson booking is switched off in your lesson settings.");
    const now = Date.now();
    const clean = slots
      .filter(validSlot)
      .filter((s) => s.start > now)
      .sort((a, b) => a.start - b.start)
      .filter((s, i, a) => i === 0 || s.start !== a[i - 1].start)
      .slice(0, MAX_OFFER_SLOTS);
    if (clean.length === 0) throw new Error("Pick at least one time in the future.");
    // Keep a time zone on file for the teacher's emails, even before they set their hours.
    if (!(await avRow(ctx, userId)) && isValidTimeZone(tz)) {
      await ctx.db.insert("lessonAvailability", { teacherId: userId, ...cleanAvailability({ timeZone: tz }, tz), updatedAt: now });
    }
    const studentUser = row.studentId ? await ctx.db.get(row.studentId) : null;
    const to = (email ?? "").trim().toLowerCase() || studentUser?.email || row.inviteEmail || null;
    if (to && (!EMAIL_RE.test(to) || to.length > 200)) throw new Error("That doesn't look like an email address.");
    const token = newToken();
    const offerId = await ctx.db.insert("lessonOffers", {
      teacherId: userId,
      lessonId,
      token,
      slots: clean,
      message: message.trim().slice(0, MAX_NOTE),
      ...(to ? { email: to } : {}),
      status: "open",
      createdAt: now,
    });
    const av = await avRow(ctx, userId);
    return {
      offerId,
      token,
      to,
      slots: clean,
      studentName: row.name,
      teacherName: (await personOf(ctx, userId)).name,
      tz: av?.timeZone ?? tz,
    };
  },
});

export const markOfferSent = internalMutation({
  args: { offerId: v.id("lessonOffers") },
  handler: async (ctx, { offerId }) => {
    await ctx.db.patch(offerId, { sentAt: Date.now() });
  },
});

/** Offers a student some times: makes the link and, when there's an address, emails it. */
export const offerTimes = action({
  args: { lessonId: v.id("lessonStudents"), slots: v.array(slotArg), message: v.string(), email: v.optional(v.string()), tz: v.string() },
  handler: async (ctx, args): Promise<{ token: string; sentTo: string | null; emailFailed: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to offer times.");
    const o = await ctx.runMutation(internal.lessonSchedule.createOffer, { userId, ...args });
    if (!o.to) return { token: o.token, sentTo: null, emailFailed: false };
    const link = `${site()}/lessons/book?offer=${o.token}`;
    const zone = zoneName(o.tz, o.slots[0].start);
    const list = o.slots.map((s) => formatSlot(s, o.tz));
    const text = [
      `Hi ${o.studentName},`,
      "",
      `${o.teacherName} offered you ${o.slots.length === 1 ? "a lesson time" : "some lesson times"} (${zone}):`,
      ...list.map((l) => `• ${l}`),
      ...(args.message.trim() ? ["", `“${args.message.trim()}” — ${o.teacherName}`] : []),
      "",
      "Pick the one that works for you (the page shows them in your own time zone):",
      link,
    ].join("\n");
    const html = shell({
      kicker: "Lessons on soniroll",
      heading: `${o.teacherName} offered you ${o.slots.length === 1 ? "a lesson time" : "lesson times"}`,
      body:
        p(`Hi ${escapeHtml(o.studentName)} — pick the time that works for you and it's booked. You'll get a calendar invite.`) +
        (args.message.trim() ? quote(args.message.trim().slice(0, MAX_NOTE), o.teacherName) : "") +
        `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8">${list.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` +
        p(`<span style="color:#666;font-size:13px">Times shown in ${escapeHtml(zone)}; the page shows them in yours.</span>`),
      button: { href: link, label: "Pick a time" },
      footer: `Or copy this link: <a href="${link}" style="color:#6366f1;word-break:break-all">${link}</a>`,
    });
    const ok = await trySend({ to: o.to, subject: `${o.teacherName} offered you lesson times`, text, html });
    if (ok) await ctx.runMutation(internal.lessonSchedule.markOfferSent, { offerId: o.offerId });
    return { token: o.token, sentTo: o.to, emailFailed: !ok };
  },
});

export const withdrawOffer = mutation({
  args: { offerId: v.id("lessonOffers") },
  handler: async (ctx, { offerId }) => {
    const userId = await getAuthUserId(ctx);
    const o = await ctx.db.get(offerId);
    if (!userId || !o || o.teacherId !== userId) throw new Error("That offer isn't yours.");
    if (o.status === "open") await ctx.db.patch(offerId, { status: "withdrawn" });
  },
});

export const bookFromOffer = internalMutation({
  args: { token: v.string(), start: v.number(), tz: v.optional(v.string()), email: v.optional(v.string()), userId: v.union(v.id("users"), v.null()) },
  handler: async (ctx, { token, start, tz, email, userId }) => {
    const o = await ctx.db
      .query("lessonOffers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!o) throw new Error("This link doesn't work anymore — ask your teacher for new times.");
    if (o.status === "booked") throw new Error("A time from this offer is already booked.");
    if (o.status !== "open") throw new Error("Your teacher took these times back — ask them for new ones.");
    if (userId === o.teacherId) throw new Error("These are times you offered — send the link to your student.");
    if (!(await featuresOf(ctx, o.teacherId)).scheduling) throw new Error("Your teacher isn't booking lessons here right now.");
    const slot = o.slots.find((s) => s.start === start);
    const now = Date.now();
    if (!slot || slot.start <= now) throw new Error("That time isn't available anymore.");
    if ((await busyOf(ctx, o.teacherId, now)).some((b) => slotsOverlap(b, slot))) throw new Error("Someone just took that time — pick another.");
    const row = await ctx.db.get(o.lessonId);
    if (!row) throw new Error("This link doesn't work anymore.");
    const cleanEmail = (email ?? "").trim().toLowerCase();
    const bookingId = await ctx.db.insert("lessonBookings", {
      teacherId: o.teacherId,
      lessonId: o.lessonId,
      start: slot.start,
      end: slot.end,
      status: "confirmed",
      source: "offer",
      offerId: o._id,
      ...(tz && isValidTimeZone(tz) ? { studentTz: tz } : {}),
      ...(cleanEmail && EMAIL_RE.test(cleanEmail) ? { studentEmail: cleanEmail } : o.email ? { studentEmail: o.email } : {}),
      sequence: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(o._id, { status: "booked", bookingId });
    await sessionForBooking(ctx, (await ctx.db.get(bookingId))!);
    return bookingId;
  },
});

/** Books one of an offer's times (anyone with the link). */
export const bookOffer = action({
  args: { token: v.string(), start: v.number(), tz: v.optional(v.string()), email: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ emailed: boolean }> => {
    const userId = await getAuthUserId(ctx);
    const bookingId = await ctx.runMutation(internal.lessonSchedule.bookFromOffer, { ...args, userId });
    const info = (await ctx.runQuery(internal.lessonSchedule.bookingInfo, { bookingId })) as Info | null;
    if (!info) return { emailed: false };
    const sent = await sendConfirmed(info);
    return { emailed: sent.student };
  },
});

// ---------------------------------------------------------------- requests (student → teacher)

export const createRequest = internalMutation({
  args: { userId: v.id("users"), lessonId: v.id("lessonStudents"), slot: slotArg, note: v.string(), tz: v.optional(v.string()) },
  handler: async (ctx, { userId, lessonId, slot, note, tz }) => {
    const row = await ctx.db.get(lessonId);
    if (!row || row.studentId !== userId) throw new Error("You're not this teacher's student.");
    if (!(await featuresOf(ctx, row.teacherId)).scheduling) throw new Error("Your teacher isn't booking lessons here right now.");
    const av = avFrom(await avRow(ctx, row.teacherId));
    if (!av || !av.allowRequests || av.windows.length === 0) throw new Error("Your teacher isn't taking lesson requests right now.");
    const now = Date.now();
    const mine = await ctx.db
      .query("lessonBookings")
      .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
      .collect();
    if (mine.filter((b) => b.status === "requested" && b.start > now).length >= MAX_PENDING_REQUESTS) {
      throw new Error(`You already have ${MAX_PENDING_REQUESTS} requests waiting — wait for your teacher to answer.`);
    }
    if (!validSlot(slot) || !isOpenSlot(av, await busyOf(ctx, row.teacherId, now), now, slot)) throw new Error("That time isn't open anymore — pick another.");
    return ctx.db.insert("lessonBookings", {
      teacherId: row.teacherId,
      lessonId,
      start: slot.start,
      end: slot.end,
      status: "requested",
      source: "request",
      note: note.trim().slice(0, MAX_NOTE),
      ...(tz && isValidTimeZone(tz) ? { studentTz: tz } : {}),
      sequence: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Asks the teacher for one of their open times; they get an email to accept or decline. */
export const requestLesson = action({
  args: { lessonId: v.id("lessonStudents"), slot: slotArg, note: v.string(), tz: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ emailed: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to request a lesson.");
    const bookingId = await ctx.runMutation(internal.lessonSchedule.createRequest, { userId, ...args });
    const info = (await ctx.runQuery(internal.lessonSchedule.bookingInfo, { bookingId })) as Info | null;
    if (!info?.teacher.email) return { emailed: false };
    const time = when(info.slot, info.teacher.tz);
    const link = pageFor(info, true);
    const text = [
      `${info.student.name} asked for a lesson:`,
      "",
      time,
      ...(info.note ? ["", `“${info.note}” — ${info.student.name}`] : []),
      "",
      `Accept or decline it here: ${link}`,
    ].join("\n");
    const html = shell({
      kicker: "Lessons on soniroll",
      heading: `${info.student.name} asked for a lesson`,
      body:
        timeBox(time) +
        (info.note ? quote(info.note, info.student.name) : "") +
        p("Accept it and they get a confirmation with a calendar invite; decline it and they can pick another time."),
      button: { href: link, label: "Accept or decline" },
    });
    return {
      emailed: await trySend({ to: info.teacher.email, subject: `Lesson request from ${info.student.name}: ${formatSlot(info.slot, info.teacher.tz)}`, text, html }),
    };
  },
});

export const setResponse = internalMutation({
  args: { userId: v.id("users"), bookingId: v.id("lessonBookings"), accept: v.boolean(), reply: v.string() },
  handler: async (ctx, { userId, bookingId, accept, reply }) => {
    const b = await ctx.db.get(bookingId);
    if (!b || b.teacherId !== userId) throw new Error("That request isn't yours to answer.");
    if (b.status !== "requested") throw new Error(b.status === "confirmed" ? "You already accepted this one." : "This request was already answered.");
    const now = Date.now();
    if (accept) {
      if (b.start <= now) throw new Error("That time has passed — decline it so they can pick another.");
      const rows = await ctx.db
        .query("lessonBookings")
        .withIndex("by_teacher_start", (q) => q.eq("teacherId", userId).gte("start", now - 24 * HOUR))
        .collect();
      const clash = rows.some((r) => r._id !== bookingId && r.status === "confirmed" && slotsOverlap(r, b));
      if (clash) throw new Error("You already have a lesson then.");
    }
    await ctx.db.patch(bookingId, { status: accept ? "confirmed" : "declined", reply: reply.trim().slice(0, MAX_NOTE), updatedAt: now, sequence: b.sequence + 1 });
    if (accept) await sessionForBooking(ctx, (await ctx.db.get(bookingId))!);
  },
});

/** Accepts or declines a student's request; they're emailed either way (a calendar invite when accepted). */
export const respond = action({
  args: { bookingId: v.id("lessonBookings"), accept: v.boolean(), reply: v.optional(v.string()) },
  handler: async (ctx, { bookingId, accept, reply }): Promise<{ emailed: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    await ctx.runMutation(internal.lessonSchedule.setResponse, { userId, bookingId, accept, reply: reply ?? "" });
    const info = (await ctx.runQuery(internal.lessonSchedule.bookingInfo, { bookingId })) as Info | null;
    if (!info) return { emailed: false };
    if (accept) return { emailed: (await sendConfirmed(info)).student };
    if (!info.student.email) return { emailed: false };
    const time = when(info.slot, info.student.tz);
    const link = pageFor(info, false);
    const text = [
      `${info.teacher.name} can't do the lesson you asked for:`,
      time,
      ...(info.reply ? ["", `“${info.reply}” — ${info.teacher.name}`] : []),
      "",
      `Pick another time: ${link}`,
    ].join("\n");
    const html = shell({
      kicker: "Lessons on soniroll",
      heading: `${info.teacher.name} can't do that time`,
      body: timeBox(time) + (info.reply ? quote(info.reply, info.teacher.name) : "") + p("You can ask for another of their open times."),
      button: { href: link, label: "Pick another time" },
    });
    return { emailed: await trySend({ to: info.student.email, subject: `Lesson request declined: ${formatSlot(info.slot, info.student.tz)}`, text, html }) };
  },
});

// ---------------------------------------------------------------- cancelling

export const setCancelled = internalMutation({
  args: { userId: v.id("users"), bookingId: v.id("lessonBookings"), reason: v.string() },
  handler: async (ctx, { userId, bookingId, reason }) => {
    const b = await ctx.db.get(bookingId);
    if (!b) throw new Error("That lesson isn't here.");
    const row = await ctx.db.get(b.lessonId);
    const by = b.teacherId === userId ? "teacher" : row?.studentId === userId ? "student" : null;
    if (!by) throw new Error("That lesson isn't yours.");
    if (b.status !== "confirmed" && b.status !== "requested") throw new Error("That lesson is already off.");
    const wasConfirmed = b.status === "confirmed";
    await sessionCancelled(ctx, bookingId);
    await ctx.db.patch(bookingId, { status: "cancelled", cancelledBy: by, reply: reason.trim().slice(0, MAX_NOTE), updatedAt: Date.now(), sequence: b.sequence + 1 });
    return { by, wasConfirmed };
  },
});

/** Cancels a lesson (or withdraws a request); the other side is emailed, with a calendar update
    that removes it. */
export const cancel = action({
  args: { bookingId: v.id("lessonBookings"), reason: v.optional(v.string()) },
  handler: async (ctx, { bookingId, reason }): Promise<{ emailed: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const { by, wasConfirmed } = await ctx.runMutation(internal.lessonSchedule.setCancelled, { userId, bookingId, reason: reason ?? "" });
    const info = (await ctx.runQuery(internal.lessonSchedule.bookingInfo, { bookingId })) as Info | null;
    if (!info) return { emailed: false };
    const toTeacher = by === "student";
    const to = toTeacher ? info.teacher : info.student;
    const from = toTeacher ? info.student : info.teacher;
    if (!to.email) return { emailed: false };
    const time = when(info.slot, to.tz);
    const what = wasConfirmed ? "cancelled your lesson" : "withdrew their lesson request";
    const link = pageFor(info, toTeacher);
    const text = [`${from.name} ${what}:`, time, ...(info.reply ? ["", `“${info.reply}” — ${from.name}`] : []), "", link].join("\n");
    const html = shell({
      kicker: "Lessons on soniroll",
      heading: `${from.name} ${what}`,
      body:
        `<p style="margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#f4f4f6;font-size:17px;font-weight:700;color:#666;text-decoration:line-through">${escapeHtml(time)}</p>` +
        (info.reply ? quote(info.reply, from.name) : "") +
        (wasConfirmed ? p("The attached calendar update removes it from your calendar.") : ""),
      button: { href: link, label: toTeacher ? `Open ${from.name}'s page` : "Open your lessons" },
    });
    const ok = await trySend({
      to: to.email,
      subject: `${wasConfirmed ? "Lesson cancelled" : "Lesson request withdrawn"}: ${formatSlot(info.slot, to.tz)}`,
      text,
      html,
      ...(wasConfirmed ? { attachments: icsAttachment(eventFor(info, toTeacher, true)) } : {}),
    });
    return { emailed: ok };
  },
});
