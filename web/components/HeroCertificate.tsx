import { Fuel, ShieldCheck, Sun, Zap } from "lucide-react";
import { Co2Text } from "./Co2Text";

/** The KlimateX A–G scale, coloured like an energy label: share of the home's power still from a generator. */
const scale = [
  { grade: "A", colour: "#13693a" },
  { grade: "B", colour: "#2f9246" },
  { grade: "C", colour: "#86bc3c" },
  { grade: "D", colour: "#d8c62b" },
  { grade: "E", colour: "#f0a91f" },
  { grade: "F", colour: "#ea7a25" },
  { grade: "G", colour: "#d9482f" },
];

const BEFORE = "F";
const NOW = "B";

// Adaeze's home from the demo data, annualised: solar to the home, the 75% of it that replaced the
// generator (grid supplies 6 h a day), and 0.7 L of petrol per generator kWh.
const stats = [
  { value: "2,006", unit: "kWh", label: "Solar delivered", icon: Sun },
  { value: "1,504", unit: "kWh", label: "Generator avoided", icon: Zap },
];

export function HeroCertificate() {
  return (
    <article
      aria-label="Sample Home Energy Certificate"
      className="kx-float w-full max-w-[340px] overflow-hidden rounded-[20px] border border-white/70 bg-white shadow-[0_1px_2px_rgb(11_63_42/0.06),0_24px_60px_-18px_rgb(11_63_42/0.38)] ring-1 ring-line"
    >
      <header className="flex items-center gap-3 bg-gradient-to-br from-mint to-white px-5 pb-3.5 pt-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-white">
          <ShieldCheck size={18} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight tracking-tight">Home Energy Certificate</p>
          <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted">KX-HEC-2026 · Surulere</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#e3f2d8] px-2 py-1 text-[10.5px] font-semibold text-forest">
          <span className="size-1.5 rounded-full bg-leaf" aria-hidden />
          Verified
        </span>
      </header>

      <div className="px-5 pb-4 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-forest">2.1</p>
            <p className="mt-1.5 text-[13px] font-medium text-ink">
              <Co2Text text="tCO₂e avoided a year" />
            </p>
          </div>
          <div className="flex size-[62px] shrink-0 flex-col items-center justify-center rounded-2xl bg-[#2f9246] text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.12)]">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/80">Grade</span>
            <span className="text-[30px] font-bold leading-none">{NOW}</span>
          </div>
        </div>

        <div className="mt-5" role="img" aria-label={`Energy grade improved from ${BEFORE} to ${NOW} on a scale of A to G`}>
          <div className="grid grid-cols-7 items-end gap-1">
            {scale.map(({ grade, colour }) => {
              const now = grade === NOW;
              return (
                <div
                  key={grade}
                  style={{ backgroundColor: colour }}
                  className={`flex items-center justify-center rounded-md text-[10.5px] font-bold text-white ${
                    now ? "h-8 shadow-[0_6px_14px_-4px_rgb(19_105_58/0.6)] ring-2 ring-white" : `h-5 ${grade === BEFORE ? "" : "opacity-55"}`
                  }`}
                >
                  {grade}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1 text-center text-[10px] font-medium">
            {scale.map(({ grade }) => (
              <span key={grade} className={grade === NOW ? "text-forest" : "text-muted"}>
                {grade === NOW ? "Now" : grade === BEFORE ? "Before" : ""}
              </span>
            ))}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(({ value, unit, label, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-mint px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[10.5px] leading-tight text-body">
                <Icon size={13} className="shrink-0 text-leaf" aria-hidden />
                {label}
              </dt>
              <dd className="mt-1 text-[16px] font-semibold tracking-tight">
                {value} <span className="text-[11px] font-medium text-muted">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 flex items-center gap-2 text-[12px] text-body">
          <Fuel size={14} className="text-leaf" aria-hidden />
          About <span className="font-semibold text-ink">1,050 litres</span> of petrol not burned
        </p>
      </div>

      <footer className="flex items-center justify-between border-t border-line bg-[#fafbf9] px-5 py-2.5 text-[10.5px] text-muted">
        <span>Metered daily from the inverter</span>
        <span>Sample home, annualised</span>
      </footer>
    </article>
  );
}
