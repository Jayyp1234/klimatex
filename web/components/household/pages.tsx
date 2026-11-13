"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Fuel,
  Gauge,
  Landmark,
  Leaf,
  Sun,
  TriangleAlert,
  Trophy,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import {
  dayStatus,
  destinationLabel,
  homeCode,
  longDate,
  monthLabel,
  monthName,
  PETROL_NAIRA_PER_LITRE,
  periodLabel,
  shortDate,
  type Alert,
  type Day,
  type Month,
  type Payout,
} from "@/lib/household";
import { formatNaira } from "@/lib/marketplace";
import { CertificateDocument } from "./CertificateDocument";
import { DataTable, type Column } from "./DataTable";
import { LoanView } from "./LoanView";
import { NotificationsView } from "./NotificationsView";
import { PreferencesView } from "./PreferencesView";
import { ProfileView } from "./ProfileView";
import { StreetCard } from "./StreetCard";
import { CreditTips } from "./CreditTips";
import { verifySerial } from "./Dialogs";
import { EnergyChart, SERIES_COLOURS } from "./EnergyChart";
import { alertIcon, useHousehold } from "./HouseholdShell";
import { Kpi, PageHeader, Panel, Pill, ViewAll, buttonSecondary, selectClass } from "./ui";

const BASE = "/app/household/";
const kwh = (v: number) => `${v.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kWh`;
const t = (v: number, digits = 2) => <Co2Text text={`${v.toFixed(digits)} tCO₂e`} />;

function StatusPill({ status }: { status: string }) {
  if (status === "paid") return <Pill tone="green"><CheckCircle2 size={12} /> Paid</Pill>;
  if (status === "failed") return <Pill tone="red">Retrying</Pill>;
  return <Pill tone="amber">Processing</Pill>;
}

function DayPill({ day }: { day: Day }) {
  const s = dayStatus(day);
  if (s === "above") return <Pill tone="red">Above ceiling</Pill>;
  if (s === "low") return <Pill tone="amber">Low output</Pill>;
  return <Pill tone="green">Normal</Pill>;
}

function ChartControls({ solar, ceiling, onSolar, onCeiling }: { solar: boolean; ceiling: boolean; onSolar: (v: boolean) => void; onCeiling: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[13px]">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={solar} onChange={(e) => onSolar(e.target.checked)} className="h-4 w-4 accent-[#14683f]" />
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLOURS.solar }} /> Solar energy
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={ceiling} onChange={(e) => onCeiling(e.target.checked)} className="h-4 w-4 accent-[#e3a600]" />
        <span className="h-0.5 w-3 rounded" style={{ background: SERIES_COLOURS.ceiling }} /> Sunlight ceiling
      </label>
    </div>
  );
}

function useHealth() {
  const { data } = useHousehold();
  const kinds = data.alerts.map((a) => a.kind);
  if (kinds.includes("no_data")) return { tone: "bg-red-600", text: "No data from your inverter" };
  if (kinds.includes("low_output")) return { tone: "bg-[#e3a600]", text: "Output lower than expected" };
  return { tone: "bg-[#3f9f12]", text: "Working normally" };
}

/* ───────────────────────── Dashboard ───────────────────────── */

