"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import { menuPosition, tuneSummary } from "@/components/library/shared";
import { EmptyState, Hero, HeroSearch, LibraryPage, LibraryTabs, Panel, Pill, RecentStrip, Rows, SetlistCard, ShelfCard, TuneItem } from "@/components/library/ui";
import { tuneHref, TUNE_LIST_LABEL, useTuneActions, useTuneLists, type TuneListId } from "@/components/library/useTuneActions";
import { setlistHref } from "@/components/library/setlistParts";
import PromptDialog from "@/components/PromptDialog";
import StandardsPicker from "@/components/StandardsPicker";
import { NoteIcon, PlusIcon, SetlistIcon, StarIcon } from "@/components/tools";
import TuneEditorModal from "@/components/TuneEditorModal";
import { useRecentTunes } from "@/lib/recents";
import { DEFAULT_TIME_SIGNATURE, makeId, type Tune } from "@/lib/types";
import { useSetlists } from "@/lib/useSetlists";

const PREVIEW = 5;

function blankTune(name = ""): Tune {
  return { id: makeId(), name, tempos: [], keys: [], timeSignature: DEFAULT_TIME_SIGNATURE, notes: "" };
}

/**
 * The Tunes page — a dashboard for your tune lists, modeled on the mobile app's Tunes tab: Tunes I
 * Know, Tunes to Learn and your setlists, with counts (each opens the full list), the tunes you
 * opened most recently, your latest setlists, and the tunes you added most recently in each list.
 * One search covers both lists. The + makes a setlist or adds a jazz standard, a new tune, or a
 * tune to learn. Every tune opens its own page
 * (`TuneHub`) and has a ⋮ menu (`useTuneActions`).
 */
