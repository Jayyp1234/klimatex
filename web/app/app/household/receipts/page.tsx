import type { Metadata } from "next";
import { FuelReceipts } from "@/components/household/FuelReceipts";

export const metadata: Metadata = { title: "Fuel receipts | KlimateX", description: "Add your fuel receipts from the year before solar so your baseline is measured." };

export default function Page() {
  return <FuelReceipts />;
}
