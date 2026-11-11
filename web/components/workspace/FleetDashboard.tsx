"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck,
  Coins,
  Gauge,
  Home,
  Landmark,
  Layers,
  LoaderCircle,
  PauseCircle,
  Printer,
  Radio,
  Sun,
  Wallet,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { ApiError } from "@/lib/api";
import { loadFleet, type Fleet, type FleetHome } from "@/lib/fleet";
import { longDate, periodLabel } from "@/lib/household";
import { formatNaira } from "@/lib/marketplace";
import { DataTable, type Column } from "@/components/household/DataTable";
import { Kpi, Panel, Pill } from "@/components/household/ui";
import { GradeBands, PowerMixChart, StatusDonut } from "./FleetCharts";
import { CreditTipsPanel } from "./CreditTipsPanel";

export type FleetVariant = "installer" | "lender" | "admin";

const GRADE_COLOUR: Record<string, string> = { A: "#14683f", B: "#2f8f00", C: "#86b82b", D: "#cdb51f", E: "#e3a600", F: "#e07a1f", G: "#c2410c" };
const kwh = (n: number) => `${Math.round(n).toLocaleString("en-NG")} kWh`;

function StatusPill({ status }: { status: FleetHome["status"] }) {
  if (status === "eligible") return <Pill tone="green"><BadgeCheck size={12} /> Credited</Pill>;
  if (status === "held") return <Pill tone="amber"><PauseCircle size={12} /> Held</Pill>;
  if (status === "excluded") return <Pill tone="red"><XCircle size={12} /> Excluded</Pill>;
  return <Pill tone="grey">Not audited</Pill>;
}

