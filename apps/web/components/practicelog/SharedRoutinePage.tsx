"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@jam-practice/convex/_generated/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import { AddRoutineButton, RoutinePreview } from "@/components/practicelog/PublicRoutineView";
import { CalendarIcon } from "@/components/tools";

/** `/routine/<id>` — a Shed Log routine someone shared by link, open to anyone. It always
    shows the routine as it is now, with "Add to my Shed Log". */
export default function SharedRoutinePage({ id }: { id: string }) {
  const shared = useQuery(api.routines.getShared, { id });
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-12">
      {shared === undefined ? (
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      ) : shared === null ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <h1 className="text-xl font-semibold">This routine isn&apos;t available</h1>
          <p className="text-sm text-muted">It isn&apos;t shared anymore, or the link is wrong.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-muted">
              <CalendarIcon className="h-5 w-5 text-accent" />
              Practice routine
              {shared.ownerUsername && (
                <>
                  {" · shared by "}
                  <Link href={`/u/${shared.ownerUsername}`} className="text-accent hover:underline">
                    @{shared.ownerUsername}
                  </Link>
                </>
              )}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight">{shared.routine.name}</h1>
          </div>
          <RoutinePreview routine={shared.routine} />
          {shared.isMine && shared.routineId ? (
            <Link href={`/shed-log/routine?id=${encodeURIComponent(shared.routineId)}`} className="self-start rounded-full bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
              Open in your Shed Log
            </Link>
          ) : (
            <AddRoutineButton routine={shared.routine} />
          )}
        </>
      )}
    </main>
  );
}
