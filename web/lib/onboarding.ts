import { api, phoneVerify, post, saveSession, type Session } from "./api";
import { formatNaira } from "./marketplace";

/** Family self-onboarding (docs/ONBOARDING_FLOW.md): the website's view of the API. */

export type Estimate = {
  solar_kwh_year: number;
  generator_kwh_year: number;
  petrol_litres_year: number;
  tonnes_year: number;
  family_carbon_naira_year: number;
  basis: string;
};

export type Package = {
  id: number;
  installer_id: number;
  name: string;
  inverter_kva: number;
  battery_kwh: number;
  panels: number;
  panel_w: number;
  panel_kwp: number;
  powers: string;
  price_min_naira: number;
  price_max_naira: number;
  estimate: Estimate;
};

export type Installer = {
  id: number;
  name: string;
  area: string;
  blurb: string;
  accreditation_id: string;
  metered_homes: number;
  average_trust_score: number | null;
  packages: Package[];
};

export type Catalogue = {
  installers: Installer[];
  price_range_naira: [number, number];
  family_home_range_naira: [number, number];
  note: string;
  options: {
    income_bands: { key: string; label: string; limit_naira: number }[];
    generator: { key: string; label: string }[];
    inverter_brands: string[];
    estimate_existing_solar: Estimate;
  };
};

export type Path = "need" | "have";
export type NextAction = "loan_check" | "send_request" | "link_inverter" | "generator" | "pick_installer" | "accept_quote" | null;

export type OnboardingStep = { key: string; label: string; done: boolean; current: boolean; at: string | null };

export type OnboardingView = {
  id: number;
  path: Path;
  status: string;
  certified: boolean;
  site_id: number | null;
  area: string;
  package: Omit<Package, "estimate"> & { estimate?: Estimate } | null;
  installer: Omit<Installer, "packages"> | null;
  payment: "cash" | "loan" | null;
  loan: { income_band: string | null; limit_naira: number | null; monthly_naira: number | null; months: number; cap_naira: number | null; status: string | null; loan_id: string | null } | null;
  quote_naira: number | null;
  survey_on: string | null;
  inverter: { brand: string | null; serial: string | null };
  generator: string | null;
  steps: OnboardingStep[];
  next: { by: "family" | "installer" | null; action: NextAction; text: string };
  estimate: Estimate;
  events: { status: string; at: string; note?: string; label: string }[];
};

export type OnboardingRequest = OnboardingView & {
  family: string;
  phone: string;
  requested_at: string;
  actions: ("accept" | "survey" | "quote" | "complete" | "verify")[];
};

export const loadCatalogue = () => api<Catalogue>("/api/onboarding/installers");

export const startPhone = (phone: string) =>
  post<{ next: "signin" | "code"; phone: string; expires_in?: number; demo_code?: string }>("/api/onboarding/phone", { phone });

export const verifyPhone = phoneVerify;

export type AccountInput = { setup_token: string; pin: string; name: string; area: string; path: Path; package_id?: number; payment?: "cash" | "loan" };

/** Creates the account and signs the family in, storing the session exactly like the phone sign-in does. */
export async function createAccount(input: AccountInput): Promise<OnboardingView> {
  const result = await post<Session & { onboarding: OnboardingView }>("/api/onboarding/account", input);
  saveSession({ access_token: result.access_token, refresh_token: result.refresh_token, user: result.user });
  return result.onboarding;
}

export const loadMine = () => api<OnboardingView>("/api/onboarding/mine");
export const saveAnswers = (body: { income_band?: string; inverter_brand?: string; inverter_serial?: string; generator?: string }) =>
  api<OnboardingView>("/api/onboarding/mine/answers", { method: "POST", body });
export const submitRequest = (installerId?: number) =>
  api<OnboardingView>("/api/onboarding/mine/submit", { method: "POST", body: installerId ? { installer_id: installerId } : {} });
export const acceptQuote = () => api<OnboardingView>("/api/onboarding/mine/accept-quote", { method: "POST" });

export const loadRequests = () => api<{ requests: OnboardingRequest[] }>("/api/onboarding/requests").then((r) => r.requests);
export const actOnRequest = (id: number, action: OnboardingRequest["actions"][number], body: { date?: string; amount_naira?: number } = {}) =>
  api<OnboardingRequest>(`/api/onboarding/requests/${id}/${action}`, { method: "POST", body });

/* Formatting shared by the sign-up pages, the tracker and the installer's requests. */

export const priceRange = (min: number, max: number) => (min === max ? formatNaira(min) : `${formatNaira(min)} – ${formatNaira(max)}`);
export const number = (value: number) => Math.round(value).toLocaleString("en-NG");
export const packageSpec = (p: Pick<Package, "inverter_kva" | "battery_kwh" | "panels" | "panel_w">) =>
  `${p.inverter_kva} kVA inverter · ${p.battery_kwh} kWh battery · ${p.panels} × ${p.panel_w} W panels`;

export const GENERATOR_LABEL: Record<string, string> = { trade_in: "Trade it in", backup: "Keep it as backup", none: "No generator" };

/** Where a family with an unfinished step continues on the website. */
export const CONTINUE_HREF = "/get-started/?continue=1";
