import AccountPage from "@/components/AccountPage";

/** `/account[?tab=…]` — account settings. */
export default async function AccountRoute({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <AccountPage initialTab={tab} />;
}
