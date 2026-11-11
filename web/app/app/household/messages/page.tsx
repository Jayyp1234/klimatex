import type { Metadata } from "next";
import { MonthlyMessage } from "@/components/household/MonthlyMessage";

export const metadata: Metadata = { title: "Monthly message | KlimateX", description: "Your home's monthly message by SMS or WhatsApp, in your language." };

export default function Page() {
  return <MonthlyMessage />;
}