export function OverviewPage() {
  const { user, data, alerts, openHeld, openPayout } = useHousehold();
  const { home, certificate } = data;
  const health = useHealth();
  const [solar, setSolar] = useState(true);
  const [ceiling, setCeiling] = useState(true);
  const months = home.months;
  const latest = months[months.length - 1];
  const warning = alerts.find((a) => a.severity !== "info");
  const days = home.daily.slice(-14);

  // Grade: only offer an upgrade when the certificate names a better grade.
  const potential = certificate ? /^([A-G])\b/.exec(certificate.potential.trim())?.[1] ?? null : null;
  const canImprove = Boolean(certificate && potential && potential < certificate.grade_now);
  const step = certificate?.potential.replace(/^[A-G]\s*/, "") ?? "";

  // Money first: petrol saved in naira, and when the next payment should land.
  const litresMonth = Math.round(latest?.litres ?? 0);
  const savedMonth = litresMonth * PETROL_NAIRA_PER_LITRE;
  const savedAll = Math.round(months.reduce((s, m) => s + m.litres, 0)) * PETROL_NAIRA_PER_LITRE;
  const lastPaid = data.payouts[0];
  // Not every credit sells each period, so the honest guess is "about what you got last time".
  const nextEstimate = lastPaid?.amountNaira ?? 0;
  const periodEnd = lastPaid?.period?.end ?? data.dataAsOf;
  const nextAudit = periodEnd ? new Date(Date.UTC(+periodEnd.slice(0, 4), +periodEnd.slice(5, 7) + 6, 0)).toISOString().slice(0, 10) : null;
  const firstDay = home.daily[0]?.day ?? null;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name}`}
        description={`${homeCode(home.siteId)} · ${home.area}, Lagos · Latest reading ${longDate(data.dataAsOf)}${firstDay && home.status ? ` · audited period ${periodLabel({ start: firstDay, end: data.dataAsOf ?? firstDay })}` : ""}`}
      />

      <section className="relative overflow-hidden rounded-2xl bg-forest px-6 py-5 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-lime/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:flex"><Sun size={24} className="text-[#ffc629]" /></span>
          <div className="min-w-0 flex-1">
            {!certificate ? (
              <>
                <p className="text-[19px] font-semibold tracking-tight">Keep your home running on clean energy</p>
                <p className="text-sm text-white/75">{data.certificateNote ?? "Your grade, savings and payouts appear after your first audited period."}</p>
              </>
            ) : canImprove ? (
              <>
                <p className="text-[19px] font-semibold tracking-tight">Your home is grade {certificate.grade_now}. Grade {potential} is within reach.</p>
                <p className="text-sm text-white/75">Next step: {step}. Less generator time earns you more from every payout.</p>
              </>
            ) : (
              <>
                <p className="text-[19px] font-semibold tracking-tight">Your home is grade {certificate.grade_now}, the top grade.</p>
                <p className="text-sm text-white/75">Almost all your power is clean. Keep the generator off and every month keeps earning.</p>
              </>
            )}
          </div>
          <Link href={`${BASE}certificate/`} className="w-full rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-forest transition hover:bg-mint sm:w-auto">
            {canImprove ? "Improve my grade" : "View my certificate"}
          </Link>
        </div>
      </section>

      {warning && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-[#f1d9a6] bg-[#fdf6e6] px-4 py-3 text-sm text-[#5c3d00]">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1"><strong>{warning.title}.</strong> {warning.body}</span>
          {warning.kind === "held" && <button type="button" onClick={openHeld} className="font-semibold underline">See why</button>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {latest && (
          <Kpi
            icon={Fuel}
            label="Saved on petrol"
            value={`≈ ${formatNaira(Math.round(savedMonth))}`}
            trend={months.map((m) => m.litres)}
            detail={`${Math.round(litresMonth)} L in ${monthName(latest.month)} · ≈ ${formatNaira(Math.round(savedAll))} since you switched`}
          />
        )}
        <Kpi icon={Wallet} label="Paid to you" value={formatNaira(data.paidNaira)} detail={lastPaid ? `Last paid ${shortDate(lastPaid.paidOn)} · ${destinationLabel(lastPaid.destination)}` : "First payment after your first audit"} />
        <Kpi
          icon={CalendarDays}
          label="Next payment"
          value={nextEstimate > 0 ? `≈ ${formatNaira(Math.round(nextEstimate))}` : "After next audit"}
          detail={nextAudit ? `${nextEstimate > 0 ? "Similar to last time · " : ""}after the ${longDate(nextAudit)} audit` : "Paid automatically"}
        />
        {latest && <Kpi icon={Zap} label="Clean energy" value={kwh(latest.solarKwh)} trend={months.map((m) => m.solarKwh)} detail={<>{monthLabel(latest.month)} · {t(latest.tonnes)} avoided</>} />}
      </div>

      <StreetCard />

      <CreditTips />

      <Panel
        title="Your energy, last 14 days"
        description={<span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${health.tone}`} />{health.text} · kWh per day</span>}
        actions={<div className="flex flex-wrap items-center gap-4"><ChartControls solar={solar} ceiling={ceiling} onSolar={setSolar} onCeiling={setCeiling} /><ViewAll href={`${BASE}energy/`}>Energy overview</ViewAll></div>}
      >
        <EnergyChart days={days} showSolar={solar} showCeiling={ceiling} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Recent payouts" actions={<ViewAll href={`${BASE}payouts/`} />} flush>
          <DataTable<Payout>
            rows={data.payouts.slice(0, 5)}
            rowKey={(p) => p.id}
            onRowClick={openPayout}
            pageSizes={[5]}
            empty="No payouts yet. Your first one follows the next audit and sale."
            columns={[
              { id: "period", header: "Audit period", cell: (p) => <span className="font-medium">{periodLabel(p.period)}</span> },
              { id: "tonnes", header: "Carbon earned", cell: (p) => t(p.tonnes) },
              { id: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{formatNaira(p.amountNaira)}</span> },
              { id: "dest", header: "Destination", cell: (p) => destinationLabel(p.destination) },
              { id: "status", header: "Status", cell: (p) => <StatusPill status={p.status} /> },
            ]}
          />
        </Panel>

        <Panel title="Notifications" actions={<ViewAll href={`${BASE}notifications/`} />}>
          <AlertList alerts={alerts.slice(0, 3)} compact />
        </Panel>
      </div>
    </>
  );
}