function Health({ home }: { home: FleetHome }) {
  const map = {
    reporting: { dot: "bg-leaf", text: "Reporting" },
    low_output: { dot: "bg-[#e3a600]", text: "Low output" },
    offline: { dot: "bg-red-500", text: "Offline" },
  }[home.health];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${map.dot} ${home.health === "reporting" ? "shadow-[0_0_0_3px_rgba(47,143,0,0.15)]" : ""}`} />
      {map.text}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-muted">–</span>;
  return <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-bold text-white" style={{ background: GRADE_COLOUR[grade] }}>{grade}</span>;
}

function TrustBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted">–</span>;
  const tone = score >= 80 ? "bg-leaf" : score >= 60 ? "bg-[#e3a600]" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#eef3ec]"><span className={`block h-full ${tone}`} style={{ width: `${score}%` }} /></span>
      <span className="tabular-nums">{score}</span>
    </span>
  );
}

/** Why a home needs a look, in plain words, most urgent first. */
function attention(homes: FleetHome[]) {
  const items: { home: FleetHome; tone: "red" | "amber"; title: string; body: string; icon: typeof WifiOff }[] = [];
  for (const h of homes) {
    if (h.health === "offline") items.push({ home: h, tone: "red", icon: WifiOff, title: "Inverter offline", body: `No data since ${longDate(h.last_reading)}. Book a visit.` });
    if (h.status === "excluded") items.push({ home: h, tone: "red", icon: XCircle, title: "Excluded this period", body: "Failed checks. No credits until the cause is fixed." });
    if (h.status === "held") items.push({ home: h, tone: "amber", icon: PauseCircle, title: "Held for auditor review", body: `Trust score ${h.trust_score ?? "–"}. Credits wait for the auditor.` });
    if (h.health === "low_output") items.push({ home: h, tone: "amber", icon: AlertTriangle, title: "Low output this week", body: "Panels may need cleaning, or there is shade." });
  }
  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "red" ? -1 : 1));
}

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function FleetDashboard({ variant }: { variant: FleetVariant }) {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    loadFleet()
      .then(setFleet)
      .catch((e) => setError(e instanceof ApiError ? e.message : "The fleet couldn't be loaded. Try again."));
  }, []);

  const homes = useMemo(() => fleet?.homes ?? [], [fleet]);
  const rows = homes.filter((h) => status === "all" || h.status === status || h.health === status);
  const issues = useMemo(() => attention(homes), [homes]);

  if (error) return <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>;
  if (!fleet) return <div className="flex items-center gap-2 py-16 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" /> Loading homes…</div>;

  const t = fleet.totals;
  const lender = variant !== "installer";
  const loans = homes.filter((h) => h.loan);
  const families = t.paid_households_naira - t.loan_repaid_naira;

  const columns: Column<FleetHome>[] = [
    { id: "home", header: "Home", value: (h) => h.label, cell: (h) => (
      <span>
        <span className="block font-medium">{h.label}</span>
        <span className="block text-[12px] text-muted">{h.household} · {h.area}</span>
      </span>
    ) },
    { id: "status", header: "Audit", value: (h) => h.status ?? "", cell: (h) => <StatusPill status={h.status} /> },
    { id: "health", header: "Inverter", value: (h) => h.health, cell: (h) => <Health home={h} /> },
    { id: "last", header: "Last reading", value: (h) => h.last_reading ?? "", cell: (h) => <span className="text-body">{longDate(h.last_reading)}</span> },
    { id: "kwh", header: "Solar (period)", align: "right", value: (h) => h.kwh_period, cell: (h) => kwh(h.kwh_period) },
    { id: "t", header: "Carbon", align: "right", value: (h) => h.tco2e, cell: (h) => <Co2Text text={`${h.tco2e.toFixed(2)} tCO₂e`} /> },
    { id: "trust", header: "Trust", value: (h) => h.trust_score ?? -1, cell: (h) => <TrustBar score={h.trust_score} /> },
    { id: "grade", header: "Grade", value: (h) => h.grade ?? "", cell: (h) => <GradeBadge grade={h.grade} /> },
    ...(lender ? [{ id: "paid", header: "Paid to family", align: "right" as const, value: (h: FleetHome) => h.paid_naira, cell: (h: FleetHome) => formatNaira(h.paid_naira) }] : []),
    { id: "inv", header: "Inverter ID", value: (h) => h.inverter, cell: (h) => <span className="font-mono text-[12px] text-body">{h.inverter}</span> },
  ];

  return (
    <div className="space-y-5">
      <style>{`@media print { aside, .print-hide { display: none !important; } main { padding: 0 !important; } }`}</style>

      {/* Context bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {fleet.period && (
          <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px]">
            <CalendarCheck size={15} className="text-leaf" /> {periodLabel({ start: fleet.period.start, end: fleet.period.end })}
            <span className="text-muted">· {fleet.period.status === "signed" ? `signed ${longDate(fleet.period.signed_at)}` : fleet.period.status}</span>
          </span>
        )}
        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px]">
          <Radio size={15} className="text-leaf" /> Latest data {longDate(fleet.as_of)}
        </span>
        {fleet.installer && <span className="inline-flex h-9 items-center rounded-lg bg-mint px-3 text-[13px] font-medium text-forest">{fleet.installer}</span>}
        <button type="button" onClick={() => window.print()} className="print-hide ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-forest px-3.5 text-[13px] font-medium text-white hover:bg-forest-hover">
          <Printer size={15} /> Print report
        </button>
      </div>

      {/* Headline numbers */}
      <div id={slug(lender ? "Portfolio" : "Overview")} className="grid scroll-mt-6 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {lender ? (
          <>
            <Kpi icon={Home} label="Homes monitored" value={t.homes} detail={`${t.loans} with an Access solar loan`} />
            <Kpi icon={Gauge} label="Homes on grade A or B" value={`${t.a_or_b} of ${t.homes}`} detail={`${Math.round((t.a_or_b / Math.max(1, t.homes)) * 100)}% almost free of generators`} />
            <Kpi icon={Landmark} label="Carbon repayments" value={formatNaira(t.loan_repaid_naira)} detail="Paid straight into solar loans" />
            <Kpi icon={Wallet} label="Wallet and bank inflows" value={formatNaira(families)} detail="Carbon income to families' accounts" />
          </>
        ) : (
          <>
            <Kpi icon={Home} label="Homes installed" value={t.homes} detail={`${t.eligible} credited · ${t.held} held · ${t.excluded} excluded`} />
            <Kpi icon={Sun} label="Solar generated" value={kwh(t.kwh_period)} detail={`${kwh(t.kwh_week)} in the last 7 days`} />
            <Kpi icon={Layers} label="Carbon credited" value={<Co2Text text={`${t.tco2e.toFixed(2)} tCO₂e`} />} detail={`${fleet.credits.issued} credits issued · ${fleet.credits.retired} retired`} />
            <Kpi icon={Coins} label="Your earnings" value={formatNaira(t.installer_earnings_naira)} detail="15% of every credit sold" />
          </>
        )}
      </div>

      {/* Status and energy */}
      <div id={slug(lender ? "Grades" : "Energy")} className="grid scroll-mt-6 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        {lender ? (
          <Panel title="Homes by energy grade" description="Share of power still from a generator, measured from each inverter.">
            <GradeBands grades={fleet.grades} />
            <p className="mt-4 rounded-xl bg-[#f6f8f5] px-3.5 py-2.5 text-[12.5px] text-body">Average trust score <strong className="text-ink">{t.avg_trust ?? "–"}</strong> across {t.homes} homes. A metered grade is a lending signal no survey can give.</p>
          </Panel>
        ) : (
          <Panel title="Fleet status" description={`Audit result for ${fleet.period ? periodLabel({ start: fleet.period.start, end: fleet.period.end }) : "the latest period"}.`}>
            <StatusDonut totals={t} />
          </Panel>
        )}
        <Panel title="Where the homes' power came from" description="Monthly kWh across every home. Generator backup is what's left to replace.">
          <PowerMixChart months={fleet.monthly} />
        </Panel>
      </div>

      {/* Loans (lender) and attention */}
      <div id={slug(lender ? "Solar loans" : "Attention")} className={`grid scroll-mt-6 gap-5 ${lender ? "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]" : ""}`}>
        {lender && (
          <Panel title="Solar loans" description="Carbon payouts go straight to the loan while it is open." flush>
            {loans.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-body">No homes have a solar loan yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13.5px]">
                  <thead className="bg-[#fafbf9] text-[12px] text-muted">
                    <tr><th className="px-5 py-3 font-semibold">Loan</th><th className="px-4 py-3 font-semibold">Home</th><th className="px-4 py-3 font-semibold">Grade</th><th className="px-4 py-3 font-semibold">Trust</th><th className="px-5 py-3 text-right font-semibold">Repaid from carbon</th></tr>
                  </thead>
                  <tbody>
                    {loans.map((h) => (
                      <tr key={h.id} className="border-t border-line">
                        <td className="px-5 py-3.5 font-mono text-[12.5px]">{h.loan}</td>
                        <td className="px-4 py-3.5"><span className="font-medium">{h.label}</span> <span className="text-muted">· {h.household}</span></td>
                        <td className="px-4 py-3.5"><GradeBadge grade={h.grade} /></td>
                        <td className="px-4 py-3.5"><TrustBar score={h.trust_score} /></td>
                        <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatNaira(h.loan_repaid_naira)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
        <Panel title="Needs attention" description={issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} across ${new Set(issues.map((i) => i.home.id)).size} homes` : "Every home is reporting and credited."} flush>
          {issues.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-body"><BadgeCheck size={17} className="text-leaf" /> All clear.</p>
          ) : (
            <ul className={lender ? "" : "grid sm:grid-cols-2 xl:grid-cols-3"}>
              {issues.map((i) => (
                <li key={`${i.home.id}-${i.title}`} className="flex gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${i.tone === "red" ? "bg-red-50 text-red-700" : "bg-[#fdf3d7] text-[#8a5a00]"}`}><i.icon size={17} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">{i.home.label} · {i.title}</span>
                    <span className="block text-[12.5px] text-body">{i.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {!lender && <CreditTipsPanel />}

      {/* Every home */}
      <div id="homes" className="scroll-mt-6">
        <Panel title={lender ? "Every home" : "Your homes"} description="Search, sort and export. Data comes straight from each inverter." flush>
          <DataTable<FleetHome>
            rows={rows}
            columns={columns}
            rowKey={(h) => h.id}
            searchText={(h) => `${h.label} ${h.household} ${h.area} ${h.inverter} ${h.loan ?? ""}`}
            searchPlaceholder="Search home, family or inverter"
            exportName={`klimatex-${lender ? "portfolio" : "fleet"}`}
            initialSort={{ id: "home", dir: "asc" }}
            pageSizes={[10, 20, 50]}
            empty="No homes match."
            filters={
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] outline-none focus:border-leaf">
                <option value="all">All homes</option>
                <option value="eligible">Credited</option>
                <option value="held">Held</option>
                <option value="excluded">Excluded</option>
                <option value="offline">Offline</option>
                <option value="low_output">Low output</option>
              </select>
            }
          />
        </Panel>
      </div>
    </div>
  );
}
