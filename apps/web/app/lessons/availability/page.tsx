import { redirect } from "next/navigation";

/** Teaching hours moved into Lesson settings. */
export default function AvailabilityRoute() {
  redirect("/lessons/settings#hours");
}
