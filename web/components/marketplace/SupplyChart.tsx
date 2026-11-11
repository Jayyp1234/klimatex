"use client";

import { useState } from "react";
import { Co2Text } from "@/components/Co2Text";

const WIDTH = 620;
const HEIGHT = 216;
const LEFT = 38;
const TOP = 12;
const BOTTOM = 30;
const BAR_WIDTH = 40;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const plotHeight = HEIGHT - TOP - BOTTOM;

/** A round axis step from the 1, 2, 5 series, so ticks stay readable at any scale. */
function niceStep(rough: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const leading = rough / magnitude;
  return (leading <= 1 ? 1 : leading <= 2 ? 2 : leading <= 5 ? 5 : 10) * magnitude;
}

function barPath(x: number, y: number, base: number) {
  const r = Math.min(4, base - y);
  return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + BAR_WIDTH - r}Q${x + BAR_WIDTH} ${y} ${x + BAR_WIDTH} ${y + r}V${base}Z`;
}

type Point = { label: string; year: string; tonnes: number };

export function SupplyChart({ data }: { data: { month: string; tonnes: number }[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">All credits are sold. New supply appears after the next audit.</p>;
  }

  const points: Point[] = data.map(({ month, tonnes }) => ({ label: MONTHS[Number(month.slice(5, 7)) - 1], year: month.slice(0, 4), tonnes }));
  const peak = Math.max(...points.map((p) => p.tonnes));
  const step = niceStep(peak / 4);
  const axisMax = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, i) => Number((i * step).toFixed(6)));
  const yFor = (value: number) => TOP + plotHeight * (1 - value / axisMax);
  const band = (WIDTH - LEFT) / points.length;
  const baseline = yFor(0);

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Available credits by generation month">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={yFor(tick)} y2={yFor(tick)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={LEFT - 10} y={yFor(tick) + 4} textAnchor="end" fontSize="11.5" fill="var(--color-muted)">
              {tick}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = LEFT + band * index + (band - BAR_WIDTH) / 2;
          return (
            <g key={`${point.year}-${point.label}`}>
              <path d={barPath(x, yFor(point.tonnes), baseline)} fill="var(--color-forest)" opacity={active === null || active === index ? 1 : 0.45} className="transition-opacity" />
              <text x={x + BAR_WIDTH / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="var(--color-body)">
                {point.label}
              </text>
              <rect
                x={LEFT + band * index}
                y={TOP}
                width={band}
                height={plotHeight + BOTTOM}
                fill="transparent"
                tabIndex={0}
                aria-label={`${point.label}: ${point.tonnes.toFixed(2)} tonnes`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            </g>
          );
        })}
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((LEFT + band * active + band / 2) / WIDTH) * 100}%`,
            top: `${(yFor(points[active].tonnes) / HEIGHT) * 100}%`,
            marginTop: -8,
          }}
        >
          <p className="text-muted">{points[active].label} {points[active].year}</p>
          <p className="whitespace-nowrap font-semibold text-ink">
            <Co2Text text={`${points[active].tonnes.toFixed(2)} tCO₂e`} />
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Available credits by generation month</caption>
        <tbody>
          {points.map((point) => (
            <tr key={`${point.year}-${point.label}`}>
              <th scope="row">{point.label} {point.year}</th>
              <td>{point.tonnes.toFixed(2)} tonnes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
