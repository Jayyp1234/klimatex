import type { Metadata } from "next";
import { CertificatePage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Home Energy Certificate | KlimateX", description: "Your home's metered energy grade." };

export default function Page() {
  return <CertificatePage />;
}
