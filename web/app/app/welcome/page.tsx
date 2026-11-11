import type { Metadata } from "next";
import { WelcomeSetup } from "@/components/household/WelcomeSetup";

export const metadata: Metadata = { title: "Welcome | KlimateX", description: "Finish setting up your KlimateX account." };

export default function Page() {
  return <WelcomeSetup />;
}
