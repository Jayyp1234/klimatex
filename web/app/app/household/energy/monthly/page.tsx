import type { Metadata } from "next";
import { MonthlyPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Monthly summary | KlimateX", description: "How each month's solar became carbon credits." };

export default function Page() {
  return <MonthlyPage />;
}
