import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AuditorPortal } from "@/components/workspace/AuditorPortal";
import { FleetDashboard } from "@/components/workspace/FleetDashboard";
import { OnboardingRequests } from "@/components/workspace/OnboardingRequests";
import type { Role } from "@/lib/api";
import { roles, workspaces } from "@/lib/workspaces";

export const dynamicParams = false;

export function generateStaticParams() {
  // The household has its own dashboard page at /app/household.
  return roles.filter((role) => role !== "household").map((workspace) => ({ workspace }));
}

export async function generateMetadata({ params }: PageProps<"/app/[workspace]">): Promise<Metadata> {
  const { workspace } = await params;
  return { title: `${workspaces[workspace as Role].title} | KlimateX` };
}

export default async function WorkspacePage({ params }: PageProps<"/app/[workspace]">) {
  const { workspace } = await params;
  const role = workspace as Role;
  return (
    <AppShell role={role}>
      {role === "installer" || role === "admin" ? (
        <div className="space-y-5">
          <OnboardingRequests admin={role === "admin"} />
          <FleetDashboard variant={role} />
        </div>
      ) : role === "lender" ? (
        <FleetDashboard variant={role} />
      ) : role === "auditor" ? (
        <AuditorPortal />
      ) : (
        <div className="rounded-xl border border-line bg-white px-6 py-14 text-center">
          <p className="text-[15px] font-medium">{workspaces[role].title} opens here next</p>
          <p className="mx-auto mt-1 max-w-[380px] text-sm text-body">Your sign-in and access are live. The screens for this workspace are the next build step.</p>
        </div>
      )}
    </AppShell>
  );
}
