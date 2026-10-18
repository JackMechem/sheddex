import ShedLogGate from "@/components/practicelog/ShedLogGate";
import PracticeLog from "@/components/PracticeLog";

/** `/shed-log[?date=YYYY-MM-DD]` — the practice calendar. */
export default async function PracticeLogRoute({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return (
    <ShedLogGate>
      <PracticeLog initialDate={date} />
    </ShedLogGate>
  );
}
