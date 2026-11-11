import type { Metadata } from "next";
import { ContactSupport } from "@/components/household/ContactSupport";

export const metadata: Metadata = { title: "Contact Support | KlimateX", description: "Ask KlimateX for help with your home." };

export default function Page() {
  return <ContactSupport />;
}
