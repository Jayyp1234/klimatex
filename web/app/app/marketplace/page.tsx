import type { Metadata } from "next";
import { MarketplaceApp } from "@/components/marketplace/MarketplaceApp";

export const metadata: Metadata = {
  title: "Marketplace | KlimateX",
  description: "Browse, reserve and buy verified carbon credits from household solar projects.",
};

export default function MarketplacePage() {
  return <MarketplaceApp />;
}
