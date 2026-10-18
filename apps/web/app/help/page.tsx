import HelpPage from "@/components/help/HelpPage";

export const metadata = { title: "Help" };

/** `/help[?topic=…]` — how every tool and feature works. */
export default async function HelpRoute({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return <HelpPage initialTopic={topic} />;
}
