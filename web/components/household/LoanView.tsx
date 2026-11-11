"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, Coins, Factory, Info, Landmark, Leaf, Sun, TrendingUp } from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { homeCode, longDate, periodLabel, type Payout } from "@/lib/household";
import { formatNaira } from "@/lib/marketplace";
import { useHousehold } from "./HouseholdShell";
import { PageHeader } from "./ui";

function addMonths(iso: string | null, months: number) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function LoanView() {
  const { data, openPayout } = useHousehold();
  const { home, certificate: c } = data;
  const repayments = data.payouts.filter((p) => p.destination === "solar_loan");
  const repaid = repayments.reduce((s, p) => s + p.amountNaira, 0);
  const tonnesPaid = repayments.reduce((s, p) => s + p.tonnes, 0);
  const perTonne = tonnesPaid > 0 ? repaid / tonnesPaid : 0;
  const perYear = c ? c.credited_tco2e_per_year * perTonne : 0;
  const lastPeriodEnd = repayments[0]?.period?.end ?? data.dataAsOf;
  // The next audit covers the six months after the last paid period.
  const nextStart = lastPeriodEnd ? new Date(Date.parse(`${lastPeriodEnd.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : null;
  const nextEnd = addMonths(lastPeriodEnd, 6);
  const nextPeriod = nextStart && nextEnd ? { start: nextStart, end: nextEnd } : null;

  if (!home.loan) {
    return (
      <>
        <PageHeader title="Solar loan" />
        <section className="relative overflow-hidden rounded-3xl border border-line bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-forest"><Landmark size={26} /></span>
          <p className="mt-4 text-[17px] font-semibold">No solar loan on this home</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[14px] text-body">Your carbon payouts go to your own wallet or bank account. If you add a battery with an Access solar loan, payouts can repay it for you.</p>
          <Link href="/app/household/settings/payments/" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white hover:bg-forest-hover">Payment details <ArrowRight size={15} /></Link>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Solar loan" description="Every carbon payout from your home goes straight to your Access solar loan." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Loan card */}
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0b3f2a_0%,#14683f_55%,#2f8f00_100%)] p-6 text-white shadow-[0_30px_60px_-30px_rgba(11,63,42,0.7)] sm:p-7">
          <svg aria-hidden viewBox="0 0 500 300" preserveAspectRatio="xMaxYMin slice" className="absolute inset-0 h-full w-full opacity-[0.16]">
            {Array.from({ length: 9 }, (_, i) => <circle key={i} cx="470" cy="20" r={30 + i * 32} fill="none" stroke="#c7f36b" strokeWidth="1.2" />)}
          </svg>
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/60">Access Bank · Solar loan</p>
              <p className="mt-1 font-mono text-[15px] tracking-wide">{home.loan}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-2.5 py-1 text-[11.5px] font-semibold text-forest"><span className="h-1.5 w-1.5 rounded-full bg-forest" /> Active</span>
          </div>
          <div className="relative mt-9">
            <p className="text-[13px] text-white/70">Repaid by your carbon credits</p>
            <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.02em]">{formatNaira(repaid)}</p>
            <p className="mt-2 text-[13px] text-white/70">
              from <Co2Text text={`${tonnesPaid.toFixed(2)} tCO₂e`} /> sold · {repayments.length} repayment{repayments.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-[12.5px]">
            <div><p className="text-white/60">Financed</p><p className="mt-0.5 font-medium">Solar + 2.4 kWh battery</p></div>
            <div><p className="text-white/60">Home</p><p className="mt-0.5 font-medium">{home.label} · {homeCode(home.siteId)}</p></div>
            <div><p className="text-white/60">Paid automatically</p><p className="mt-0.5 font-medium">After each audit</p></div>
          </div>
        </section>

        {/* Projection and next */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-3xl border border-line bg-white p-6">
            <div className="flex items-center gap-2.5 text-[13px] font-medium text-muted"><TrendingUp size={16} className="text-leaf" /> Next 12 months from carbon</div>
            <p className="mt-2 text-[30px] font-semibold tracking-tight">≈ {formatNaira(Math.round(perYear))}</p>
            <p className="mt-1 text-[13px] text-body">
              {c ? <>Your home earns about <Co2Text text={`${c.credited_tco2e_per_year.toFixed(2)} tCO₂e`} /> a year at {formatNaira(Math.round(perTonne))} per tonne to you.</> : "Shown once your first period is audited."}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eef3ec]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#2f8f00,#c7f36b)]" style={{ width: `${Math.min(100, perYear > 0 ? (repaid / perYear) * 100 : 0)}%` }} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted">{perYear > 0 ? `${Math.round((repaid / perYear) * 100)}% of a year's carbon already repaid` : ""}</p>
          </section>
          <section className="rounded-3xl border border-line bg-white p-6">
            <div className="flex items-center gap-2.5 text-[13px] font-medium text-muted"><CalendarClock size={16} className="text-leaf" /> Next carbon repayment</div>
            <p className="mt-2 text-[20px] font-semibold tracking-tight">After the {longDate(nextPeriod?.end ?? null)} audit</p>
            <p className="mt-1 text-[13px] text-body">Covers {periodLabel(nextPeriod)}. Sent the day the credits sell, no action needed.</p>
          </section>
        </div>
      </div>

      {/* How it flows */}
      <section className="mt-5 rounded-3xl border border-line bg-white p-6">
        <h2 className="text-[16px] font-semibold">How your sunshine repays the loan</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-5">
          {[
            { icon: Sun, title: "Panels make power", body: "Measured every day from your inverter" },
            { icon: Leaf, title: "Petrol is avoided", body: "Each kWh replaces generator fuel" },
            { icon: BadgeCheck, title: "Credits issued", body: "Audited, then issued by the registry" },
            { icon: Factory, title: "A company buys", body: "50% of the price is your share" },
            { icon: Landmark, title: "Loan repaid", body: "Your share goes to Access Bank" },
          ].map((s, i, all) => (
            <li key={s.title} className="relative flex gap-3 md:flex-col md:gap-0">
              <div className="flex items-center md:w-full">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${i === all.length - 1 ? "bg-forest text-white" : "bg-mint text-forest"}`}><s.icon size={19} /></span>
                {i < all.length - 1 && <span className="ml-3 hidden h-px flex-1 border-t-2 border-dashed border-[#cfe0cc] md:block" />}
              </div>
              <div className="md:mt-3">
                <p className="text-[14px] font-semibold">{s.title}</p>
                <p className="text-[12.5px] text-body">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Repayments */}
      <section className="mt-5 rounded-3xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[16px] font-semibold">Carbon repayments</h2>
          <span className="text-[12.5px] text-muted">Tap one for the receipt</span>
        </div>
        {repayments.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13.5px] text-body">No repayments yet. The first arrives after your first audit.</p>
        ) : (
          <ol className="relative px-6 py-5">
            {repayments.map((p: Payout, i) => (
              <li key={p.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < repayments.length - 1 && <span className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-px bg-line" />}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-forest ring-4 ring-white"><Coins size={17} /></span>
                <button type="button" onClick={() => openPayout(p)} className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line px-4 py-3.5 text-left transition hover:border-leaf/50 hover:bg-[#f7faf6]">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-[15px] font-semibold">{formatNaira(p.amountNaira)}</p>
                    <p className="text-[12.5px] text-body">{periodLabel(p.period)} · <Co2Text text={`${p.tonnes.toFixed(2)} tCO₂e`} /></p>
                  </div>
                  <div className="text-[12.5px]">
                    <p className="text-muted">Paid</p>
                    <p className="font-medium">{longDate(p.paidOn)}</p>
                  </div>
                  <div className="text-[12.5px]">
                    <p className="text-muted">Reference</p>
                    <p className="font-mono">{p.reference}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[11.5px] font-semibold capitalize text-forest"><BadgeCheck size={13} /> {p.status}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-5 flex gap-3 rounded-2xl bg-[#f3f6f2] p-4 text-[13px] text-body">
        <Info size={17} className="mt-0.5 shrink-0 text-muted" />
        <p>Carbon payouts reduce what you owe but don&rsquo;t replace your agreed instalments. Your full balance and schedule are in your Access app or at any branch. <Link href="/app/household/help/" className="font-medium text-leaf hover:underline">Loan questions</Link></p>
      </div>
    </>
  );
}
