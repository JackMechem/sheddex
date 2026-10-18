import MaterialsPage from "@/components/lessons/MaterialsPage";

/** `/lessons/materials?pair=` — everything given across all of a teacher–student pair's lessons. */
export default async function MaterialsRoute({ searchParams }: { searchParams: Promise<{ pair?: string }> }) {
  const { pair } = await searchParams;
  return <MaterialsPage pair={pair ?? ""} />;
}
