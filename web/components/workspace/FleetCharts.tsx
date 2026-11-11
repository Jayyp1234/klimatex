"use client";

import { useState } from "react";
import { monthLabel } from "@/lib/household";
import type { Fleet, FleetMonth } from "@/lib/fleet";

/** Ring of homes by audit status, with the total in the middle. */
export function StatusDonut({ totals }: { totals: Fleet["totals"] }) {
  const parts = [
    { label: "Credited", value: totals.eligible, colour: "#14683f" },
    { label: "Held for review", value: totals.held, colour: "#e3a600" },
    { label: "Excluded", value: totals.excluded, colour: "#c2410c" },
  ];
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" className="h-[168px] w-[168px] shrink-0 -rotate-90" role="img" aria-label={`${totals.homes} homes: ${parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")}`}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#eef3ec" strokeWidth="18" />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const gap = p.value > 0 && p.value < total ? 3 : 0;
          const el = (
            <circle key={p.label} cx="80" cy="80" r={r} fill="none" stroke={p.colour} strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          offset += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "80px 80px" }}>
          <text x="80" y="76" textAnchor="middle" className="fill-[#6b7872] text-[11px]">Homes</text>
          <text x="80" y="102" textAnchor="middle" className="fill-[#10201a] text-[30px] font-semibold">{totals.homes}</text>
        </g>
      </svg>
      <ul className="grid w-full gap-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-3 rounded-xl bg-[#f6f8f5] px-3.5 py-2.5">
            <span className="h-8 w-1.5 rounded-full" style={{ background: p.colour }} />
            <span className="flex-1 text-[13px] text-body">{p.label}</span>
            <span className="text-[18px] font-semibold tabular-nums">{p.value}</span>
          </li>
        ))}
        <li className="flex items-center justify-between px-1 pt-1 text-[12.5px] text-muted">
          <span>Offline now: <strong className={totals.offline ? "text-red-700" : "text-ink"}>{totals.offline}</strong></span>
          <span>Low output: <strong className={totals.low_output ? "text-[#8a5a00]" : "text-ink"}>{totals.low_output}</strong></span>
        </li>
      </ul>
    </div>
  );
}

const SERIES = [
  { key: "used_kwh", label: "Solar used at home", colour: "#2f8f00" },
  { key: "grid_kwh", label: "Grid", colour: "#7c93a6" },
  { key: "backup_kwh", label: "Generator backup", colour: "#e07a1f" },
] as const;

/** Where the homes' power came from each month: solar, grid and what little generator backup is left. */
export function PowerMixChart({ months }: { months: FleetMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = months.map((m) => m.used_kwh + m.grid_kwh + m.backup_kwh);
  const max = Math.max(1, ...totals);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const W = 640;
  const H = 240;
  const left = 48;
  const bottom = 26;
  const plotH = H - bottom - 10;
  const band = (W - left - 8) / Math.max(1, months.length);
  const bar = Math.min(54, band * 0.56);
  const shown = hover !== null ? months[hover] : null;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly power by source across the homes">
          {ticks.map((t) => {
            const y = 10 + plotH - (t / top) * plotH;
            return (
              <g key={t}>
                <line x1={left} x2={W - 4} y1={y} y2={y} stroke="#e7ece5" strokeDasharray={t ? "3 4" : undefined} />
                <text x={left - 8} y={y + 4} textAnchor="end" className="fill-[#6b7872] text-[11px]">{t >= 1000 ? `${t / 1000}k` : t}</text>
              </g>
            );
          })}
          {months.map((m, i) => {
            const x = left + band * i + (band - bar) / 2;
            let y = 10 + plotH;
            return (
              <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
                <rect x={left + band * i} y={10} width={band} height={plotH} fill={hover === i ? "#f3f7f1" : "transparent"} />
                {SERIES.map((s, si) => {
                  const h = (m[s.key] / top) * plotH;
                  y -= h;
                  return <rect key={s.key} x={x} y={y} width={bar} height={Math.max(0, h)} fill={s.colour} rx={si === SERIES.length - 1 ? 3 : 0} />;
                })}
                <text x={left + band * i + band / 2} y={H - 8} textAnchor="middle" className="fill-[#6b7872] text-[11px]">{monthLabel(m.month).split(" ")[0]}</text>
              </g>
            );
          })}
        </svg>
        {shown && (
          <div className="pointer-events-none absolute right-2 top-0 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] shadow-lg">
            <p className="font-semibold">{monthLabel(shown.month)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-2 text-body">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.colour }} /> {s.label}
                <span className="ml-auto pl-3 font-medium tabular-nums text-ink">{Math.round(shown[s.key]).toLocaleString("en-NG")} kWh</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-body">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.colour }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}

const BANDS = [
  { grade: "A", range: "0–2%", colour: "#14683f" },
  { grade: "B", range: "3–10%", colour: "#2f8f00" },
  { grade: "C", range: "11–25%", colour: "#86b82b" },
  { grade: "D", range: "26–40%", colour: "#cdb51f" },
  { grade: "E", range: "41–55%", colour: "#e3a600" },
  { grade: "F", range: "56–75%", colour: "#e07a1f" },
  { grade: "G", range: "over 75%", colour: "#c2410c" },
];

/** Homes per energy grade, drawn like the bands on a Home Energy Certificate. */
export function GradeBands({ grades }: { grades: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(grades));
  return (
    <ul className="space-y-1.5">
      {BANDS.map((b, i) => {
        const n = grades[b.grade] ?? 0;
        return (
          <li key={b.grade} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3">
            <div className="flex h-7 items-center">
              <span className="flex h-full items-center justify-between rounded-l-md pl-2.5 pr-2 text-[12.5px] font-bold text-white" style={{ background: b.colour, width: `${34 + i * 7}%` }}>
                {b.grade}<span className="text-[10.5px] font-medium opacity-90">{b.range}</span>
              </span>
              <span className="h-0 w-0 border-y-[14px] border-l-[10px] border-y-transparent" style={{ borderLeftColor: b.colour }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef3ec]">
                <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: b.colour }} />
              </span>
              <span className={`w-5 text-right text-[13px] tabular-nums ${n ? "font-semibold" : "text-muted"}`}>{n}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
