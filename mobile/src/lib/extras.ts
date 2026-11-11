import { api, ApiError } from "./api";

/* Endpoints beyond the dashboard: assistant, street, payout details and support. */

/* ───────────── Ask KlimateX (API v6) ───────────── */

export type Turn = { role: "user" | "assistant"; content: string };

export type AssistantReply = {
  answer: string;
  /** "model": written by the AI from the home's records. "guided": a fixed answer from the same records, used when the AI is unavailable. */
  mode: "model" | "guided";
  lang: string;
  /** Which records were read to answer. */
  sources: string[];
};

export const askAssistant = (message: string, lang: string, history: Turn[]) =>
  api<AssistantReply>("/api/assistant/ask", { method: "POST", body: { message, lang, history: history.slice(-6) }, timeoutMs: 45_000 });

export const SOURCE_LABELS: Record<string, string> = {
  home_overview: "Home summary",
  audit_status: "Audit checks",
  payouts: "Payouts",
  alerts: "Alerts",
  energy: "Solar readings",
  loan: "Solar loan",
  credit_tips: "Earn more tips",
};

/** Speech uses BCP 47 tags. Pidgin has none, so it listens and speaks as Nigerian English. */
export const SPEECH_LANG: Record<string, string> = { en: "en-NG", pcm: "en-NG", yo: "yo-NG", ig: "ig-NG", ha: "ha-NG" };

export const SUGGESTIONS: Record<string, string[]> = {
  en: ["How is my home doing?", "When do I get paid?", "Why was my month held?", "How can I earn more?", "How much did my panels make this week?", "How is my loan going?"],
  pcm: [
    "How my house dey?",
    "When dem go pay me?",
    "Why dem hold my money?",
    "How I go take earn more?",
    "How much light my panel make this week?",
    "Wetin dey happen with my loan?",
  ],
};

/* ───────────── Street grade (API v6) ───────────── */

export type Street = {
  id: number;
  name: string;
  area: string;
  grade: string;
  generator_share: number;
  homes_total: number;
  homes_on_klimatex: number;
  homes_verified: number;
  next_grade: string | null;
  homes_needed_for_next: number | null;
};

export const fetchHomeStreet = (siteId: number) => api<{ street: Street; home_grade: string | null; as_of: string | null }>(`/api/homes/${siteId}/street`);

export const nextStep = (s: Street) =>
  s.next_grade && s.homes_needed_for_next
    ? `${s.homes_needed_for_next} more verified solar ${s.homes_needed_for_next === 1 ? "home" : "homes"} would make it grade ${s.next_grade}.`
    : s.grade === "A"
      ? "Every home on this street runs mostly on clean power."
      : "More homes on verified solar will lift this grade.";

/** A feature the live server doesn't have yet answers 404 (or 405). Screens hide it or say "coming soon". */
export const notYetLive = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);

/* ───────────── Payout details ───────────── */

export type Bank = { code: string; name: string };

export type PayoutDetails = {
  method: "wallet" | "bank";
  wallet: { provider: string; phone: string | null } | null;
  bank: { bank_code: string; bank_name: string; account_ending: string; account_name: string } | null;
  has_loan: boolean;
  updated_at: string | null;
  banks: Bank[];
};

export const fetchPayoutDetails = () => api<PayoutDetails>("/api/homes/mine/payout-details");

/** Asks the bank whose name is on the account. Nothing is saved. */
export const checkAccount = (bankCode: string, account: string) =>
  api<{ account_name: string; bank_name: string }>("/api/homes/mine/payout-details/check", { method: "POST", body: { bank_code: bankCode, account } });

export const savePayoutDetails = (method: "wallet" | "bank", bankCode = "", account = "") =>
  api<PayoutDetails>("/api/homes/mine/payout-details", { method: "POST", body: { method, bank_code: bankCode, account } });

/** +2347000010012 → 0700 001 0012 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone || !phone.startsWith("+234") || phone.length !== 14) return phone ?? "";
  const local = "0" + phone.slice(4);
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** Accounts made at a first phone sign-in carry an internal placeholder address, which is never shown. */
export const realEmail = (email: string) => (email.endsWith("@households.klimatex.test") ? null : email);

/* ───────────── Support ───────────── */

export type TopicId = "system" | "payment" | "loan" | "certificate" | "account" | "other";
export type Contact = "app" | "sms" | "call";

export type SupportRequest = {
  id: number;
  reference: string;
  topic: TopicId;
  subject: string;
  message: string;
  contact: Contact;
  share_readings: boolean;
  status: string;
  created_at: string;
};

export const fetchSupportRequests = () => api<{ requests: SupportRequest[] }>("/api/support/requests").then((r) => r.requests);

export const sendSupportRequest = (body: { topic: TopicId; subject: string; message: string; contact: Contact; share_readings: boolean }) =>
  api<{ request: SupportRequest }>("/api/support/requests", { method: "POST", body }).then((r) => r.request);

/* ───────────── Credit tips and evidence (API v7) ───────────── */

export type ServerTip = {
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
  /** How much lower the home's credits are until its evidence is complete, as a whole percentage. An estimate. */
  credits_cut_pct: number;
  tips: ServerTip[];
};

export type Evidence = {
  baseline: {
    tier: "measured" | "surveyed";
    months: number;
    needed: number;
    missing_months: string[];
    from: string | null;
    to: string | null;
    litres_per_month?: number | null;
    deduction: number;
  };
  meter: { accuracy_pct: number | null; calibrated_on?: string | null; limit_pct?: number; within_limit: boolean; deduction: number };
  generator: { scrapped: boolean; scrapped_on?: string | null; deadline: string | null };
  receipts: { month: string; litres: number; amount_naira: number }[];
};

export const fetchHomeTips = (siteId: number) => api<HomeTips>(`/api/homes/${siteId}/tips`);
export const fetchEvidence = (siteId: number) => api<Evidence>(`/api/homes/${siteId}/evidence`);

/** Adds (or replaces) one month's fuel receipts from the year before solar. Returns the updated evidence. */
export const addFuelReceipt = (month: string, litres: number, amountNaira: number) =>
  api<Evidence>("/api/homes/mine/fuel-receipts", { method: "POST", body: { month, litres, amount_naira: amountNaira } });
