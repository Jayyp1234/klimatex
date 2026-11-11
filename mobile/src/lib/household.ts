import { api } from "./api";

/** The household app's view of the API. Mirrors web/lib/household.ts so the figures match the web dashboard. */

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

export type Alert = {
  id: string;
  kind: "no_data" | "low_output" | "held" | "payout";
  severity: "critical" | "warning" | "info";
  at: string | null;
  title: string;
  body: string;
};

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

/** The monthly message. `source` arrives with API v6: "model" when the AI wrote it, "template" when it fell back. */
export type MonthlyMessage = { text: string; source?: "model" | "template" };
export const fetchMessage = (siteId: number, lang: string) => api<MonthlyMessage>(`/api/homes/${siteId}/message?lang=${encodeURIComponent(lang)}`);

/** Normal, above what the sun allowed (failed check), or well below what a clean system makes. */
export function dayStatus(d: Day): "normal" | "above" | "low" {
  if (d.ceiling === null) return "normal";
  if (d.generated > d.ceiling) return "above";
  return d.generated < (d.ceiling / 1.1) * 0.6 ? "low" : "normal";
}

/** What the dashboard's figures are built from. Same arithmetic as OverviewPage on the web. */
export function overviewFigures(data: Dashboard) {
  const { home, certificate } = data;
  const months = home.months;
  const latest = months[months.length - 1] ?? null;
  const potential = certificate ? (/^([A-G])\b/.exec(certificate.potential.trim())?.[1] ?? null) : null;
  const canImprove = Boolean(certificate && potential && potential < certificate.grade_now);
  const step = certificate?.potential.replace(/^[A-G]\s*/, "") ?? "";
  const litresMonth = Math.round(latest?.litres ?? 0);
  const savedMonth = litresMonth * PETROL_NAIRA_PER_LITRE;
  const savedAll = Math.round(months.reduce((s, m) => s + m.litres, 0)) * PETROL_NAIRA_PER_LITRE;
  const lastPaid = data.payouts[0] ?? null;
  // Not every credit sells each period, so the honest guess is "about what you got last time".
  const nextEstimate = lastPaid?.amountNaira ?? 0;
  const periodEnd = lastPaid?.period?.end ?? data.dataAsOf;
  const nextAudit = periodEnd ? new Date(Date.UTC(+periodEnd.slice(0, 4), +periodEnd.slice(5, 7) + 6, 0)).toISOString().slice(0, 10) : null;
  const firstDay = home.daily[0]?.day ?? null;
  return { latest, potential, canImprove, step, litresMonth, savedMonth, savedAll, lastPaid, nextEstimate, nextAudit, firstDay };
}

export function healthOf(alerts: Alert[]): { tone: string; text: string } {
  const kinds = alerts.map((a) => a.kind);
  if (kinds.includes("no_data")) return { tone: "#dc2626", text: "No data from your inverter" };
  if (kinds.includes("low_output")) return { tone: "#e3a600", text: "Output lower than expected" };
  return { tone: "#3f9f12", text: "Working normally" };
}

/* ───────────── Formatting ─────────────
 * Done by hand rather than with Intl, so numbers and dates look the same on every phone.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function group(n: number): string {
  const [whole, fraction] = String(n).split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = whole.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${digits}${fraction ? `.${fraction}` : ""}`;
}

/** 4276 → "₦4,276". Rounds to whole naira, as the web's en-NG format does for these amounts. */
export const formatNaira = (value: number) => `₦${group(Math.round(value * 100) / 100)}`;
export const formatNumber = (value: number, digits = 0) => group(Number(value.toFixed(digits)));
export const kwh = (v: number) => `${group(Math.round(v * 10) / 10)} kWh`;
export const tco2 = (v: number, digits = 2) => `${v.toFixed(digits)} tCO₂e`;

export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthLabel = (key: string) => `${monthName(key)} ${key.slice(0, 4)}`;
const parts = (iso: string) => ({ y: iso.slice(0, 4), m: MONTHS[Number(iso.slice(5, 7)) - 1], d: String(Number(iso.slice(8, 10))) });
export const shortDate = (iso: string | null) => (iso ? `${parts(iso).d} ${parts(iso).m}` : "");
export const longDate = (iso: string | null) => (iso ? `${parts(iso).d} ${parts(iso).m} ${parts(iso).y}` : "Not recorded");
export const periodLabel = (period: Payout["period"]) => (period ? `${monthName(period.start)}–${monthName(period.end)} ${period.end.slice(0, 4)}` : "Audit period");
export const checkLabel = (name: string) => name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const homeCode = (siteId: number) => `KX-${String(siteId).padStart(4, "0")}`;
export const destinationLabel = (d: Payout["destination"]) => ({ solar_loan: "Solar loan", bank: "Bank account", wallet: "Access wallet" })[d];
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
