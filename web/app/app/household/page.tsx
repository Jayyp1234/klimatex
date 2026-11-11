import type { Metadata } from "next";
import { OverviewPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Your home | KlimateX", description: "Your home's solar, savings, grade and carbon payouts." };

export default function Page() {
  return <OverviewPage />;
}
