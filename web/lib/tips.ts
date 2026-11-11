import { api } from "./api";

export type Tip = {
  id: string;
  kind: string;
  status: "todo" | "done";
  priority: "high" | "medium" | "low";
  who: "household" | "installer";
  title: string;
  body: string;
  action: { label: string; href: string | null } | null;
};

export type HomeTips = {
  home: { id: number; label: string; household: string };
  period: { id: number; status: string } | null;
  todo: number;
  credits_cut_pct: number;
  tips: Tip[];
};

export type FleetTips = {
  homes: HomeTips[];
  by_kind: Record<string, number>;
  homes_with_todo: number;
};

export type Evidence = {
  baseline: { tier: "measured" | "surveyed"; months: number; needed: number; missing_months: string[]; from: string | null; to: string | null;
    litres_per_month: number | null; deduction: number };
  meter: { accuracy_pct: number | null; calibrated_on: string | null; limit_pct: number; within_limit: boolean; deduction: number };
  generator: { scrapped: boolean; scrapped_on: string | null; deadline: string | null };
  receipts: { month: string; litres: number; amount_naira: number }[];
};

export const fetchHomeTips = (siteId: number) => api<HomeTips>(`/api/homes/${siteId}/tips`);
export const fetchFleetTips = () => api<FleetTips>("/api/tips");
export const fetchEvidence = (siteId: number) => api<Evidence>(`/api/homes/${siteId}/evidence`);
export const addFuelReceipt = (month: string, litres: number, amountNaira: number) =>
  api<Evidence>("/api/homes/mine/fuel-receipts", { method: "POST", body: { month, litres, amount_naira: amountNaira } });
export const recordMeter = (siteId: number, accuracyPct: number, calibratedOn: string) =>
  api<Evidence>(`/api/homes/${siteId}/meter`, { method: "POST", body: { accuracy_pct: accuracyPct, calibrated_on: calibratedOn } });

/** Plain names for the tip kinds, for counts on the installer dashboard. */
export const KIND_LABEL: Record<string, string> = {
  offline: "Inverter offline",
  low_output: "Low output",
  generator: "Generator not scrapped",
  backup: "Backup generator",
  missing_data: "Missing days",
  fuel_receipts: "Fuel receipts",
  meter: "Meter accuracy",
  impossible_days: "Impossible readings",
  clone: "Copied readings",
  flat_line: "Frozen readings",
  energy_balance: "Figures don't add up",
  identity: "Install location",
};

export const monthName = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
