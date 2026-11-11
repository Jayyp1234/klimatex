import { api } from "./api";

/** The household app's view of the API. Pages and components read only these types. */

export type Day = { day: string; generated: number; toLoad: number; grid: number; backup: number; ceiling: number | null };
export type Check = { name: string; result: string; evidence?: Record<string, unknown> };
export type Month = {
  month: string;
  solarKwh: number;
  capKwh: number;
  litres: number;
  tonnes: number;
  baselineT: number;
  projectT: number;
  leakageT: number;
};

export type Home = {
  siteId: number;
  label: string;
  area: string;
  householdName: string;
  loan: string | null;
  wallet: string | null;
  panelKwp: number;
  gridHours: number;
  inverter: { serial: string; vendor: string };
  generator: { serial: string; kva: number; scrappedOn: string | null; certificate: string | null };
  daily: Day[];
  status: string | null;
  score: number | null;
  checks: Check[];
  months: Month[];
};

export type Certificate = {
  certificate: string;
  grade_before: string;
  grade_now: string;
  generator_share_before: number;
  generator_share_now: number;
  potential: string;
  credited_tco2e_period: number;
  credited_tco2e_per_year: number;
  petrol_litres_avoided_period: number;
  trust_score: number;
  checks: Check[];
};

export type Payout = {
  id: number;
  amountNaira: number;
  status: string;
  destination: "solar_loan" | "wallet" | "bank";
  reference: string;
  tonnes: number;
  period: { start: string; end: string } | null;
  paidOn: string | null;
  serials: string[];
};

export type Alert = { id: string; kind: "no_data" | "low_output" | "held" | "payout"; severity: "critical" | "warning" | "info"; at: string | null; title: string; body: string };

export type Dashboard = { home: Home; certificate: Certificate | null; payouts: Payout[]; paidNaira: number; alerts: Alert[]; dataAsOf: string | null };

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pcm", label: "Pidgin" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
];

/** Rough Lagos pump price, used only to show families their saving in naira. Always shown as an estimate. */
export const PETROL_NAIRA_PER_LITRE = 1000;

/** Petrol a generator would have burned for the solar that replaced it: generator share x 0.7 L/kWh, as on the certificate. */
const LITRES_PER_KWH = 0.7;

type ApiMonth = { eg_res_kwh: number; eg_cap_kwh: number; be_t: number; ae_t: number; le_t: number; er_t: number };
type ApiHome = {
  site: { id: number; label: string; area: string; panel_kwp: number; grid_hours_per_day: number };
  household: { name: string; wallet: string | null; loan: string | null };
  generator: { serial: string; kva: number; scrapped_on: string | null; certificate: string | null };
  inverter: { serial: string; vendor: string };
  daily: { day: string; generated: number; to_load: number; grid: number; backup: number; ceiling: number | null }[];
  periods: { status: string; score: number; checks: Check[]; monthly: Record<string, ApiMonth> }[];
};
type ApiPayout = Omit<Payout, "amountNaira" | "paidOn"> & { amount_naira: number; paid_on: string | null };

export async function loadDashboard(): Promise<Dashboard> {
  const { site_id: id } = await api<{ site_id: number }>("/api/homes/mine");
  const [home, certificate, payouts, alerts] = await Promise.all([
    api<ApiHome>(`/api/homes/${id}`),
    api<Certificate>(`/api/homes/${id}/certificate`).catch(() => null),
    api<{ payouts: ApiPayout[]; paid_naira: number }>(`/api/homes/${id}/payouts`),
    api<{ alerts: Alert[]; data_as_of: string | null }>(`/api/homes/${id}/alerts`),
  ]);
  const latest = home.periods[home.periods.length - 1] ?? null;
  const generatorShare = 1 - home.site.grid_hours_per_day / 24;
  const months = latest
    ? Object.entries(latest.monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, m]) => ({
          month,
          solarKwh: m.eg_res_kwh,
          capKwh: m.eg_cap_kwh,
          litres: m.eg_res_kwh * generatorShare * LITRES_PER_KWH,
          tonnes: m.er_t,
          baselineT: m.be_t,
          projectT: m.ae_t,
          leakageT: m.le_t,
        }))
    : [];
  return {
    home: {
      siteId: home.site.id,
      label: home.site.label,
      area: home.site.area,
      householdName: home.household.name,
      loan: home.household.loan,
      wallet: home.household.wallet,
      panelKwp: home.site.panel_kwp,
      gridHours: home.site.grid_hours_per_day,
      inverter: home.inverter,
      generator: { serial: home.generator.serial, kva: home.generator.kva, scrappedOn: home.generator.scrapped_on, certificate: home.generator.certificate },
      daily: home.daily.map((d) => ({ day: d.day, generated: d.generated, toLoad: d.to_load, grid: d.grid, backup: d.backup, ceiling: d.ceiling })),
      status: latest?.status ?? null,
      score: latest?.score ?? null,
      checks: latest?.checks ?? [],
      months,
    },
    certificate,
    payouts: payouts.payouts.map(({ amount_naira, paid_on, ...p }) => ({ ...p, amountNaira: amount_naira, paidOn: paid_on })),
    paidNaira: payouts.paid_naira,
    alerts: alerts.alerts,
    dataAsOf: alerts.data_as_of,
  };
}

export const fetchMessage = (siteId: number, lang: string) => api<{ text: string }>(`/api/homes/${siteId}/message?lang=${lang}`).then((m) => m.text);

/** Normal, above what the sun allowed (failed check), or well below what a clean system makes. */
export function dayStatus(d: Day): "normal" | "above" | "low" {
  if (d.ceiling === null) return "normal";
  if (d.generated > d.ceiling) return "above";
  return d.generated < (d.ceiling / 1.1) * 0.6 ? "low" : "normal";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthLabel = (key: string) => `${monthName(key)} ${key.slice(0, 4)}`;
export const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
export const longDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Not recorded";
export const periodLabel = (period: Payout["period"]) => (period ? `${monthName(period.start)}–${monthName(period.end)} ${period.end.slice(0, 4)}` : "Audit period");
export const checkLabel = (name: string) => name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const homeCode = (siteId: number) => `KX-${String(siteId).padStart(4, "0")}`;
export const destinationLabel = (d: Payout["destination"]) => ({ solar_loan: "Solar loan", bank: "Bank account", wallet: "Access wallet" })[d];

/** Builds a CSV and hands it to the browser as a download. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
