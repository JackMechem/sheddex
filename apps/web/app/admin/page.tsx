import type { Metadata } from "next";
import { Suspense } from "react";
import AdminPage from "@/components/admin/AdminPage";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** `/admin` — the site admin's panel (feedback, posts, accounts). Every call behind it is checked on the server. */
export default function AdminRoute() {
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
}
