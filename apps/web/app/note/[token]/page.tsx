import SharedNotePage from "@/components/shednotes/SharedNotePage";

export const metadata = { title: "Shared note" };

/** `/note/<token>` — a Shed Note shared by link; `?n=Title` — a note it links to and shares. */
export default async function SharedNoteRoute({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ n?: string | string[] }> }) {
  const { token } = await params;
  const { n } = await searchParams;
  return <SharedNotePage token={token} note={typeof n === "string" && n ? n : undefined} />;
}
