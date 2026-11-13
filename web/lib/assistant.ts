import { api } from "./api";

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
  api<AssistantReply>("/api/assistant/ask", { method: "POST", body: { message, lang, history: history.slice(-6) } });

export const SOURCE_LABELS: Record<string, string> = {
  home_overview: "Home summary",
  audit_status: "Audit checks",
  payouts: "Payouts",
  alerts: "Alerts",
  energy: "Solar readings",
  loan: "Solar loan",
  my_progress: "Your sign-up",
  solar_packages: "Packages and prices",
  loan_options: "Loan pre-check",
  how_it_works: "How KlimateX works",
};

/** Browser speech uses BCP 47 tags. Pidgin has none, so it listens and speaks as Nigerian English. */
export const SPEECH_LANG: Record<string, string> = { en: "en-NG", pcm: "en-NG", yo: "yo-NG", ig: "ig-NG", ha: "ha-NG" };

export const SUGGESTIONS: Record<string, string[]> = {
  en: ["How is my home doing?", "When do I get paid?", "Why was my month held?", "How much did my panels make this week?", "How is my loan going?"],
  pcm: ["How my house dey?", "When dem go pay me?", "Why dem hold my money?", "How much light my panel make this week?", "Wetin dey happen with my loan?"],
};

/** Starter questions for a family that is still signing up (the AI reads their progress, packages, prices and the loan pre-check). */
export const SIGNUP_SUGGESTIONS: Record<string, string[]> = {
  en: ["How much will my system cost?", "How does the loan work?", "What happens on install day?", "Can I change my package?"],
  pcm: ["How much my system go cost?", "How the loan dey work?", "Wetin go happen for install day?", "I fit change my package?"],
};