export default function TunesDashboard() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { setlists, create: createSetlist } = useSetlists();
  const [namingSetlist, setNamingSetlist] = useState(false);
  const lists = useTuneLists();
  const recent = useRecentTunes();
  const { openTuneMenu, element } = useTuneActions();
  const [query, setQuery] = useState("");
  const [addMenu, setAddMenu] = useState<MenuState | null>(null);
  const [addingStandard, setAddingStandard] = useState<TuneListId | null>(null);
  const [creating, setCreating] = useState<{ list: TuneListId; tune: Tune } | null>(null);

  const tunes = lists.tunes.tunes;
  const learn = lists.learn.tunes;
  const withChart = tunes.filter((t) => t.chordChartId).length;

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    const words = q.split(/\s+/);
    const match = (t: Tune) => words.every((w) => `${t.name} ${tuneSummary(t)} ${t.notes}`.toLowerCase().includes(w));
    return { tunes: tunes.filter(match), learn: learn.filter(match) };
  }, [q, tunes, learn]);

  const recentCards = recent.ids
    .map((id) => {
      for (const list of ["tunes", "learn"] as TuneListId[]) {
        const tune = lists[list].tunes.find((t) => t.id === id);
        if (tune)
          return {
            key: tune.id,
            title: tune.name,
            detail: `${list === "learn" ? "To learn" : "I know"} · ${tune.keys.length} of 12 keys`,
            href: tuneHref(list, tune.id),
            keyLabel: tune.keys.find((k) => k.enabled)?.value ?? null,
          };
      }
      return null;
    })
    .filter((x) => x !== null);

  /** The + next to Tunes I Know / Tunes to Learn: a standard or a new tune, into that list. */
  function openListAdd(e: React.MouseEvent, list: TuneListId) {
    setAddMenu({
      ...menuPosition(e),
      items: [
        { label: "Add a jazz standard", onSelect: () => setAddingStandard(list) },
        { label: list === "learn" ? "New tune to learn" : "New tune", onSelect: () => setCreating({ list, tune: blankTune() }) },
      ],
    });
  }

  function row(list: TuneListId) {
    return function renderTune(tune: Tune) {
      return <TuneItem key={tune.id} tune={tune} href={tuneHref(list, tune.id)} onMenu={(e) => openTuneMenu(e, list, tune)} />;
    };
  }

  const tuneNameById = new Map([...tunes, ...learn].map((t) => [t.id, t.name]));
  const sortedSetlists = [...setlists].sort((a, b) => b.updatedAt - a.updatedAt);
  const recentlyAdded = [...tunes].reverse().slice(0, PREVIEW + 1);

  return (
    <LibraryPage>
      <Hero
        title="Tunes"
        helpTopic="tunes"
        icon={NoteIcon}
        tabs={<LibraryTabs active="tunes" />}
        subtitle={
          <>
            {tunes.length} tune{tunes.length === 1 ? "" : "s"} you know
            {isAuthenticated ? ` · ${learn.length} to learn` : ""} · {setlists.length} setlist{setlists.length === 1 ? "" : "s"}
          </>
        }
        actions={
          <Pill
            primary
            icon={PlusIcon}
            label="Add"
            onClick={(e) =>
              setAddMenu({
                ...menuPosition(e),
                items: [
                  { label: "Add a jazz standard", onSelect: () => setAddingStandard("tunes") },
                  { label: "New tune", onSelect: () => setCreating({ list: "tunes", tune: blankTune() }) },
                  ...(isAuthenticated ? [{ label: "New tune to learn", onSelect: () => setCreating({ list: "learn" as TuneListId, tune: blankTune() }) }] : []),
                  { label: "New setlist", onSelect: () => setNamingSetlist(true) },
                ],
              })
            }
          />
        }
      >
        <HeroSearch value={query} onChange={setQuery} placeholder="Search your tunes…" />
      </Hero>

      {results ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {results.tunes.length > 0 && (
            <Panel title={TUNE_LIST_LABEL.tunes} detail={results.tunes.length} flush>
              <Rows>{results.tunes.slice(0, 50).map(row("tunes"))}</Rows>
            </Panel>
          )}
          {results.learn.length > 0 && (
            <Panel title={TUNE_LIST_LABEL.learn} detail={results.learn.length} flush>
              <Rows>{results.learn.slice(0, 50).map(row("learn"))}</Rows>
            </Panel>
          )}
          {results.tunes.length + results.learn.length === 0 && (
            <div className="rounded-2xl bg-surface lg:col-span-2">
              <EmptyState icon={NoteIcon} title={`Nothing matches “${query}”`} body="Try a different name, key or tempo." />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={`grid gap-3 ${isAuthenticated ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
            <ShelfCard
              href="/tunes/list?list=tunes"
              icon={NoteIcon}
              count={tunes.length}
              label={TUNE_LIST_LABEL.tunes}
              preview={[...tunes].reverse().map((t) => t.name)}
              empty="Add the tunes you can play"
            />
            {isAuthenticated && (
              <ShelfCard
                href="/tunes/list?list=learn"
                icon={StarIcon}
                count={learn.length}
                label={TUNE_LIST_LABEL.learn}
                preview={[...learn].reverse().map((t) => t.name)}
                empty="Tunes you're working towards"
                color="var(--key-4, var(--accent))"
              />
            )}
            <ShelfCard
              href="/tunes/setlists"
              icon={SetlistIcon}
              count={setlists.length}
              label="Setlists"
              preview={sortedSetlists.map((s) => s.name)}
              empty="For gigs and sessions"
              color="var(--key-9, var(--accent))"
            />
          </div>

          {recentCards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-bold text-muted">Jump back in</h2>
              <RecentStrip items={recentCards} />
            </section>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="flex min-w-0 flex-col gap-4">
              <Panel
                title={TUNE_LIST_LABEL.tunes}
                icon={NoteIcon}
                detail={tunes.length ? `${withChart} of ${tunes.length} with a chart` : undefined}
                href="/tunes/list?list=tunes"
                onAdd={(e) => openListAdd(e, "tunes")}
                addLabel="Add to Tunes I Know"
                flush
              >
                {tunes.length === 0 ? (
                  <EmptyState
                    icon={NoteIcon}
                    title="No tunes yet"
                    body="Add a jazz standard or your own tune. Each one gets a page for its chart, keys and notes."
                    action={<Pill primary icon={PlusIcon} label="Add a tune" onClick={(e) => openListAdd(e, "tunes")} />}
                  />
                ) : (
                  <>
                    <p className="px-4 pb-1 text-xs text-muted">Latest additions</p>
                    <Rows>{recentlyAdded.map(row("tunes"))}</Rows>
                  </>
                )}
              </Panel>
              {isAuthenticated && (
                <Panel title={TUNE_LIST_LABEL.learn} icon={StarIcon} detail={learn.length || undefined} href="/tunes/list?list=learn" onAdd={(e) => openListAdd(e, "learn")} addLabel="Add to Tunes to Learn" flush>
                  {learn.length === 0 ? (
                    <p className="px-4 pb-3 text-sm text-muted">Tunes you want to learn, kept apart from the ones you know.</p>
                  ) : (
                    <Rows>{[...learn].reverse().slice(0, PREVIEW).map(row("learn"))}</Rows>
                  )}
                </Panel>
              )}
            </div>

            <Panel title="Setlists" icon={SetlistIcon} detail={setlists.length || undefined} href={setlists.length ? "/tunes/setlists" : undefined} onAdd={() => setNamingSetlist(true)} addLabel="New setlist">
              {setlists.length === 0 ? (
                <button type="button" onClick={() => setNamingSetlist(true)} className="flex w-full items-center gap-3 rounded-xl bg-background p-3 text-left text-sm text-muted hover:bg-surface-hover">
                  <SetlistIcon className="h-5 w-5 shrink-0 text-accent" />
                  Make a setlist for a gig or a session — share it by link or post it to Community.
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedSetlists.slice(0, PREVIEW).map((sl) => (
                    <SetlistCard key={sl.id} setlist={sl} href={setlistHref(sl.id)} tuneNames={sl.tuneIds.map((id) => tuneNameById.get(id)).filter((n): n is string => !!n)} />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      {element}
      {addMenu && <ContextMenu menu={addMenu} onClose={() => setAddMenu(null)} />}
      {namingSetlist && (
        <PromptDialog
          title="New setlist"
          initialValue=""
          placeholder="e.g. Friday gig"
          confirmLabel="Create"
          onSubmit={(name) => {
            setNamingSetlist(false);
            router.push(setlistHref(createSetlist(name).id));
          }}
          onCancel={() => setNamingSetlist(false)}
        />
      )}
      {addingStandard && (
        <StandardsPicker
          tunes={lists[addingStandard].tunes}
          setTunes={lists[addingStandard].setTunes}
          onClose={() => setAddingStandard(null)}
          onCreateCustom={(name) => {
            setCreating({ list: addingStandard, tune: blankTune(name) });
            setAddingStandard(null);
          }}
        />
      )}
      {creating && (
        <TuneEditorModal
          initial={creating.tune}
          isNew
          onSave={(t) => {
            lists[creating.list].setTunes((prev) => [...prev, t]);
            setCreating(null);
          }}
          onClose={() => setCreating(null)}
        />
      )}
    </LibraryPage>
  );
}
