"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Fuel, LoaderCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { formatNaira } from "@/lib/marketplace";
import { addFuelReceipt, fetchEvidence, monthName, type Evidence } from "@/lib/tips";
import { useHousehold } from "./HouseholdShell";
import { PageHeader, Panel, Pill, selectClass } from "./ui";

const input = "h-10 w-full rounded-lg border border-line bg-white px-3 text-[14px] outline-none focus:border-leaf";

function windowMonths(e: Evidence): string[] {
  const have = e.receipts.map((r) => r.month);
  return [...new Set([...have.filter((m) => e.baseline.from !== null && m >= e.baseline.from && m <= (e.baseline.to ?? m)), ...e.baseline.missing_months])].sort();
}

/** Fuel receipts from the year before solar: 12 of them make the home's baseline measured instead of estimated. */
export function FuelReceipts() {
  const { data } = useHousehold();
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const [litres, setLitres] = useState("");
  const [naira, setNaira] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let stale = false;
    fetchEvidence(data.home.siteId)
      .then((e) => {
        if (stale) return;
        setEvidence(e);
        setMonth(e.baseline.missing_months[0] ?? e.baseline.to ?? "");
      })
      .catch((e) => !stale && setError(e instanceof ApiError ? e.message : "Your receipts couldn't be loaded. Try again."));
    return () => {
      stale = true;
    };
  }, [data.home.siteId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const next = await addFuelReceipt(month, Number(litres), Number(naira));
      setEvidence(next);
      setSaved(`${monthName(month)} saved.`);
      setLitres("");
      setNaira("");
      setMonth(next.baseline.missing_months[0] ?? month);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That receipt couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!evidence) {
    return error ? <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>
      : <div className="flex items-center gap-2 py-16 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" /> Loading your receipts…</div>;
  }

  const b = evidence.baseline;
  const months = windowMonths(evidence);
  const byMonth = new Map(evidence.receipts.map((r) => [r.month, r]));
  const measured = b.tier === "measured";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fuel receipts"
        description={`Your receipts for petrol or diesel from ${b.from ? monthName(b.from) : "?"} to ${b.to ? monthName(b.to) : "?"}, the year before your solar was installed.`}
      />

      <section className={`rounded-2xl px-5 py-4 ${measured ? "bg-[#e4f3d5] text-[#27500a]" : "bg-[#fdf3d7] text-[#5c3d00]"}`}>
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          {measured ? <CheckCircle2 size={18} /> : <Fuel size={18} />}
          {measured ? "Your baseline is measured" : `${b.months} of ${b.needed} months added`}
        </p>
        <p className="mt-1 text-[13.5px]">
          {measured
            ? `Your credits now use your real fuel use before solar${b.litres_per_month ? ` (about ${b.litres_per_month} litres a month)` : ""} instead of an estimate.`
            : `With all ${b.needed} months, your baseline is measured instead of estimated, and your credits are no longer cut by ${Math.round(b.deduction * 100)}%. It applies from the next audit.`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuemin={0} aria-valuemax={b.needed} aria-valuenow={b.months} aria-label="Months added">
          <div className="h-full rounded-full bg-leaf" style={{ width: `${(b.months / b.needed) * 100}%` }} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Your 12 months" flush>
          <ul className="grid sm:grid-cols-2">
            {months.map((m) => {
              const r = byMonth.get(m);
              return (
                <li key={m} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-[13.5px] sm:odd:border-r">
                  <span className="font-medium">{monthName(m)}</span>
                  {r ? <span className="text-body">{r.litres} L · {formatNaira(r.amount_naira)}</span> : <Pill tone="amber">Missing</Pill>}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Add a month" description="Add up every receipt from that month. Keep the paper receipts: your installer or the auditor may ask to see them.">
          <form onSubmit={submit} className="space-y-3.5">
            <label className="block text-[13px] font-medium">
              Month
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${selectClass} mt-1 h-10 w-full`}>
                {months.map((m) => <option key={m} value={m}>{monthName(m)}{byMonth.has(m) ? " (replace)" : ""}</option>)}
              </select>
            </label>
            <label className="block text-[13px] font-medium">
              Litres bought
              <input value={litres} onChange={(e) => setLitres(e.target.value)} inputMode="decimal" required placeholder="e.g. 90" className={`${input} mt-1`} />
            </label>
            <label className="block text-[13px] font-medium">
              Amount paid (₦)
              <input value={naira} onChange={(e) => setNaira(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" required placeholder="e.g. 63000" className={`${input} mt-1`} />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
            {saved && <p role="status" className="rounded-lg bg-[#e4f3d5] px-3 py-2 text-[13px] text-[#27500a]">{saved}</p>}
            <button type="submit" disabled={saving || !month}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-forest text-[14px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60">
              {saving && <LoaderCircle size={16} className="animate-spin" />} Save receipt
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
