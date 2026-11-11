import { api } from "./api";

/** The installer, lender and operations view of many homes, from GET /api/fleet. */

export type FleetHome = {
  id: number;
  label: string;
  household: string;
  area: string;
  installer: string;
  inverter: string;
  vendor: string;
  panel_kwp: number;
  installed_on: string | null;
  grade: string | null;
  trust_score: number | null;
  status: "eligible" | "held" | "excluded" | null;
  tco2e: number;
  generator_share: number | null;
  last_reading: string | null;
  kwh_period: number;
  kwh_week: number;
  health: "reporting" | "offline" | "low_output";
  loan: string | null;
  paid_naira: number;
  loan_repaid_naira: number;
};

export type FleetMonth = { month: string; solar_kwh: number; used_kwh: number; grid_kwh: number; backup_kwh: number };

export type Fleet = {
  scope: "installer" | "all";
  installer: string | null;
  as_of: string | null;
  period: { id: number; start: string; end: string; status: string; signed_at: string | null; total_t: number } | null;
  totals: {
    homes: number;
    eligible: number;
    held: number;
    excluded: number;
    offline: number;
    low_output: number;
    kwh_period: number;
    kwh_week: number;
    tco2e: number;
    avg_trust: number | null;
    paid_households_naira: number;
    loan_repaid_naira: number;
    installer_earnings_naira: number;
    loans: number;
    a_or_b: number;
  };
  grades: Record<string, number>;
  credits: { issued: number; listed: number; reserved: number; retired: number };
  monthly: FleetMonth[];
  homes: FleetHome[];
};

export const loadFleet = () => api<Fleet>("/api/fleet");
