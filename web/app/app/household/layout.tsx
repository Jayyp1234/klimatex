import type { ReactNode } from "react";
import { HouseholdShell } from "@/components/household/HouseholdShell";

/** Every household page shares one shell: sidebar, header menus, and the home's data loaded once. */
export default function HouseholdLayout({ children }: { children: ReactNode }) {
  return <HouseholdShell>{children}</HouseholdShell>;
}
