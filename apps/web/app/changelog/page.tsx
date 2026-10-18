import ChangelogPage from "@/components/changelog/ChangelogPage";

export const metadata = { title: "What's new", description: "Every update to sheddex: new things, improvements and fixes." };

/** `/changelog` — what changed in each version. */
export default function ChangelogRoute() {
  return <ChangelogPage />;
}
