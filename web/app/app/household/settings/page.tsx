import type { Metadata } from "next";
import { ProfilePage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Profile | KlimateX", description: "Your account and home." };

export default function Page() {
  return <ProfilePage />;
}
