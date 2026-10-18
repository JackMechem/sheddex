import ShedLogGate from "@/components/practicelog/ShedLogGate";
import RoutineEditorPage from "@/components/practicelog/RoutineEditor";

/** `/shed-log/routine/edit?id=…` edits a routine; `?date=YYYY-MM-DD` makes a new one starting that day. */
export default async function RoutineEditRoute({ searchParams }: { searchParams: Promise<{ id?: string; date?: string }> }) {
  const { id, date } = await searchParams;
  return (
    <ShedLogGate>
      <RoutineEditorPage id={id} date={date} />
    </ShedLogGate>
  );
}
