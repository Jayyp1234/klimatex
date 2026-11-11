import type { Metadata } from "next";
import { PayoutsPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Payout history | KlimateX", description: "Your share of every credit sold." };

export default function Page() {
  return <PayoutsPage />;
}
