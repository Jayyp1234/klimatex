import type { HomeTips, ServerTip } from "./extras";
import { dayStatus, longDate, overviewFigures, type Check, type Dashboard } from "./household";

/**
 * "Earn more" tips. Each one is worked out from the home's own audit checks and readings, so a family
 * sees what is costing them credits right now, not generic advice. The rules mirror the server's nine
 * checks: a day that fails earns nothing, and some failures hold the whole period.
 */

export type TipState = "urgent" | "improve" | "good";
export type TipAction = { label: string; href: "/support" | "/certificate" | "/readings" | "/loan" | "/receipts" };

export type TipIcon = "zap-off" | "wifi" | "sun" | "activity" | "trash-2" | "battery-charging" | "file-text" | "sliders" | "map-pin" | "alert-circle";

export type Tip = {
  id: string;
  icon: TipIcon;
  title: string;
  /** What is happening on this home, with its own numbers. */
  body: string;
  /** What to do about it. Empty when nothing is needed. */
  step: string;
  state: TipState;
  /** True when the fix is the installer's job, not the family's. */
  installer?: boolean;
  action?: TipAction;
};

const ORDER: Record<TipState, number> = { urgent: 0, improve: 1, good: 2 };
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const percent = (share: number) => `${Math.round(share * 1000) / 10}%`;
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function earnMoreTips(data: Dashboard): Tip[] {
  const { home, certificate } = data;
  // The home's own check list carries the evidence (share, missing days); the certificate's copy has results only.
  const checks: Check[] = home.checks.length ? home.checks : (certificate?.checks ?? []);
  const check = (name: string) => checks.find((c) => c.name === name);
  const failed = (name: string) => {
    const c = check(name);
    return c !== undefined && c.result !== "pass";
  };
  const tips: Tip[] = [];

  /* Backup generator: over the limit, the whole period earns nothing. */
  const backup = check("backup_share");
  const used = home.daily.reduce((s, d) => s + d.toLoad + d.grid + d.backup, 0);
  const share = typeof backup?.evidence?.share === "number" ? backup.evidence.share : used > 0 ? home.daily.reduce((s, d) => s + d.backup, 0) / used : 0;
  const limit = num(backup?.evidence?.limit) || 0.1;
  if (backup && backup.result !== "pass") {
    tips.push({
      id: "backup",
      icon: "zap-off",
      title: "Backup generator is over the limit",
      body: `A backup generator supplied ${percent(share)} of your power. Above ${percent(limit)}, the whole period earns nothing.`,
      step: "Run heavy appliances while the sun is up, and ask your installer whether a battery would cover your evenings.",
      state: "urgent",
      action: { label: "Contact Support", href: "/support" },
    });
  } else if (share > limit * 0.6) {
    tips.push({
      id: "backup",
      icon: "zap-off",
      title: "Backup generator is close to the limit",
      body: `A backup generator supplied ${percent(share)} of your power. The limit is ${percent(limit)}, and every backup kWh also takes a little off your credits.`,
      step: "Move washing, ironing and pumping to daylight hours so solar carries them.",
      state: "improve",
    });
  } else {
    tips.push({
      id: "backup",
      icon: "zap-off",
      title: "Very little backup generator use",
      body: `A backup generator supplied ${share < 0.005 ? "almost none" : percent(share)} of your power, well under the ${percent(limit)} limit.`,
      step: "",
      state: "good",
    });
  }

  /* Missing days: a day with no reading is credited as zero. */
  const missing = num(check("missing_data")?.evidence?.missing_days);
  const offline = data.alerts.some((a) => a.kind === "no_data");
  if (offline || missing > 0) {
    tips.push({
      id: "connection",
      icon: "wifi",
      title: offline ? "Your inverter has stopped reporting" : `${days(missing)} had no reading`,
      body: offline ? "No data is arriving from your inverter. Days without a reading earn nothing." : "A day with no reading earns nothing, even if your panels were working.",
      step: "Keep the inverter switched on and check its Wi-Fi light. If it stays off for a day, tell us and we'll send your installer.",
      state: offline ? "urgent" : "improve",
      action: { label: "Contact Support", href: "/support" },
    });
  } else {
    tips.push({ id: "connection", icon: "wifi", title: "Inverter reporting every day", body: "No days are missing from your audited period.", step: "", state: "good" });
  }

  /* Low output: dusty or shaded panels make fewer kWh, so fewer credits. */
  const recent = home.daily.slice(-30);
  const low = recent.filter((d) => dayStatus(d) === "low").length;
  const measured = recent.filter((d) => d.ceiling);
  const captured = measured.length ? measured.reduce((s, d) => s + d.generated / (d.ceiling as number), 0) / measured.length : 0;
  if (low >= 3) {
    tips.push({
      id: "panels",
      icon: "sun",
      title: `Low output on ${days(low)} of the last ${recent.length}`,
      body: "On those days your panels made well under what the sunlight allowed. Dust, bird droppings or new shade are the usual causes.",
      step: "Rinse the panels with clean water in the cool of the morning. If they're on the roof, ask your installer to do it.",
      state: "improve",
      action: { label: "See the days", href: "/readings" },
    });
  } else if (measured.length) {
    tips.push({
      id: "panels",
      icon: "sun",
      title: "Panels are making good use of the sun",
      body: `Over the last ${recent.length} days your panels reached ${Math.round(captured * 100)}% of the sunlight ceiling.`,
      step: "",
      state: "good",
    });
  }

  /* Readings the auditor can't accept: these days earn nothing, or the period is held for review. */
  const overLimit = num(check("sunlight")?.evidence?.days_over_limit) + num(check("sunlight")?.evidence?.days_without_irradiance);
  const spikes = num(check("spike")?.evidence?.days);
  const flagged = ["clone", "flat_line", "energy_balance", "identity"].filter(failed);
  if (overLimit + spikes > 0 || flagged.length > 0) {
    const zeroDays = overLimit + spikes;
    tips.push({
      id: "readings",
      icon: "activity",
      title: zeroDays > 0 ? `${days(zeroDays)} failed a meter check` : "Your readings need an auditor's look",
      body:
        zeroDays > 0
          ? "Those days read higher than the sun allowed or jumped far above your usual output, so they earn nothing. It is usually a meter fault."
          : "A check flagged your readings, so an auditor reviews them before any credit is issued.",
      step: "Tell us if anything changed on your system. A quick installer visit normally clears it.",
      // Days that earned nothing are already costing credits; so is a flag that holds the whole period.
      state: zeroDays > 0 || failed("clone") || failed("identity") ? "urgent" : "improve",
      action: { label: "Contact Support", href: "/support" },
    });
  } else if (checks.length) {
    tips.push({
      id: "readings",
      icon: "activity",
      title: "Every reading passed the meter checks",
      body: "No day read higher than the sun allowed, and nothing looked copied or stuck.",
      step: "",
      state: "good",
    });
  }

  /* Generator proof: no credits until the scrap certificate is on file. */
  if (failed("decommissioned")) {
    tips.push({
      id: "generator",
      icon: "trash-2",
      title: "Your old generator isn't recorded as scrapped",
      body: "A credit only counts if the generator can never run again. Until the recycler's certificate is on file, no credits are issued for your home.",
      step: "Ask your installer for the scrap certificate number.",
      state: "urgent",
      action: { label: "Contact Support", href: "/support" },
    });
  } else if (home.generator.scrappedOn) {
    tips.push({
      id: "generator",
      icon: "trash-2",
      title: "Old generator scrapped and proven",
      body: `Scrapped on ${longDate(home.generator.scrappedOn)}${home.generator.certificate ? `, certificate ${home.generator.certificate}` : ""}.`,
      step: "",
      state: "good",
    });
  }

  /* Grade: the certificate names the next step when a better grade is within reach. */
  const f = overviewFigures(data);
  if (certificate && f.canImprove) {
    tips.push({
      id: "grade",
      icon: "battery-charging",
      title: `Grade ${f.potential} is within reach`,
      body: `Your home is grade ${certificate.grade_now}. The next step is ${f.step}. Less generator time earns more credits.`,
      step: "The step can be financed with an Access solar loan, and your carbon payouts help repay it.",
      state: "improve",
      action: { label: "See my certificate", href: "/certificate" },
    });
  } else if (certificate) {
    tips.push({
      id: "grade",
      icon: "battery-charging",
      title: `Grade ${certificate.grade_now}, the top grade`,
      body: "Almost all your power is clean, so your home earns close to the most it can.",
      step: "",
      state: "good",
    });
  }

  return tips.sort((a, b) => ORDER[a.state] - ORDER[b.state]);
}

