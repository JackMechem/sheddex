"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { chartHref } from "@/components/library/ChartsDashboard";
import { ChartItem, EmptyState, FolderIcon, Hero, HeroSearch, LibraryPage, nameColor, Pill, Rows, tint } from "@/components/library/ui";
import { ALL_CHARTS_ID, useChartActions } from "@/components/library/useChartActions";
import { ChordChartIcon, DotsVerticalIcon, PlusIcon } from "@/components/tools";
import { sortByText } from "@jam-practice/core/sortText";
import { useChordChartsLibrary } from "@/lib/useChordChartsLibrary";

/** One playlist's charts — or, for `ALL_CHARTS_ID`, every chart in the library — alphabetical and
    searchable, each opening its own page; + adds a chart here, ⋮ deletes the playlist. */
export default function PlaylistPage({ id }: { id: string }) {
  const router = useRouter();
  const { playlists, allSongs, loading } = useChordChartsLibrary(null);
  const { openSongMenu, openPlaylistMenu, element } = useChartActions({ onPlaylistDeleted: () => router.push("/chord-charts") });
  const [query, setQuery] = useState("");
  const isAll = id === ALL_CHARTS_ID;
  const playlist = useMemo(
    () => (isAll ? { id: ALL_CHARTS_ID, name: "All charts", songs: allSongs } : playlists.find((p) => p.id === id)),
    [isAll, allSongs, playlists, id],
  );

  const q = query.trim().toLowerCase();
  const songs = useMemo(() => {
    const all = sortByText(playlist?.songs ?? [], (s) => s.title);
    return q ? all.filter((s) => `${s.title} ${s.composer}`.toLowerCase().includes(q)) : all;
  }, [playlist, q]);

  // Alphabetical sections ("A", "B", … "#" for anything that doesn't start with a letter).
  const sections = useMemo(() => {
    const out: { letter: string; songs: typeof songs }[] = [];
    for (const song of songs) {
      const first = song.title.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      const last = out[out.length - 1];
      if (last && last.letter === letter) last.songs.push(song);
      else out.push({ letter, songs: [song] });
    }
    return out;
  }, [songs]);
  const color = isAll ? "var(--accent)" : nameColor(playlist?.name ?? "");

  return (
    <LibraryPage>
      <Hero
        title={playlist?.name ?? "Playlist"}
        color={color}
        backHref="/chord-charts"
        backLabel="Chord Charts"
        leading={
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: tint(color, 20), color }}>
            {isAll ? <ChordChartIcon className="h-7 w-7" /> : <FolderIcon className="h-7 w-7" />}
          </span>
        }
        subtitle={playlist ? `${isAll ? "Every chart in your library" : "Playlist"} · ${playlist.songs.length} chart${playlist.songs.length === 1 ? "" : "s"}` : undefined}
        actions={
          playlist ? (
            <>
              <Pill primary icon={PlusIcon} label="New chart" href={isAll ? "/chord-charts/new" : `/chord-charts/new?playlist=${encodeURIComponent(playlist.name)}`} iconOnlyOnPhone />
              {!isAll && (
                <button
                  type="button"
                  onClick={(e) => openPlaylistMenu(e, { id: playlist.id, name: playlist.name, count: playlist.songs.length })}
                  aria-label={`Options for ${playlist.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  <DotsVerticalIcon className="h-5 w-5" />
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {playlist && !loading && <HeroSearch value={query} onChange={setQuery} placeholder={`Search ${playlist.songs.length} in ${playlist.name}…`} />}
      </Hero>
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : !playlist ? (
        <div className="rounded-2xl bg-surface">
          <EmptyState icon={FolderIcon} title="Playlist not found" body="This playlist isn't in your library anymore." action={<Pill label="Back to Chord Charts" href="/chord-charts" />} />
        </div>
      ) : songs.length === 0 ? (
        <div className="rounded-2xl bg-surface">
          <EmptyState
            icon={ChordChartIcon}
            title={q ? `No charts match “${query}”` : "No charts here yet"}
            body={q ? undefined : isAll ? "Create a chart or import some." : "Create a chart here, or add charts from a chart's ⋮ menu."}
          />
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 rounded-2xl bg-surface py-1.5">
            {sections.map((sec) => (
              <section key={sec.letter} id={`letter-${sec.letter}`} className="scroll-mt-24">
                <h2 className="sticky top-0 z-[1] rounded-t-2xl bg-surface/95 px-4 pb-1 pt-3 text-xs font-extrabold text-accent backdrop-blur">{sec.letter}</h2>
                <Rows>
                  {sec.songs.map((s) => (
                    <ChartItem key={s.id} song={s} href={chartHref(s.id)} onMenu={(e) => openSongMenu(e, s, isAll ? null : playlist.id)} />
                  ))}
                </Rows>
              </section>
            ))}
          </div>
          {sections.length > 6 && (
            <nav aria-label="Jump to letter" className="sticky top-6 hidden h-fit flex-col items-center gap-0.5 rounded-full bg-surface px-1 py-2 sm:flex">
              {sections.map((sec) => (
                <a key={sec.letter} href={`#letter-${sec.letter}`} className="flex h-5 w-6 items-center justify-center rounded-full text-[10px] font-bold text-muted hover:bg-accent hover:text-accent-foreground">
                  {sec.letter}
                </a>
              ))}
            </nav>
          )}
        </div>
      )}
      {element}
    </LibraryPage>
  );
}
