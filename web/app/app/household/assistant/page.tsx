import type { Metadata } from "next";
import { AssistantView } from "@/components/household/AssistantView";

export const metadata: Metadata = { title: "Ask KlimateX | KlimateX", description: "Ask about your solar, payouts, audit or loan, by text or voice." };

export default function Page() {
  return <AssistantView />;
}
