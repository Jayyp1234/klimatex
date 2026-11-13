import type { Metadata } from "next";
import { GetStarted } from "@/components/onboarding/GetStarted";

export const metadata: Metadata = {
  title: "Get started | KlimateX",
  description: "Find solar for your home, or link the solar you already have, and start earning from the carbon it saves.",
};

export default function Page() {
  return <GetStarted />;
}
