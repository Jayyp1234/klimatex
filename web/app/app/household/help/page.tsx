import type { Metadata } from "next";
import { HelpCenter } from "@/components/household/HelpCenter";

export const metadata: Metadata = { title: "Help Center | KlimateX", description: "Answers about your solar, payouts, certificate and loan." };

export default function Page() {
  return <HelpCenter />;
}
