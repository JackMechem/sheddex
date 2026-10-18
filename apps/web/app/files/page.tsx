import FilesPage from "@/components/files/FilesPage";

export const metadata = { title: "Files" };

/** `/files` — everything stored with your account (see `components/files/FilesPage.tsx`). */
export default function FilesRoute() {
  return <FilesPage />;
}
