import SharedNotePage from "@/components/shednotes/SharedNotePage";

export const metadata = { title: "Shared note" };

/** `/note/<token>` — a Shed Note shared by link. */
export default async function SharedNoteRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedNotePage token={token} />;
}
