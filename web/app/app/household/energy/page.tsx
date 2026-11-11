import type { Metadata } from "next";
import { EnergyOverviewPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Energy overview | KlimateX", description: "Daily solar against the sunlight ceiling." };

export default function Page() {
  return <EnergyOverviewPage />;
}
