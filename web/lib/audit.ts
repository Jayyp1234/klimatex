import { api } from "./api";

/** The auditor portal's view of the API: periods, the sample, each home's evidence and the ledger trail. */

export type PeriodSummary = {
  id: number;
  start: string;
  end: string;
  status: "open" | "computed" | "sampled" | "signed" | string;
  eligible_t: number;
  carried_t: number;
  sample_seed: number | null;
  sample: number[];
  signed_by: string | null;
  signed_at: string | null;
  registry: { project: string | null; mrv: string | null };
  homes: { eligible: number; held: number; excluded: number; reviewed: number };
  credits: { issued: number; retired: number };
};

export type LedgerStatus = { ok: boolean; entries?: number; root?: string; broken_at?: number };

export type PeriodSite = { site_id: number; label: string; tco2e: number; score: number; status: string; reviewed: boolean; failed: string[] };
export type PeriodDetail = { id: number; status: string; sample: number[] | null; sample_seed: number | null; sites: PeriodSite[] };

export type Check = { name: string; result: string; evidence?: Record<string, unknown> };
export type EvidenceDay = { day: string; generated: number; ceiling: number | null; backup: number };
export type HomeEvidence = {
  site: { id: number; label: string; area: string; panel_kwp: number; grid_hours_per_day: number };
  household: { name: string };
  generator: { serial: string; kva: number; scrapped_on: string | null; certificate: string | null };
  inverter: { serial: string; vendor: string };
  daily: EvidenceDay[];
  periods: { period: number; tco2e: number; score: number; status: string; grade: string; checks: Check[] }[];
};

export type TrailEvent = { id: number; at: string; type: string; payload: Record<string, unknown>; hash: string };

export const loadPeriods = () => api<{ periods: PeriodSummary[]; ledger: LedgerStatus; data_as_of: string | null }>("/api/periods");
export const loadPeriod = (id: number) => api<PeriodDetail>(`/api/periods/${id}`);
export const loadTrail = (id: number) => api<{ events: TrailEvent[] }>(`/api/periods/${id}/trail`);
export const loadEvidence = (siteId: number) => api<HomeEvidence>(`/api/homes/${siteId}`);

export const createPeriod = (start: string, end: string) => api<{ period: number }>("/api/periods", { method: "POST", body: { start, end } });
export const computePeriod = (id: number) => api<unknown>(`/api/periods/${id}/compute`, { method: "POST" });
export const drawSample = (id: number, seed: number) => api<unknown>(`/api/periods/${id}/sample?seed=${seed}`, { method: "POST" });
export const reviewSite = (id: number, site: number, decision: Decision, note: string) =>
  api<unknown>(`/api/periods/${id}/sites/${site}/review`, { method: "POST", body: { decision, note } });
export const signOff = (id: number) => api<unknown>(`/api/periods/${id}/signoff`, { method: "POST" });

export type Decision = "ok" | "clear" | "keep_held" | "exclude";
