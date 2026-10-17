import RoutinePage from "@/components/practicelog/RoutinePage";

/** `/practice-log/routine?id=…` — one routine's page. */
export default async function RoutineRoute({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <RoutinePage id={id ?? ""} />;
}
