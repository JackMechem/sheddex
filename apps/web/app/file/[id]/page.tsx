import SharedFilePage from "@/components/files/SharedFilePage";

export const metadata = { title: "Shared file" };

/** `/file/<id>` — one file shared by link: open it, download it, or save a copy. */
export default async function SharedFileRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SharedFilePage id={id} />;
}
