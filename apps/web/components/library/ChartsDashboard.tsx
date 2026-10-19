"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import PromptDialog from "@/components/PromptDialog";
import { menuPosition } from "@/components/library/shared";
import { ChartItem, EmptyState, Hero, HeroSearch, LibraryPage, LibraryTabs, Panel, Pill, PlaylistCard, RecentStrip, Rows } from "@/components/library/ui";
import { ALL_CHARTS_ID, useChartActions } from "@/components/library/useChartActions";
import { useTuneLists } from "@/components/library/useTuneActions";
import { LibraryIcon, ChordChartIcon, DownloadIcon, PlusIcon } from "@/components/tools";
import { formatComposer } from "@/lib/iRealPro";
import { useRecentCharts } from "@/lib/recents";
import { sortByText } from "@jam-practice/core/sortText";
import { useChordChartsLibrary, type LibrarySongMeta } from "@/lib/useChordChartsLibrary";
import StoragePill from "@/components/files/StoragePill";

export const chartHref = (id: string) => `/chord-charts/view?id=${encodeURIComponent(id)}`;
export const playlistHref = (id: string) => `/chord-charts/playlist?id=${encodeURIComponent(id)}`;

/**
 * The Chord Charts page — modeled on the mobile app's Chord Charts tab: search across every chart,
 * counts (charts / playlists / charts linked to one of your tunes), the charts you opened most
 * recently, and your playlists as folders (each opens its own page; ⋮ to delete). The + makes a
 * new chart or playlist, or imports. A chart opens on its own page (`ChartViewPage`); every chart
 * row has the chart ⋮ menu (`useChartActions`).
 */
export default function ChartsDashboard() {
  const router = useRouter();
  const { playlists: raw, allSongs, totalSongs, loading, createPlaylist } = useChordChartsLibrary(null);
  const { openSongMenu, openPlaylistMenu, element } = useChartActions();
  const recent = useRecentCharts();
  const lists = useTuneLists();
  const [query, setQuery] = useState("");
  const [addMenu, setAddMenu] = useState<MenuState | null>(null);
  const [naming, setNaming] = useState(false);

  const playlists = useMemo(() => sortByText(raw, (p) => p.name), [raw]);
  // Every chart once ("All charts"), with its playlists' names for subtitles.
  const index = useMemo(() => {
    const m = new Map<string, { song: LibrarySongMeta; playlistName: string }>();
    for (const s of allSongs) m.set(s.id, { song: s, playlistName: s.playlistNames });
    return m;
  }, [allSongs]);

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!q) return null;
    const words = q.split(/\s+/);
    return sortByText(
      [...index.values()].filter(({ song }) => words.every((w) => `${song.title} ${song.composer} ${song.style}`.toLowerCase().includes(w))),
      (h) => h.song.title,
    );
  }, [q, index]);

  const linked = new Set([...lists.tunes.tunes, ...lists.learn.tunes].map((t) => t.chordChartId).filter((id): id is string => !!id && index.has(id))).size;
  const recentCards = recent.ids
    .map((id) => index.get(id))
    .filter((x) => x !== undefined)
    .map((r) => ({ key: r.song.id, title: r.song.title, detail: r.playlistName || (r.song.composer ? formatComposer(r.song.composer) : ""), href: chartHref(r.song.id), keyLabel: r.song.key }));

  const openNewMenu = (e: React.MouseEvent) =>
    setAddMenu({
      ...menuPosition(e),
      items: [
        { label: "New chord chart", onSelect: () => router.push("/chord-charts/new") },
        { label: "New playlist", onSelect: () => setNaming(true) },
        { label: "Import charts", onSelect: () => router.push("/chord-charts/import") },
      ],
    });
  const sortedTitles = (songs: { title: string }[]) => sortByText(songs, (x) => x.title).map((x) => x.title);

  return (
    <LibraryPage>
      <Hero
        title="Library"
        icon={LibraryIcon}
        titleExtra={<StoragePill />}
        helpTopic="chord-charts"
        tabs={<LibraryTabs active="charts" />}
        subtitle={
          loading ? (
            "Loading…"
          ) : (
            <>
              {totalSongs} chart{totalSongs === 1 ? "" : "s"} · {playlists.length} playlist{playlists.length === 1 ? "" : "s"} · {linked} linked to your tunes
            </>
          )
        }
        actions={
          <>
            <Pill icon={DownloadIcon} label="Import" href="/chord-charts/import" iconOnlyOnPhone />
            <Pill primary icon={PlusIcon} label="New" onClick={openNewMenu} />
          </>
        }
      >
        <HeroSearch value={query} onChange={setQuery} placeholder={`Search ${totalSongs} charts by title, composer or style…`} />
      </Hero>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner label="Loading your charts…" showLabel />
        </div>
      ) : hits ? (
        <Panel title="Results" detail={hits.length} flush>
          {hits.length === 0 ? (
            <EmptyState icon={ChordChartIcon} title={`No charts match “${query}”`} body="Try part of a title, a composer or a style." />
          ) : (
            <Rows>
              {hits.slice(0, 200).map((h) => (
                <ChartItem
                  key={h.song.id}
                  song={h.song}
                  subtitle={[h.song.composer ? formatComposer(h.song.composer) : null, h.playlistName].filter(Boolean).join(" · ")}
                  href={chartHref(h.song.id)}
                  onMenu={(e) => openSongMenu(e, h.song, null)}
                />
              ))}
            </Rows>
          )}
        </Panel>
      ) : totalSongs === 0 && playlists.length === 0 ? (
        <div className="rounded-2xl bg-surface">
          <EmptyState
            icon={ChordChartIcon}
            title="No chord charts yet"
            body="Build a chart bar by bar, or import a chart link or a whole playlist."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Pill primary icon={PlusIcon} label="New chord chart" href="/chord-charts/new" />
                <Pill icon={DownloadIcon} label="Import" href="/chord-charts/import" />
              </div>
            }
          />
        </div>
      ) : (
        <>
          {recentCards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-bold text-muted">Jump back in</h2>
              <RecentStrip items={recentCards} />
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-lg font-bold">Playlists</h2>
              <button type="button" onClick={() => setNaming(true)} className="flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                <PlusIcon className="h-4 w-4" />
                New playlist
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6">
              <PlaylistCard featured name="All charts" count={totalSongs} href={playlistHref(ALL_CHARTS_ID)} titles={sortedTitles(allSongs).slice(0, 3)} />
              {playlists.map((p) => (
                <PlaylistCard
                  key={p.id}
                  name={p.name}
                  count={p.songs.length}
                  href={playlistHref(p.id)}
                  titles={sortedTitles(p.songs).slice(0, 3)}
                  onMenu={(e) => openPlaylistMenu(e, { id: p.id, name: p.name, count: p.songs.length })}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {element}
      {addMenu && <ContextMenu menu={addMenu} onClose={() => setAddMenu(null)} />}
      {naming && (
        <PromptDialog
          title="New playlist"
          initialValue=""
          onSubmit={(name) => {
            if (name.trim()) void createPlaylist(name.trim());
            setNaming(false);
          }}
          onCancel={() => setNaming(false)}
        />
      )}
    </LibraryPage>
  );
}
