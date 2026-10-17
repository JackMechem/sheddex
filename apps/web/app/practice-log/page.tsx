import PracticeLog from "@/components/PracticeLog";

/** `/practice-log[?date=YYYY-MM-DD]` — the practice calendar. */
export default async function PracticeLogRoute({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <PracticeLog initialDate={date} />;
}
