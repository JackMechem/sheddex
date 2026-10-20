import GatedShedNotes from "@/components/shednotes/GatedShedNotes";

/** `/shed-notes[?id=<note id>|settings]` — Shed Notes. */
export default async function ShedNotesRoute({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <GatedShedNotes initialId={id} />;
}