export const tipsToImprove = (tips: Tip[]) => tips.filter((t) => t.state !== "good").length;

/* ───────────── Tips from the server (API v7) ─────────────
 * The server works the same tips out from more evidence (fuel receipts, meter accuracy), so they
 * are used when it has them. The tips above are the fallback for a server without the endpoint.
 */

const KIND_ICON: Record<string, TipIcon> = {
  offline: "wifi",
  missing_data: "wifi",
  low_output: "sun",
  generator: "trash-2",
  backup: "zap-off",
  fuel_receipts: "file-text",
  meter: "sliders",
  impossible_days: "activity",
  clone: "activity",
  flat_line: "activity",
  energy_balance: "activity",
  identity: "map-pin",
};

/** The server links to web pages; these are the same places in the app. A tip with a label but no link goes to Support. */
function appAction(tip: ServerTip): TipAction | undefined {
  if (!tip.action || tip.status === "done") return undefined;
  const href = tip.action.href ?? "";
  if (href.includes("/receipts")) return { label: tip.action.label, href: "/receipts" };
  if (href.includes("/certificate")) return { label: tip.action.label, href: "/certificate" };
  if (href.includes("/loan")) return { label: tip.action.label, href: "/loan" };
  if (href.includes("/readings")) return { label: tip.action.label, href: "/readings" };
  return { label: tip.action.label, href: "/support" };
}

export function fromServerTips(result: HomeTips): Tip[] {
  return result.tips
    .map<Tip>((tip) => ({
      id: tip.id,
      icon: KIND_ICON[tip.kind] ?? "alert-circle",
      title: tip.title,
      body: tip.body,
      step: "",
      state: tip.status === "done" ? "good" : tip.priority === "high" ? "urgent" : "improve",
      installer: tip.who === "installer",
      action: appAction(tip),
    }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state]);
}
