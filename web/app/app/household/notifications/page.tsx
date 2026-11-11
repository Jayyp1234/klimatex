import type { Metadata } from "next";
import { NotificationsPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Notifications | KlimateX", description: "Alerts about your system and payments." };

export default function Page() {
  return <NotificationsPage />;
}
