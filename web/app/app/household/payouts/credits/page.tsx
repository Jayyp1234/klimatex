import type { Metadata } from "next";
import { CreditsPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Credits and serials | KlimateX", description: "Every credit your home helped earn." };

export default function Page() {
  return <CreditsPage />;
}
