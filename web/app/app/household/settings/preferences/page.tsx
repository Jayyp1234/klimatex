import type { Metadata } from "next";
import { PreferencesPage } from "@/components/household/pages";

export const metadata: Metadata = { title: "Preferences | KlimateX", description: "Language and alert settings." };

export default function Page() {
  return <PreferencesPage />;
}