function AlertList({ alerts, compact = false }: { alerts: Alert[]; compact?: boolean }) {
  const { dismiss, openHeld } = useHousehold();
  if (alerts.length === 0) return <p className="rounded-xl bg-mint px-4 py-6 text-center text-sm text-body">All clear. Nothing needs your attention.</p>;
  return (
    <ul className="space-y-2.5">
      {alerts.map((a) => {
        const { icon: AlertIcon, tone } = alertIcon[a.kind];
        return (
          <li key={a.id} className="flex items-start gap-3 rounded-xl border border-line bg-[#fbfcfa] p-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}><AlertIcon size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{a.title}</p>
                {compact && (
                  <button type="button" onClick={() => dismiss(a.id)} aria-label={`Dismiss ${a.title}`} className="-mr-1 rounded p-0.5 text-muted hover:bg-mint hover:text-ink"><X size={15} /></button>
                )}
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-body">{a.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                {a.kind === "held" ? <button type="button" onClick={openHeld} className="font-medium text-leaf hover:underline">See why</button> : <span />}
                <span>{shortDate(a.at)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── Energy ───────────────────────── */

const RANGES = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 0, label: "Whole period" },
];

export function EnergyOverviewPage() {
  const { data } = useHousehold();
  const health = useHealth();
  const [range, setRange] = useState(30);
  const [solar, setSolar] = useState(true);
  const [ceiling, setCeiling] = useState(true);
  const days = range ? data.home.daily.slice(-range) : data.home.daily;
  const total = days.reduce((s, d) => s + d.generated, 0);
  const best = days.reduce((b, d) => (d.generated > b.generated ? d : b), days[0]);
  const withCeiling = days.filter((d) => d.ceiling);
  const usage = withCeiling.length ? withCeiling.reduce((s, d) => s + d.generated / (d.ceiling as number), 0) / withCeiling.length : 0;
  const low = days.filter((d) => dayStatus(d) !== "normal").length;

  return (
    <>
      <PageHeader
        title="Energy overview"
        description={`What your panels made, against the most the sun allowed. ${data.home.panelKwp} kWp system · inverter ${data.home.inverter.serial}.`}
        actions={<select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Date range" className={selectClass}>{RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Zap} label="Solar generated" value={kwh(total)} detail={`${shortDate(days[0]?.day ?? null)} to ${longDate(days[days.length - 1]?.day ?? null)}`} />
        <Kpi icon={CalendarDays} label="Daily average" value={kwh(total / Math.max(1, days.length))} detail={`${days.length} days of readings`} />
        <Kpi icon={Trophy} label="Best day" value={best ? kwh(best.generated) : "n/a"} detail={best ? longDate(best.day) : ""} />
        <Kpi icon={Gauge} label="Sunlight captured" value={`${Math.round(usage * 100)}%`} detail={low ? `${low} day${low === 1 ? "" : "s"} need a look` : "Every day within range"} />
      </div>
      <Panel
        title="Daily solar against the sunlight ceiling"
        description={<span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${health.tone}`} />{health.text} · kWh per day</span>}
        actions={<ChartControls solar={solar} ceiling={ceiling} onSolar={setSolar} onCeiling={setCeiling} />}
      >
        <EnergyChart days={days} showSolar={solar} showCeiling={ceiling} />
        <p className="mt-3 text-xs text-muted">The ceiling is the day&apos;s sunlight × your panel size × 1.1. A day above it fails the sunlight check and earns nothing.</p>
      </Panel>
      <div className="flex flex-wrap gap-3">
        <Link href={`${BASE}energy/readings/`} className={buttonSecondary}>Daily readings table</Link>
        <Link href={`${BASE}energy/monthly/`} className={buttonSecondary}>Monthly summary</Link>
      </div>
    </>
  );
}

export function ReadingsPage() {
  const { data } = useHousehold();
  const months = useMemo(() => [...new Set(data.home.daily.map((d) => d.day.slice(0, 7)))], [data.home.daily]);
  const [month, setMonth] = useState("all");
  const [status, setStatus] = useState("all");
  const rows = data.home.daily.filter((d) => (month === "all" || d.day.startsWith(month)) && (status === "all" || dayStatus(d) === status));

  const columns: Column<Day>[] = [
    { id: "day", header: "Date", value: (d) => d.day, cell: (d) => <span className="font-medium">{longDate(d.day)}</span> },
    { id: "generated", header: "Generated", align: "right", value: (d) => d.generated, cell: (d) => kwh(d.generated) },
    { id: "toLoad", header: "To your home", align: "right", value: (d) => d.toLoad, cell: (d) => kwh(d.toLoad) },
    { id: "grid", header: "Grid", align: "right", value: (d) => d.grid, cell: (d) => kwh(d.grid) },
    { id: "backup", header: "Backup generator", align: "right", value: (d) => d.backup, cell: (d) => kwh(d.backup) },
    { id: "ceiling", header: "Sunlight ceiling", align: "right", value: (d) => d.ceiling ?? 0, cell: (d) => (d.ceiling === null ? "n/a" : kwh(d.ceiling)) },
    { id: "share", header: "Of ceiling", align: "right", value: (d) => (d.ceiling ? Math.round((d.generated / d.ceiling) * 100) : 0), cell: (d) => (d.ceiling ? `${Math.round((d.generated / d.ceiling) * 100)}%` : "n/a") },
    { id: "status", header: "Status", value: (d) => dayStatus(d), cell: (d) => <DayPill day={d} /> },
  ];

  return (
    <>
      <PageHeader title="Daily readings" description={`Every day your inverter (${data.home.inverter.serial}) reported. Latest reading ${longDate(data.dataAsOf)}.`} />
      <Panel flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(d) => d.day}
          searchText={(d) => `${d.day} ${longDate(d.day)}`}
          searchPlaceholder="Search by date"
          exportName={`klimatex-${homeCode(data.home.siteId)}-daily-readings`}
          initialSort={{ id: "day", dir: "desc" }}
          pageSizes={[15, 30, 60]}
          empty="No readings match these filters."
          filters={
            <>
              <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" className={selectClass}>
                <option value="all">All months</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={selectClass}>
                <option value="all">All statuses</option>
                <option value="normal">Normal</option>
                <option value="low">Low output</option>
                <option value="above">Above ceiling</option>
              </select>
            </>
          }
        />
      </Panel>
    </>
  );
}

export function MonthlyPage() {
  const { data } = useHousehold();
  const months = data.home.months;
  const totals = months.reduce((s, m) => ({ solar: s.solar + m.solarKwh, litres: s.litres + m.litres, tonnes: s.tonnes + m.tonnes }), { solar: 0, litres: 0, tonnes: 0 });
  const columns: Column<Month>[] = [
    { id: "month", header: "Month", value: (m) => m.month, cell: (m) => <span className="font-medium">{monthLabel(m.month)}</span> },
    { id: "solar", header: "Solar", align: "right", value: (m) => Math.round(m.solarKwh * 10) / 10, cell: (m) => kwh(m.solarKwh) },
    { id: "cap", header: "Fuel cap", align: "right", value: (m) => Math.round(m.capKwh), cell: (m) => kwh(m.capKwh) },
    { id: "litres", header: "Petrol", align: "right", value: (m) => Math.round(m.litres), cell: (m) => `${Math.round(m.litres)} L` },
    { id: "baseline", header: "Baseline", align: "right", value: (m) => m.baselineT, cell: (m) => t(m.baselineT, 3) },
    { id: "project", header: "Project", align: "right", value: (m) => m.projectT, cell: (m) => t(m.projectT, 3) },
    { id: "leakage", header: "Leakage", align: "right", value: (m) => m.leakageT, cell: (m) => t(m.leakageT, 3) },
    { id: "credited", header: "Credited", align: "right", value: (m) => m.tonnes, cell: (m) => <strong>{t(m.tonnes, 3)}</strong> },
  ];
  return (
    <>
      <PageHeader title="Monthly summary" description="How each month's solar became carbon credits, using Gold Standard's generator method." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={Zap} label="Solar credited" value={kwh(totals.solar)} detail={`${months.length} months audited`} />
        <Kpi icon={Fuel} label="Petrol avoided" value={`${Math.round(totals.litres).toLocaleString("en-NG")} L`} detail="Generator share × 0.7 L per kWh" />
        <Kpi icon={Leaf} label="Credited" value={t(totals.tonnes)} detail={data.home.status === "eligible" ? "Eligible for sale" : `Status: ${data.home.status ?? "not computed"}`} />
      </div>
      <Panel flush>
        <DataTable rows={months} columns={columns} rowKey={(m) => m.month} exportName={`klimatex-${homeCode(data.home.siteId)}-monthly`} initialSort={{ id: "month", dir: "asc" }} pageSizes={[12]} />
      </Panel>
      <Panel title="How a month is credited">
        <p className="text-sm leading-relaxed text-body">
          <strong className="text-ink">Credited = Baseline − Project emissions − Leakage.</strong> The baseline is the solar your home used, capped at what the old generator could
          have made, at a mix of generator and grid emission factors. Project emissions cover any backup generator use. Leakage applies when solar falls short of the home&apos;s
          usual need. Days that fail a check earn nothing.
        </p>
      </Panel>
    </>
  );
}

/* ───────────────────────── Payouts ───────────────────────── */

export function PayoutsPage() {
  const { data, openPayout } = useHousehold();
  const [dest, setDest] = useState("all");
  const rows = data.payouts.filter((p) => dest === "all" || p.destination === dest);
  const toLoan = data.payouts.filter((p) => p.destination === "solar_loan").reduce((s, p) => s + p.amountNaira, 0);
  const columns: Column<Payout>[] = [
    { id: "period", header: "Audit period", value: (p) => p.period?.end ?? "", cell: (p) => <span className="font-medium">{periodLabel(p.period)}</span> },
    { id: "tonnes", header: "Carbon earned", align: "right", value: (p) => p.tonnes, cell: (p) => t(p.tonnes) },
    { id: "credits", header: "Credits sold", align: "right", value: (p) => p.serials.length, cell: (p) => p.serials.length },
    { id: "amount", header: "Amount", align: "right", value: (p) => p.amountNaira, cell: (p) => <strong>{formatNaira(p.amountNaira)}</strong> },
    { id: "dest", header: "Destination", value: (p) => destinationLabel(p.destination), cell: (p) => destinationLabel(p.destination) },
    { id: "paid", header: "Paid on", value: (p) => p.paidOn ?? "", cell: (p) => longDate(p.paidOn) },
    { id: "ref", header: "Reference", value: (p) => p.reference, cell: (p) => <span className="font-mono text-[12px]">{p.reference}</span> },
    { id: "status", header: "Status", value: (p) => p.status, cell: (p) => <StatusPill status={p.status} /> },
  ];
  return (
    <>
      <PageHeader title="Payout history" description="Your 50% share of every credit sold, paid after each audit." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Total paid" value={formatNaira(data.paidNaira)} detail={`${data.payouts.length} payout${data.payouts.length === 1 ? "" : "s"}`} />
        <Kpi icon={Landmark} label="Into your solar loan" value={formatNaira(toLoan)} />
        <Kpi icon={Wallet} label="Into your wallet or bank" value={formatNaira(data.paidNaira - toLoan)} />
        <Kpi icon={Leaf} label="Carbon paid for" value={t(data.payouts.reduce((s, p) => s + p.tonnes, 0))} />
      </div>
      <Panel flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={openPayout}
          searchText={(p) => `${periodLabel(p.period)} ${p.reference} ${destinationLabel(p.destination)}`}
          searchPlaceholder="Search period or reference"
          exportName={`klimatex-${homeCode(data.home.siteId)}-payouts`}
          initialSort={{ id: "paid", dir: "desc" }}
          empty="No payouts yet. Your first one follows the next audit and sale."
          filters={
            <select value={dest} onChange={(e) => setDest(e.target.value)} aria-label="Destination" className={selectClass}>
              <option value="all">All destinations</option>
              <option value="solar_loan">Solar loan</option>
              <option value="wallet">Access wallet</option>
              <option value="bank">Bank account</option>
            </select>
          }
        />
      </Panel>
    </>
  );
}

type CreditRow = { serial: string; payout: Payout; share: number };

export function CreditsPage() {
  const { data } = useHousehold();
  const rows: CreditRow[] = data.payouts.flatMap((p) => p.serials.map((serial) => ({ serial, payout: p, share: p.serials.length ? p.tonnes / p.serials.length : 0 })));
  const columns: Column<CreditRow>[] = [
    { id: "serial", header: "Credit serial", value: (r) => r.serial, cell: (r) => <span className="font-mono text-[12.5px]">{r.serial}</span> },
    { id: "period", header: "Audit period", value: (r) => periodLabel(r.payout.period), cell: (r) => periodLabel(r.payout.period) },
    { id: "share", header: "Your share", align: "right", value: (r) => Number(r.share.toFixed(4)), cell: (r) => t(r.share, 3) },
    { id: "retired", header: "Retired on", value: (r) => r.payout.paidOn ?? "", cell: (r) => longDate(r.payout.paidOn) },
    { id: "status", header: "Status", cell: () => <Pill tone="grey">Retired</Pill> },
    { id: "verify", header: "Registry", cell: (r) => <button type="button" onClick={() => verifySerial(r.serial)} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] font-medium text-forest hover:bg-mint">Verify</button> },
  ];
  return (
    <>
      <PageHeader title="Credits & serials" description="Every credit your home helped earn. Each one is a slice of all eligible homes, retired once in a buyer's name and checkable by anyone." />
      <Panel flush>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.serial} searchText={(r) => r.serial} searchPlaceholder="Search serial" exportName={`klimatex-${homeCode(data.home.siteId)}-credits`} initialSort={{ id: "serial", dir: "asc" }} empty="No credits sold from your home yet." />
      </Panel>
    </>
  );
}

/* ───────────────────────── Loan ───────────────────────── */

export function LoanPage() {
  return <LoanView />;
}

/* ───────────────────────── Certificate ───────────────────────── */

export function CertificatePage() {
  const { data } = useHousehold();
  const c = data.certificate;
  if (!c) {
    return (
      <>
        <PageHeader title="Home Energy Certificate" />
        <Panel><p className="py-8 text-center text-sm text-body">{data.certificateNote ?? "Your certificate appears after your first audited period."}</p></Panel>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Home Energy Certificate" description="Your official certificate, measured from your inverter. Download it as an A4 PDF or print it." />
      <CertificateDocument c={c} data={data} />
    </>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */

export function NotificationsPage() {
  return <NotificationsView />;
}

/* ───────────────────────── Settings ───────────────────────── */

export function ProfilePage() {
  return <ProfileView />;
}

export function PreferencesPage() {
  return <PreferencesView />;
}
