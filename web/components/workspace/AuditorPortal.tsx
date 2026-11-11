"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  Check,
  CircleDashed,
  Dices,
  FileSignature,
  Fingerprint,
  Layers,
  Link2,
  LoaderCircle,
  PauseCircle,
  Play,
  ShieldCheck,
  Sigma,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { ApiError } from "@/lib/api";
import {
  computePeriod,
  createPeriod,
  drawSample,
  loadEvidence,
  loadPeriod,
  loadPeriods,
  loadTrail,
  reviewSite,
  signOff,
  type Check as CheckResult,
  type Decision,
  type HomeEvidence,
  type LedgerStatus,
  type PeriodDetail,
  type PeriodSite,
  type PeriodSummary,
  type TrailEvent,
} from "@/lib/audit";
import { checkLabel, longDate, periodLabel } from "@/lib/household";
import { DataTable, type Column } from "@/components/household/DataTable";
import { Kpi, Panel, Pill } from "@/components/household/ui";

const STEPS = [
  { key: "open", label: "Created" },
  { key: "computed", label: "Computed" },
  { key: "sampled", label: "Sampled" },
  { key: "reviewed", label: "Reviewed" },
  { key: "signed", label: "Signed off" },
];

const CHECK_HELP: Record<string, string> = {
  sunlight: "Never more than NASA sunlight allows for the panel size",
  energy_balance: "Solar used can't exceed solar made",
  clone: "Not a copy of another home's readings",
  flat_line: "No stuck, repeating values",
  spike: "No impossible one-day jumps",
  missing_data: "Gaps are not credited",
  identity: "Install photo taken at the home's GPS",
  decommissioned: "Old generator scrapped with a certificate",
  backup_share: "Generator backup counted against the home",
};

const EVENT_LABEL: Record<string, string> = {
  "period.created": "Period created",
  "period.computed": "Carbon computed for every home",
  "period.sampled": "Audit sample drawn",
  "site.reviewed": "Home reviewed",
  "period.signed": "Period signed off and credits issued",
};

function statusPill(status: string) {
  if (status === "eligible") return <Pill tone="green"><BadgeCheck size={12} /> Eligible</Pill>;
  if (status === "held") return <Pill tone="amber"><PauseCircle size={12} /> Held</Pill>;
  if (status === "excluded") return <Pill tone="red"><XCircle size={12} /> Excluded</Pill>;
  return <Pill tone="grey">{status}</Pill>;
}

function resultPill(result: string) {
  if (result === "pass") return <Pill tone="green"><Check size={12} /> Pass</Pill>;
  if (result === "fail") return <Pill tone="red"><XCircle size={12} /> Fail</Pill>;
  return <Pill tone="amber"><TriangleAlert size={12} /> {checkLabel(result)}</Pill>;
}

function evidenceText(evidence: Record<string, unknown> | undefined) {
  if (!evidence) return "";
  return Object.entries(evidence)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const value = Array.isArray(v) ? (v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "none") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
      return `${checkLabel(k)}: ${value}`;
    })
    .join(" · ");
}

function stepIndex(p: PeriodSummary) {
  if (p.status === "signed") return 4;
  if (p.status === "sampled") return p.sample.length > 0 && p.homes.reviewed >= p.sample.length ? 3 : 2;
  if (p.status === "computed") return 1;
  return 0;
}

