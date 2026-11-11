import type { Metadata } from "next";
import { ReadingsPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Daily readings | KlimateX", description: "Every daily reading from your inverter." };

export default function Page() {
  return <ReadingsPage />;
}
