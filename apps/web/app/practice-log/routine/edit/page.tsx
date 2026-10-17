import RoutineEditorPage from "@/components/practicelog/RoutineEditor";

/** `/practice-log/routine/edit?id=…` edits a routine; `?date=YYYY-MM-DD` makes a new one starting that day. */
export default async function RoutineEditRoute({ searchParams }: { searchParams: Promise<{ id?: string; date?: string }> }) {
  const { id, date } = await searchParams;
  return <RoutineEditorPage id={id} date={date} />;
}
