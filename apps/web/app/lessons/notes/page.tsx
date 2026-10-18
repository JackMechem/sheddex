import NotesPage from "@/components/lessons/NotesPage";

/** `/lessons/notes?lesson=&session=&note=` — a lesson's notes (the teacher writes them, the student reads). */
export default async function NotesRoute({ searchParams }: { searchParams: Promise<{ lesson?: string; note?: string; session?: string }> }) {
  const { lesson, note, session } = await searchParams;
  return <NotesPage lessonId={lesson ?? ""} noteId={note} session={session} />;
}
