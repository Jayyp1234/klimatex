import { BarChart3, ClipboardCheck, Home, LayoutDashboard, ShoppingBag, Wrench, type LucideIcon } from "lucide-react";
import type { Role } from "./api";

export type Workspace = { title: string; summary: string; icon: LucideIcon; nav: string[] };

/** One workspace per role. Each is a section of the same app, sharing one layout and one sign-in. */
export const workspaces: Record<Role, Workspace> = {
  household: {
    title: "Household",
    summary: "Your home's grade, solar, payouts and certificate.",
    icon: Home,
    nav: ["Home", "Energy", "Payouts", "Loan", "Certificate"],
  },
  installer: {
    title: "Installer",
    summary: "Every home you fitted: its solar, audit status and your earnings.",
    icon: Wrench,
    nav: ["Overview", "Energy", "Attention", "Homes"],
  },
  auditor: {
    title: "Auditor portal",
    summary: "Review evidence, draw samples and sign off periods.",
    icon: ClipboardCheck,
    nav: ["Periods", "Sample", "Evidence", "Trail"],
  },
  buyer: {
    title: "Credit marketplace",
    summary: "Reserve, pay for and retire verified credits.",
    icon: ShoppingBag,
    nav: ["Marketplace", "Orders", "Retirements", "Certificates"],
  },
  lender: {
    title: "Lender dashboard",
    summary: "Homes and solar loans by metered energy grade.",
    icon: BarChart3,
    nav: ["Portfolio", "Grades", "Solar loans", "Homes"],
  },
  admin: {
    title: "Operations console",
    summary: "Every home, payout and solar loan in one view.",
    icon: LayoutDashboard,
    nav: ["Portfolio", "Grades", "Solar loans", "Homes"],
  },
};

export const roles = Object.keys(workspaces) as Role[];

/** Where each role lands after signing in. Buyers go to the finished marketplace. */
export const homeFor = (role: Role) => (role === "buyer" ? "/app/marketplace/" : `/app/${role}/`);
