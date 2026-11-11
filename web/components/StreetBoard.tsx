"use client";

import { useEffect, useState } from "react";
import { Home, Info, Sun, Users } from "lucide-react";
import { fetchStreets, GRADE_TONE, nextStep, type Street } from "@/lib/streets";

const SCALE = [
  { grade: "A", range: "0–2%" },
  { grade: "B", range: "2–10%" },
  { grade: "C", range: "10–25%" },
  { grade: "D", range: "25–40%" },
  { grade: "E", range: "40–55%" },
  { grade: "F", range: "55–75%" },
  { grade: "G", range: "75%+" },
];

const pct = (share: number) => `${Math.round(share * 100)}%`;

function StreetRow({ street, rank }: { street: Street; rank: number }) {
  const clean = Math.max(0, Math.min(1, 1 - street.generator_share));
  return (
    <li className="grid grid-cols-[auto_1fr] gap-4 border-b border-line px-5 py-5 last:border-0 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6">
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-[26px] font-bold ${GRADE_TONE[street.grade] ?? GRADE_TONE.G}`} aria-label={`Grade ${street.grade}`}>
        {street.grade}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[17px] font-semibold tracking-tight">
          <span className="text-[13px] font-medium text-muted">#{rank}</span> {street.name}
          <span className="text-[13px] font-normal text-muted">{street.area}, Lagos</span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef0ec]" aria-hidden>
          <div className="h-full rounded-full bg-leaf" style={{ width: `${clean * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[13px] text-body">
          {pct(street.generator_share)} of the street&rsquo;s power still comes from generators. {nextStep(street)}
        </p>
      </div>
      <dl className="col-span-2 flex gap-5 text-[12.5px] text-body sm:col-span-1 sm:flex-col sm:gap-1 sm:text-right">
        <div><dt className="inline">Homes </dt><dd className="inline font-semibold text-ink">{street.homes_total}</dd></div>
        <div><dt className="inline">On solar </dt><dd className="inline font-semibold text-ink">{street.homes_on_klimatex}</dd></div>
        <div><dt className="inline">Verified </dt><dd className="inline font-semibold text-ink">{street.homes_verified}</dd></div>
      </dl>
    </li>
  );
}

export function StreetBoard() {
  const [streets, setStreets] = useState<Street[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStreets()
      .then((data) => {
        setStreets(data.streets);
        setAsOf(data.as_of);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Street grades couldn't be loaded."));
  }, []);

  const homes = streets?.reduce((s, x) => s + x.homes_total, 0) ?? 0;
  const solar = streets?.reduce((s, x) => s + x.homes_on_klimatex, 0) ?? 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="overflow-hidden rounded-3xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold">Surulere streets, cleanest first</h2>
          {asOf && <p className="text-[12.5px] text-muted">Audited to {new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>}
        </div>
        {error ? (
          <p className="px-6 py-14 text-center text-sm text-body">{error}</p>
        ) : !streets ? (
          <p className="px-6 py-14 text-center text-sm text-muted">Loading street grades…</p>
        ) : streets.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-body">No streets have been surveyed yet.</p>
        ) : (
          <ol>{streets.map((s, i) => <StreetRow key={s.id} street={s} rank={i + 1} />)}</ol>
        )}
      </section>

      <aside className="space-y-4">
        {streets && streets.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[13px] text-body"><Users size={15} className="text-leaf" /> Homes surveyed</p>
              <p className="mt-1 text-[24px] font-semibold">{homes}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[13px] text-body"><Sun size={15} className="text-leaf" /> On KlimateX solar</p>
              <p className="mt-1 text-[24px] font-semibold">{solar}</p>
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold"><Info size={16} className="text-leaf" /> How a street is graded</p>
          <p className="mt-2 text-[13px] leading-relaxed text-body">
            The same A to G scale as a home: how much of the street&rsquo;s power still comes from generators. Homes on KlimateX count at their metered, audited figure. Every other home counts at the generator use measured in the street survey, so unverified data never improves a grade.
          </p>
          <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-[10.5px] text-muted">
            {SCALE.map((s) => (
              <li key={s.grade}>
                <span className={`block rounded-md py-1 text-[13px] font-bold ${GRADE_TONE[s.grade]}`}>{s.grade}</span>
                {s.range}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-[12px] text-muted"><Home size={14} className="mt-0.5 shrink-0" /> Only street totals are published. No home, name or address is shown.</p>
        </div>
      </aside>
    </div>
  );
}