/** Daily solar against the sunlight ceiling for one home: bars over the line are what the sunlight check catches. */
function SunlightStrip({ days }: { days: HomeEvidence["daily"] }) {
  const shown = days.slice(-60);
  const max = Math.max(1, ...shown.map((d) => Math.max(d.generated, d.ceiling ?? 0)));
  const over = shown.filter((d) => d.ceiling !== null && d.generated > d.ceiling).length;
  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]" role="img" aria-label={`Last ${shown.length} days of solar; ${over} days above the sunlight ceiling`}>
        {shown.map((d) => {
          const bad = d.ceiling !== null && d.generated > d.ceiling;
          return (
            <span key={d.day} title={`${longDate(d.day)}: ${d.generated.toFixed(1)} kWh, ceiling ${d.ceiling?.toFixed(1) ?? "–"}`} className="relative flex-1">
              {d.ceiling !== null && <span className="absolute inset-x-0 border-t border-dashed border-[#c9a227]" style={{ bottom: `${(d.ceiling / max) * 96}px` }} />}
              <span className={`block rounded-t-[2px] ${bad ? "bg-red-500" : "bg-leaf"}`} style={{ height: `${(d.generated / max) * 96}px` }} />
            </span>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-leaf" /> Solar made</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500" /> Above what the sun allowed</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-[#c9a227]" /> Sunlight ceiling</span>
      </p>
    </div>
  );
}

export function AuditorPortal() {
  const [periods, setPeriods] = useState<PeriodSummary[] | null>(null);
  const [ledger, setLedger] = useState<LedgerStatus | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [trail, setTrail] = useState<TrailEvent[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<HomeEvidence | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(42);
  const [note, setNote] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const refresh = useCallback(async (keep?: number) => {
    const data = await loadPeriods();
    setPeriods(data.periods);
    setLedger(data.ledger);
    setAsOf(data.data_as_of);
    const id = keep ?? data.periods[0]?.id ?? null;
    setPeriodId(id);
    if (id !== null) {
      const [d, t] = await Promise.all([loadPeriod(id), loadTrail(id)]);
      setDetail(d);
      setTrail(t.events);
      // Open the evidence an auditor most needs first: a sampled home that didn't pass every check.
      const sampleIds = new Set(d.sample ?? []);
      const first = d.sites.find((s) => sampleIds.has(s.site_id) && s.failed.length > 0) ?? d.sites.find((s) => sampleIds.has(s.site_id));
      setSiteId((current) => current ?? first?.site_id ?? null);
    }
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(() => refresh())
      .catch((e) => setError(e instanceof ApiError ? e.message : "The audit data couldn't be loaded."));
  }, [refresh]);

  useEffect(() => {
    if (siteId === null) return;
    let live = true;
    loadEvidence(siteId).then((e) => live && setEvidence(e)).catch(() => live && setEvidence(null));
    return () => {
      live = false;
    };
  }, [siteId]);

  const period = periods?.find((p) => p.id === periodId) ?? null;
  const sample = useMemo(() => new Set(detail?.sample ?? []), [detail]);
  const sampled = (detail?.sites ?? []).filter((s) => sample.has(s.site_id));
  const unreviewed = sampled.filter((s) => !s.reviewed).length;
  const latestDay = useMemo(() => evidence?.daily.at(-1)?.day ?? null, [evidence]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setError("");
    try {
      await action();
      await refresh(periodId ?? undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    }
    setBusy("");
  };

  if (!periods) {
    return error
      ? <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>
      : <div className="flex items-center gap-2 py-16 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" /> Loading periods…</div>;
  }

  const step = period ? stepIndex(period) : -1;
  const homeChecks: CheckResult[] = evidence?.periods.find((p) => p.period === periodId)?.checks ?? [];
  const homeResult = evidence?.periods.find((p) => p.period === periodId);
  const selectedSite = detail?.sites.find((s) => s.site_id === siteId) ?? null;
  const canReview = period?.status === "sampled" && selectedSite && sample.has(selectedSite.site_id) && !selectedSite.reviewed;

  const columns: Column<PeriodSite>[] = [
    { id: "label", header: "Home", value: (s) => s.label, cell: (s) => (
      <span className="inline-flex items-center gap-2 font-medium">{s.label}{sample.has(s.site_id) && <span className="rounded bg-[#eef3f7] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#35546b]">SAMPLE</span>}</span>
    ) },
    { id: "status", header: "Status", value: (s) => s.status, cell: (s) => statusPill(s.status) },
    { id: "t", header: "Carbon", align: "right", value: (s) => s.tco2e, cell: (s) => <Co2Text text={`${s.tco2e.toFixed(3)} tCO₂e`} /> },
    { id: "score", header: "Trust", align: "right", value: (s) => s.score, cell: (s) => <span className={s.score < 60 ? "font-semibold text-red-700" : s.score < 80 ? "font-semibold text-[#8a5a00]" : ""}>{s.score}</span> },
    { id: "failed", header: "Checks not passed", value: (s) => s.failed.join(" "), cell: (s) => (s.failed.length ? <span className="text-body">{s.failed.map(checkLabel).join(", ")}</span> : <span className="text-muted">All passed</span>) },
    { id: "reviewed", header: "Reviewed", value: (s) => (s.reviewed ? 1 : 0), cell: (s) => (s.reviewed ? <Check size={16} className="text-leaf" /> : sample.has(s.site_id) ? <CircleDashed size={16} className="text-[#8a5a00]" /> : <span className="text-muted">–</span>) },
  ];

  return (
    <div className="space-y-5">
      {/* Period picker and progress */}
      <section id="periods" className="scroll-mt-6 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-body">
            Period
            <select value={periodId ?? ""} onChange={(e) => { setSiteId(null); setEvidence(null); refresh(Number(e.target.value)); }} className="h-9 rounded-lg border border-line bg-white px-2.5 text-[13.5px] font-medium text-ink outline-none focus:border-leaf">
              {periods.map((p) => <option key={p.id} value={p.id}>{periodLabel({ start: p.start, end: p.end })} · {p.status}</option>)}
            </select>
          </label>
          {ledger && (
            <span className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium ${ledger.ok ? "bg-mint text-forest" : "bg-red-50 text-red-700"}`}>
              <Link2 size={15} /> {ledger.ok ? `Ledger intact · ${ledger.entries} entries` : `Ledger broken at entry ${ledger.broken_at}`}
            </span>
          )}
        </div>

        {period && (
          <ol className="mt-5 grid grid-cols-5 gap-1.5">
            {STEPS.map((s, i) => {
              const done = i <= step;
              return (
                <li key={s.key} className="min-w-0">
                  <div className={`h-1.5 rounded-full ${done ? "bg-forest" : "bg-[#e7ece5]"}`} />
                  <p className={`mt-2 hidden items-center gap-1.5 truncate text-[12.5px] sm:flex ${done ? "font-semibold text-forest" : "text-muted"}`}>
                    {done ? <BadgeCheck size={14} className="shrink-0" /> : <CircleDashed size={14} className="shrink-0" />} {s.label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        {period && <p className="mt-2 text-[12.5px] font-semibold text-forest sm:hidden">Step {step + 1} of {STEPS.length} · {STEPS[step]?.label}</p>}

        {period && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-[#f6f8f5] p-4">
            {period.status === "open" && (
              <>
                <p className="flex-1 text-[13.5px] text-body">Run the carbon engine and the nine checks on every home in this period.</p>
                <button type="button" disabled={!!busy} onClick={() => run("compute", () => computePeriod(period.id))} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60">
                  {busy === "compute" ? <LoaderCircle size={16} className="animate-spin" /> : <Sigma size={16} />} Compute period
                </button>
              </>
            )}
            {period.status === "computed" && (
              <>
                <p className="flex-1 text-[13.5px] text-body">Draw a random 20% sample of eligible homes, plus every held home. The seed is public, so anyone can redraw the same sample.</p>
                <label className="flex items-center gap-2 text-[13px]">Seed
                  <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="h-10 w-24 rounded-xl border border-line bg-white px-3 font-mono outline-none focus:border-leaf" />
                </label>
                <button type="button" disabled={!!busy} onClick={() => run("sample", () => drawSample(period.id, seed))} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60">
                  {busy === "sample" ? <LoaderCircle size={16} className="animate-spin" /> : <Dices size={16} />} Draw sample
                </button>
              </>
            )}
            {period.status === "sampled" && (
              <>
                <p className="flex-1 text-[13.5px] text-body">
                  {unreviewed > 0 ? `Review the ${unreviewed} remaining sampled home${unreviewed === 1 ? "" : "s"} below, then sign off.` : "Every sampled home is reviewed. Signing off submits the period to the carbon registry and issues serialised credits."}
                </p>
                <button type="button" disabled={!!busy || unreviewed > 0} onClick={() => run("sign", () => signOff(period.id))} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white hover:bg-forest-hover disabled:opacity-50">
                  {busy === "sign" ? <LoaderCircle size={16} className="animate-spin" /> : <FileSignature size={16} />} Sign off period
                </button>
              </>
            )}
            {period.status === "signed" && (
              <p className="flex flex-1 items-start gap-2.5 text-[13.5px] text-body">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-leaf" />
                <span>
                  Signed by <strong className="text-ink">{period.signed_by}</strong> on {longDate(period.signed_at)}. {period.credits.issued} credits issued
                  {period.registry.project && <> · registry project <span className="font-mono text-[12.5px]">{period.registry.project}</span></>}
                  {period.registry.mrv && <> · MRV <span className="font-mono text-[12.5px]">{period.registry.mrv}</span></>}.
                </span>
              </p>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}
      </section>

      {period && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Layers} label="Eligible carbon" value={<Co2Text text={`${period.eligible_t.toFixed(3)} tCO₂e`} />} detail={period.carried_t ? `${period.carried_t.toFixed(3)} t carried to next period` : "Whole tonnes become credits"} />
          <Kpi icon={BadgeCheck} label="Homes" value={`${period.homes.eligible} eligible`} detail={`${period.homes.held} held · ${period.homes.excluded} excluded`} />
          <Kpi icon={Dices} label="Audit sample" value={period.sample.length ? `${period.sample.length} homes` : "Not drawn"} detail={period.sample_seed !== null ? `Seed ${period.sample_seed} · ${period.homes.reviewed} reviewed` : "After compute"} />
          <Kpi icon={Fingerprint} label="Credits" value={period.credits.issued || "–"} detail={period.credits.issued ? `${period.credits.retired} retired by buyers` : "Issued at sign-off"} />
        </div>
      )}

      {/* Sample and evidence */}
      <div id="sample" className="grid scroll-mt-6 items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel title="Audit sample" description={period?.sample_seed !== null && period ? `Seed ${period.sample_seed}: every held home plus a random 20% of eligible homes.` : "Drawn after the period is computed."} flush>
          {sampled.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-body">No sample yet.</p>
          ) : (
            <ul>
              {sampled.map((s) => (
                <li key={s.site_id}>
                  <button type="button" onClick={() => { setSiteId(s.site_id); setNote(""); }} className={`flex w-full items-center gap-3 border-b border-line px-5 py-3.5 text-left last:border-b-0 ${siteId === s.site_id ? "bg-mint/70" : "hover:bg-[#f7faf6]"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${s.score >= 80 ? "bg-mint text-forest" : s.score >= 60 ? "bg-[#fdf3d7] text-[#8a5a00]" : "bg-red-50 text-red-700"}`}>{s.score}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[14px] font-semibold">{s.label} {statusPill(s.status)}</span>
                      <span className="block truncate text-[12.5px] text-body">{s.failed.length ? `Not passed: ${s.failed.map(checkLabel).join(", ")}` : "All nine checks passed"}</span>
                    </span>
                    {s.reviewed ? <Pill tone="green"><Check size={12} /> Reviewed</Pill> : <Pill tone="amber">To review</Pill>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <section id="evidence" className="scroll-mt-6">
          <Panel title={evidence ? `Evidence · ${evidence.site.label}` : "Evidence"} description={evidence ? `${evidence.household.name} · ${evidence.site.area} · ${evidence.site.panel_kwp} kWp · inverter ${evidence.inverter.serial}` : "Pick a home from the sample or the table to see its checks."}>
            {!siteId ? (
              <p className="py-8 text-center text-sm text-body">No home selected.</p>
            ) : !evidence ? (
              <div className="flex justify-center py-10"><LoaderCircle size={20} className="animate-spin text-muted" /></div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2.5 text-[12.5px]">
                  {homeResult && <span className="rounded-lg bg-[#f6f8f5] px-3 py-1.5">Trust score <strong>{homeResult.score}</strong></span>}
                  {homeResult && <span className="rounded-lg bg-[#f6f8f5] px-3 py-1.5">Grade <strong>{homeResult.grade}</strong></span>}
                  <span className="rounded-lg bg-[#f6f8f5] px-3 py-1.5">Generator {evidence.generator.serial} scrapped {longDate(evidence.generator.scrapped_on)}</span>
                  <span className="rounded-lg bg-[#f6f8f5] px-3 py-1.5">Latest reading {longDate(latestDay)}</span>
                </div>
                <SunlightStrip days={evidence.daily} />
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {homeChecks.map((c) => (
                    <li key={c.name} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                      <span className="w-[120px] shrink-0 text-[13.5px] font-medium">{checkLabel(c.name)}</span>
                      <span className="shrink-0">{resultPill(c.result)}</span>
                      <span className="min-w-[200px] flex-1 text-[12.5px] text-body">
                        {CHECK_HELP[c.name] ?? ""}
                        {c.evidence && Object.keys(c.evidence).length > 0 && <span className="mt-0.5 block font-mono text-[11.5px] text-muted">{evidenceText(c.evidence)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>

                {canReview && selectedSite && (
                  <div className="rounded-xl border border-forest/20 bg-mint/40 p-4">
                    <p className="text-[13.5px] font-semibold">Your decision on {selectedSite.label}</p>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for the record, e.g. evidence consistent" className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-[13.5px] outline-none focus:border-leaf" />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {(selectedSite.status === "held"
                        ? [["clear", "Clear the hold"], ["keep_held", "Keep held"], ["exclude", "Exclude"]]
                        : [["ok", "Evidence OK"], ["exclude", "Exclude"]]
                      ).map(([d, label]) => (
                        <button key={d} type="button" disabled={!!busy} onClick={() => run(`review-${d}`, () => reviewSite(period!.id, selectedSite.site_id, d as Decision, note))}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium disabled:opacity-60 ${d === "exclude" ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : d === "keep_held" ? "border border-line bg-white hover:bg-[#fdf3d7]" : "bg-forest text-white hover:bg-forest-hover"}`}>
                          {busy === `review-${d}` ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={13} />} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </section>
      </div>

      {/* Every home in the period */}
      <Panel title="Every home in this period" description="Click a row to open its evidence." flush>
        <DataTable<PeriodSite>
          rows={detail?.sites ?? []}
          columns={columns}
          rowKey={(s) => s.site_id}
          onRowClick={(s) => { setSiteId(s.site_id); setNote(""); document.getElementById("evidence")?.scrollIntoView({ behavior: "smooth" }); }}
          searchText={(s) => `${s.label} ${s.status} ${s.failed.join(" ")}`}
          searchPlaceholder="Search home or check"
          exportName={period ? `klimatex-audit-${period.start}-${period.end}` : "klimatex-audit"}
          initialSort={{ id: "score", dir: "asc" }}
          pageSizes={[10, 20, 50]}
          empty="No homes computed yet."
        />
      </Panel>

      {/* Ledger trail */}
      <section id="trail" className="scroll-mt-6">
        <Panel title="Audit trail" description="Every step for this period, written to the hash-chained ledger. Change one entry and every hash after it breaks." flush>
          {trail.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-body">Nothing recorded yet.</p>
          ) : (
            <ol className="px-5 py-4">
              {trail.map((e, i) => {
                const p = e.payload as Record<string, unknown>;
                const detailText =
                  e.type === "site.reviewed" ? `Home ${String(p.site).padStart(2, "0")} · ${checkLabel(String(p.decision))}${p.note ? ` · “${String(p.note)}”` : ""}`
                  : e.type === "period.sampled" ? `Seed ${String(p.seed)} · homes ${(p.sites as number[]).join(", ")}`
                  : e.type === "period.computed" ? `${String(p.eligible_t)} t eligible · ${String(p.eligible)} homes${Array.isArray(p.held) && p.held.length ? ` · held ${(p.held as string[]).join(", ")}` : ""}${Array.isArray(p.excluded) && p.excluded.length ? ` · excluded ${(p.excluded as string[]).join(", ")}` : ""}`
                  : e.type === "period.signed" ? `${String(p.auditor)} · ${String(p.credits)} credits${p.first ? ` · ${String(p.first)} to ${String(p.last)}` : ""}`
                  : `${String(p.start ?? "")} to ${String(p.end ?? "")}`;
                return (
                  <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                    {i < trail.length - 1 && <span className="absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px bg-line" />}
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-forest"><Check size={13} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-3 text-[13.5px] font-semibold">{EVENT_LABEL[e.type] ?? e.type}<span className="text-[12px] font-normal text-muted">{new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></p>
                      <p className="mt-0.5 text-[12.5px] text-body">{detailText}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted" title={e.hash}>#{e.id} · {e.hash.slice(0, 16)}…</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </section>

      {/* New period */}
      <NewPeriod
        latest={periods[0]?.end ?? null}
        asOf={asOf}
        busy={busy === "create"}
        start={newStart}
        end={newEnd}
        setStart={setNewStart}
        setEnd={setNewEnd}
        onCreate={() => run("create", async () => { const r = await createPeriod(newStart, newEnd); setPeriodId(r.period); await refresh(r.period); })}
      />
    </div>
  );
}

function NewPeriod({ latest, asOf, busy, start, end, setStart, setEnd, onCreate }: {
  latest: string | null;
  asOf: string | null;
  busy: boolean;
  start: string;
  end: string;
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
  onCreate: () => void;
}) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end && (!latest || start > latest) && (!asOf || end <= asOf);
  const covered = !latest || !asOf || asOf > latest;
  return (
    <Panel title="Open a new monitoring period" description="Periods can't overlap. Compute it only once readings cover the whole period.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[13px]">Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block h-10 rounded-xl border border-line px-3 outline-none focus:border-leaf" /></label>
        <label className="text-[13px]">End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block h-10 rounded-xl border border-line px-3 outline-none focus:border-leaf" /></label>
        <button type="button" disabled={!valid || busy} onClick={onCreate} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13.5px] font-semibold hover:bg-mint disabled:opacity-50">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarPlus size={16} />} Open period
        </button>
        <p className="text-[12.5px] text-muted">
          {covered
            ? `Pick dates after ${longDate(latest)} and up to ${longDate(asOf)}, the latest reading.`
            : `Readings run to ${longDate(asOf)}, which the last period already covers. The next period can open once new readings arrive.`}
        </p>
      </div>
    </Panel>
  );
}
