"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, CircleAlert, Gauge, LoaderCircle, Lightbulb } from "lucide-react";
import { ApiError } from "@/lib/api";
import { fetchFleetTips, KIND_LABEL, recordMeter, type FleetTips, type Tip } from "@/lib/tips";
import { Panel, Pill } from "@/components/household/ui";

const field = "h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] outline-none focus:border-leaf";

/** The installer records a meter's accuracy from its calibration certificate. */
function MeterForm({ siteId, onSaved }: { siteId: number; onSaved: () => void }) {
  const [accuracy, setAccuracy] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await recordMeter(siteId, Number(accuracy), date);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The calibration couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2">
      <label className="text-[12px] font-medium text-body">
        Accuracy ± % (95%)
        <input value={accuracy} onChange={(e) => setAccuracy(e.target.value)} inputMode="decimal" required placeholder="1.0" className={`${field} mt-1 block w-28`} />
      </label>
      <label className="text-[12px] font-medium text-body">
        Calibrated on
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`${field} mt-1 block`} />
      </label>
      <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest-hover disabled:opacity-60">
        {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Gauge size={14} />} Record certificate
      </button>
      {error && <p role="alert" className="w-full text-[12.5px] text-red-700">{error}</p>}
    </form>
  );
}

function TipLine({ tip, siteId, canRecord, onSaved }: { tip: Tip; siteId: number; canRecord: boolean; onSaved: () => void }) {
  return (
    <li className="flex gap-2.5 py-2">
      <CircleAlert size={15} className={`mt-0.5 shrink-0 ${tip.priority === "high" ? "text-red-700" : "text-[#8a5a00]"}`} />
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium leading-snug">
          {tip.title} {tip.who === "household" && <span className="text-[12px] font-normal text-muted">· family</span>}
        </p>
        <p className="text-[12.5px] text-body">{tip.body}</p>
        {canRecord && tip.kind === "meter" && <MeterForm siteId={siteId} onSaved={onSaved} />}
      </div>
    </li>
  );
}

/** Credit tips across the installer's homes: what would earn each home more, the homes with most to fix first. */
export function CreditTipsPanel({ canRecord = true }: { canRecord?: boolean }) {
  const [tips, setTips] = useState<FleetTips | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchFleetTips()
      .then(setTips)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Credit tips couldn't be loaded."));
  }, []);

  useEffect(load, [load]);

  if (error) return <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>;
  if (!tips) return null;
  const homes = tips.homes.filter((h) => h.todo > 0);
  if (homes.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-line bg-white px-5 py-3.5 text-[13.5px] text-body">
        <BadgeCheck size={16} className="text-leaf" /> Every home&apos;s checks and evidence are complete. Nothing is holding back their credits.
      </p>
    );
  }

  return (
    <Panel
      title="Credit tips"
      description={`${homes.length} of ${tips.homes.length} homes could earn more. Each tip comes from a rule that decides the home's credits.`}
      actions={<Lightbulb size={18} className="text-leaf" />}
      flush
    >
      <>
          <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
            {Object.entries(tips.by_kind).map(([kind, n]) => (
              <Pill key={kind} tone="grey">{KIND_LABEL[kind] ?? kind} · {n}</Pill>
            ))}
          </div>
          <ul className="grid lg:grid-cols-2">
            {homes.map((h) => (
              <li key={h.home.id} className="border-b border-line px-5 py-3.5 lg:odd:border-r">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold">{h.home.label} <span className="font-normal text-muted">· {h.home.household}</span></p>
                  {h.credits_cut_pct > 0 && <Pill tone="amber">≈{h.credits_cut_pct}% credited lower (est.)</Pill>}
                </div>
                <ul className="mt-1 divide-y divide-line">
                  {h.tips.map((t) => <TipLine key={t.id} tip={t} siteId={h.home.id} canRecord={canRecord} onSaved={load} />)}
                </ul>
              </li>
            ))}
          </ul>
      </>
    </Panel>
  );
}
