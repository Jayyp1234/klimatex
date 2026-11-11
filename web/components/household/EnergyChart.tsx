"use client";

import { useState } from "react";
import type { Day } from "@/lib/household";

const WIDTH = 640;
const HEIGHT = 240;
const LEFT = 40;
const TOP = 12;
const BOTTOM = 30;
const SOLAR = "#14683f";
const CEILING = "#e3a600";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const plotHeight = HEIGHT - TOP - BOTTOM;

function niceStep(rough: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const leading = rough / magnitude;
  return (leading <= 1 ? 1 : leading <= 2 ? 2 : leading <= 5 ? 5 : 10) * magnitude;
}

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const label = (day: string, weekly: boolean) => (weekly ? WEEKDAYS[date(day).getUTCDay()] : String(date(day).getUTCDate()));
const longLabel = (day: string) => date(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Daily solar against the most the sun allowed that day. One axis, both in kWh. */
export function EnergyChart({ days, showSolar, showCeiling }: { days: Day[]; showSolar: boolean; showCeiling: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const weekly = days.length <= 7;
  const peak = Math.max(1, ...days.map((d) => Math.max(d.generated, d.ceiling ?? 0)));
  const step = niceStep(peak / 4);
  const axisMax = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, i) => Number((i * step).toFixed(6)));
  const y = (value: number) => TOP + plotHeight * (1 - value / axisMax);
  const band = (WIDTH - LEFT) / days.length;
  const barWidth = Math.min(46, band * 0.62);
  const centre = (i: number) => LEFT + band * i + band / 2;
  const base = y(0);
  const ceilingPath = days
    .map((d, i) => (d.ceiling === null ? null : `${centre(i).toFixed(1)} ${y(d.ceiling).toFixed(1)}`))
    .filter(Boolean)
    .map((point, i) => `${i ? "L" : "M"}${point}`)
    .join("");

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Daily solar energy against the sunlight ceiling, in kilowatt-hours">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeDasharray={tick ? "3 4" : undefined} />
            <text x={LEFT - 10} y={y(tick) + 4} textAnchor="end" fontSize="11.5" fill="var(--color-muted)">{tick}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = centre(i) - barWidth / 2;
          const top = y(d.generated);
          const r = Math.min(4, base - top, barWidth / 2);
          const dim = active !== null && active !== i ? 0.45 : 1;
          return (
            <g key={d.day}>
              {showSolar && (
                <path d={`M${x} ${base}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + barWidth - r}Q${x + barWidth} ${top} ${x + barWidth} ${top + r}V${base}Z`} fill={SOLAR} opacity={dim} />
              )}
              {(weekly || i % 5 === 0 || i === days.length - 1) && (
                <text x={centre(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="var(--color-body)">{label(d.day, weekly)}</text>
              )}
            </g>
          );
        })}
        {showCeiling && ceilingPath && <path d={ceilingPath} fill="none" stroke={CEILING} strokeWidth="2" strokeLinejoin="round" />}
        {showCeiling &&
          days.map((d, i) =>
            d.ceiling === null || (!weekly && active !== i) ? null : (
              <circle key={d.day} cx={centre(i)} cy={y(d.ceiling)} r={weekly ? 4.5 : 4} fill="white" stroke={CEILING} strokeWidth="2" />
            ),
          )}
        {days.map((d, i) => (
          <rect
            key={d.day}
            x={LEFT + band * i}
            y={TOP}
            width={band}
            height={plotHeight + BOTTOM}
            fill="transparent"
            tabIndex={0}
            aria-label={`${longLabel(d.day)}: solar ${d.generated.toFixed(1)} kWh, ceiling ${d.ceiling?.toFixed(1) ?? "unknown"} kWh`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="outline-none"
          />
        ))}
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(centre(active) / WIDTH) * 100}%`, top: `${(y(Math.max(days[active].generated, days[active].ceiling ?? 0)) / HEIGHT) * 100}%`, marginTop: -10 }}
        >
          <p className="mb-1 font-medium text-ink">{longLabel(days[active].day)}</p>
          <p className="flex items-center justify-between gap-5 text-body">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SOLAR }} /> Solar energy</span>
            <span className="font-semibold text-ink">{days[active].generated.toFixed(1)} kWh</span>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-5 text-body">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CEILING }} /> Sunlight ceiling</span>
            <span className="font-semibold text-ink">{days[active].ceiling?.toFixed(1) ?? "n/a"} kWh</span>
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Daily solar energy and sunlight ceiling, kWh</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Solar</th><th scope="col">Ceiling</th></tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}><th scope="row">{longLabel(d.day)}</th><td>{d.generated.toFixed(1)}</td><td>{d.ceiling?.toFixed(1) ?? "n/a"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const SERIES_COLOURS = { solar: SOLAR, ceiling: CEILING };

/** A tiny trend line for the stat cards. Decorative: the number beside it carries the meaning. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 96 + 2},${30 - ((v - min) / span) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 34" className="h-9 w-24" aria-hidden>
      <polyline points={points} fill="none" stroke={SOLAR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
