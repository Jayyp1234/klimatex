import type { Metadata } from "next";
import { LoanPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Solar loan | KlimateX", description: "Carbon payouts paid into your solar loan." };

export default function Page() {
  return <LoanPage />;
}
