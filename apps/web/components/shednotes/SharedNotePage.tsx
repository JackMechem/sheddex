"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@jam-practice/convex/_generated/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SignInButtons } from "@/components/practicelog/ShedLogGate";
import { DocumentIcon, DownloadIcon } from "@/components/tools";
import { getFont } from "@/lib/fonts";
import NoteDocument from "./NoteDocument";
import NotePrint from "./NotePrint";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-12">{children}</main>;
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <DocumentIcon className="h-9 w-9 text-accent" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}

/**
 * A Shed Note opened from its link (`/note/<token>`): read-only, as a page. "Anyone with the link"
 * notes open for everyone; "only people added" notes ask you to sign in, and say so if the note
 * isn't shared with your account. People who can open it in Shed Notes (to edit) get a button.
 */
export default function SharedNotePage({ token }: { token: string }) {
  const shared = useQuery(api.shedNoteShares.byLink, { token });
  const [printing, setPrinting] = useState(false);

  if (shared === undefined) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      </Shell>
    );
  }
  if (shared.status === "gone") {
    return (
      <Shell>
        <Message title="This note isn't available" text="It isn't shared by link anymore, or the link is wrong." />
      </Shell>
    );
  }
  if (shared.status === "sign-in") {
    return (
      <Shell>
        <Message title="Sign in to open this note" text="It's only shared with certain accounts. Sign in with yours to see it.">
          <SignInButtons />
        </Message>
      </Shell>
    );
  }
  if (shared.status === "not-shared") {
    return (
      <Shell>
        <Message title="This note isn't shared with you" text="Its link only works for the accounts it's shared with. Ask whoever sent it to add your username." />
      </Shell>
    );
  }

  if (shared.status !== "ok") return null;
  const font = shared.view?.font ? getFont(shared.view.font).stack : undefined;
  const updated = new Date(shared.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <Shell>
      <header className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-muted">
          <DocumentIcon className="h-4 w-4 text-accent" /> Shed Note · shared by
          {shared.owner ? (
            <Link href={`/u/${shared.owner}`} className="text-accent hover:underline">
              @{shared.owner}
            </Link>
          ) : (
            <span>{shared.ownerName}</span>
          )}
          <span className="font-normal">· edited {updated}</span>
        </p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={font ? { fontFamily: font } : undefined}>
          {shared.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          {shared.role && (
            <Link href={`/shed-notes?id=${encodeURIComponent(shared.id)}`} className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              {shared.role === "owner" || shared.role === "write" ? "Edit in Shed Notes" : "Open in Shed Notes"}
            </Link>
          )}
          <button type="button" onClick={() => setPrinting(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold hover:bg-surface-hover">
            <DownloadIcon className="h-4 w-4" /> Save as PDF
          </button>
        </div>
      </header>
      <NoteDocument body={shared.body} context={{ token }} fontFamily={font} />
      {printing && <NotePrint title={shared.title} body={shared.body} context={{ token }} fontFamily={font} subtitle={`Shared by ${shared.owner ? `@${shared.owner}` : shared.ownerName}`} onClose={() => setPrinting(false)} />}
    </Shell>
  );
}
