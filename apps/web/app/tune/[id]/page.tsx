import SharedTunePage from "@/components/files/SharedTunePage";

export const metadata = { title: "Shared tune" };

/** `/tune/<id>` — a tune shared by link, with its chord chart, files and recordings. */
export default async function SharedTuneRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SharedTunePage id={id} />;
}
