import type { Metadata } from "next";
import { PaymentsPage } from "@/components/household/PaymentsPage";

export const metadata: Metadata = { title: "Payment details | KlimateX", description: "Where your carbon earnings are paid." };

export default function Page() {
  return <PaymentsPage />;
}
