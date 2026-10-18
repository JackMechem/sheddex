"use client";

import { LibraryPage } from "@/components/library/ui";
import { TUNE_LIST_LABEL, useTuneLists, type TuneListId } from "@/components/library/useTuneActions";
import { NoteIcon, StarIcon } from "@/components/tools";
import TuneListManager from "@/components/TuneListManager";

/** Every tune in one list (Tunes I Know or Tunes to Learn) — search, add (jazz standards or your
    own), edit, bulk select/export/import/delete; each tune's name opens its own page. */
export default function TuneListPage({ list }: { list: TuneListId }) {
  const lists = useTuneLists();
  return (
    <LibraryPage>
      <TuneListManager
        title={TUNE_LIST_LABEL[list]}
        icon={list === "learn" ? StarIcon : NoteIcon}
        tunes={lists[list].tunes}
        setTunes={lists[list].setTunes}
        allowStandards
        listId={list}
        variant="page"
        searchPlaceholder={list === "learn" ? "Search your tunes to learn…" : "Search the tunes you know…"}
        emptyMessage="Nothing here yet — press + to add a jazz standard or your own tune."
        exportFilenamePrefix={list === "learn" ? "jam-practice-tunes-to-learn" : "jam-practice-tunes"}
      />
    </LibraryPage>
  );
}
