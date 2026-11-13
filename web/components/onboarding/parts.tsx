"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { BadgeCheck, BatteryCharging, Check, Coins, Fuel, Leaf, SolarPanel, Sparkles, Sun, TriangleAlert, X, Zap } from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { formatNaira } from "@/lib/marketplace";
import { number, packageFit, priceRange, type Estimate, type Installer, type Package } from "@/lib/onboarding";

export const primaryButton =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-forest px-6 text-[15px] font-medium text-white shadow-[0_10px_24px_-12px_rgb(11_63_42/0.7)] transition hover:bg-forest-hover active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30";
export const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-medium text-ink transition hover:bg-mint disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30";
export const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition placeholder:text-muted/80 focus:border-leaf focus:ring-4 focus:ring-leaf/12 aria-[invalid=true]:border-red-300";

/** An API error, shown next to the step it belongs to. */
export function InlineError({ message, id, children }: { message: string; id?: string; children?: ReactNode }) {
  if (!message) return null;
  return (
    <div id={id} role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        {message}
        {children}
      </span>
    </div>
  );
}

/** How an installer's homes perform on our meters, or that it is new. */
export function InstallerBadge({ installer }: { installer: Pick<Installer, "metered_homes" | "average_trust_score"> }) {
  if (!installer.metered_homes) {
    return <span className="inline-flex items-center gap-1 rounded-md bg-[#eef0ec] px-2 py-0.5 text-xs font-medium text-[#41504a]"><Sparkles size={12} aria-hidden /> New on KlimateX</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#e4f3d5] px-2 py-0.5 text-xs font-medium text-[#27500a]">
      <BadgeCheck size={12} aria-hidden /> {installer.metered_homes} metered home{installer.metered_homes === 1 ? "" : "s"}
      {installer.average_trust_score !== null && <> · trust score {installer.average_trust_score}</>}
    </span>
  );
}

export function EstimateTag() {
  return <span className="rounded-md bg-[#fdf3d7] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a5a00]">Estimate</span>;
}

/** Yearly figures for a system size, always labelled as an estimate. */
export function EstimateFigures({ estimate, compact = false, title = "A year with this system" }: { estimate: Estimate; compact?: boolean; title?: string }) {
  const items = [
    { icon: Sun, label: "Solar energy", value: `${number(estimate.solar_kwh_year)} kWh` },
    { icon: Fuel, label: "Petrol not burned", value: `${number(estimate.petrol_litres_year)} litres` },
    { icon: Coins, label: "Family carbon income", value: formatNaira(Math.round(estimate.family_carbon_naira_year)) },
    ...(compact ? [] : [{ icon: Leaf, label: "Carbon avoided", value: <Co2Text text={`${estimate.tonnes_year} tCO₂e`} /> }]),
  ];
  if (compact) {
    return (
      <div className="rounded-xl bg-mint/70 p-3">
        <p className="flex items-center gap-2 text-[12px] font-medium text-body"><EstimateTag /> per year</p>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[11.5px] leading-tight text-body">{item.label}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold leading-tight text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink"><EstimateTag /> {title}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex min-w-0 items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint text-forest"><Icon size={16} aria-hidden /></span>
            <div className="min-w-0">
              <dt className="text-[12.5px] text-body">{label}</dt>
              <dd className="text-[16px] font-semibold tracking-tight text-ink">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{estimate.basis}</p>
    </div>
  );
}

/** Where a package's price range sits among every package on offer. */
export function PriceBar({ min, max, range }: { min: number; max: number; range: [number, number] }) {
  const [lo, hi] = range;
  const span = Math.max(hi - lo, 1);
  const left = Math.min(Math.max(((min - lo) / span) * 100, 0), 96);
  const width = Math.max(((max - min) / span) * 100, 4);
  return (
    <div aria-hidden className="mt-2">
      <div className="relative h-2 rounded-full bg-mint-strong">
        <span className="absolute inset-y-0 rounded-full bg-gradient-to-r from-leaf to-lime" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>Lower cost</span>
        <span>Higher cost</span>
      </div>
    </div>
  );
}

/**
 * One solar package: size and who it suits, what is in the box, the price range on a bar, and its estimate.
 * Used by the sign-up list, the tracker's "change my choices" and "start again".
 */
export function PackageCard({
  pkg,
  installerName,
  range,
  selected = false,
  current = false,
  onChoose,
  chooseLabel = "Choose this package",
  estimate = true,
}: {
  pkg: Package;
  installerName?: string;
  range: [number, number];
  selected?: boolean;
  current?: boolean;
  onChoose: () => void;
  chooseLabel?: string;
  estimate?: boolean;
}) {
  const fit = packageFit(pkg);
  const specs = [
    { icon: Zap, text: `${pkg.inverter_kva} kVA inverter` },
    { icon: BatteryCharging, text: `${pkg.battery_kwh} kWh battery` },
    { icon: SolarPanel, text: `${pkg.panels} × ${pkg.panel_w} W panels` },
  ];
  return (
    <article
      className={`flex min-w-0 flex-col rounded-2xl border bg-white p-4 transition duration-200 ${
        selected ? "border-forest ring-2 ring-forest/80" : "border-line hover:border-forest/30 hover:shadow-[0_12px_28px_-20px_rgb(11_63_42/0.45)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${fit.size === "Large" ? "bg-forest text-white" : fit.size === "Medium" ? "bg-leaf/90 text-white" : "bg-mint-strong text-forest"}`}>
          {fit.size} · {pkg.inverter_kva} kVA
        </span>
        <span className="text-[12px] text-body">Best for {fit.bestFor}</span>
        {current && <span className="ml-auto rounded-md bg-[#fdf3d7] px-2 py-0.5 text-[11.5px] font-semibold text-[#8a5a00]">Your current package</span>}
      </div>
      <h3 className="mt-2 text-[16px] font-semibold leading-snug">
        {pkg.name}
        {installerName && <span className="block text-[12.5px] font-normal text-body">{installerName}</span>}
      </h3>
      <ul className="mt-3 grid grid-cols-3 gap-1.5">
        {specs.map(({ icon: Icon, text }) => (
          <li key={text} className="flex min-w-0 flex-col items-start gap-1 rounded-lg bg-[#f6f8f5] px-2 py-2 text-[11.5px] leading-tight text-ink">
            <Icon size={15} className="text-leaf" aria-hidden />
            <span className="min-w-0 break-words">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-ink"><span className="text-body">Powers:</span> {pkg.powers}</p>
      <p className="mt-3 text-[19px] font-semibold tracking-tight text-forest">{priceRange(pkg.price_min_naira, pkg.price_max_naira)}</p>
      <PriceBar min={pkg.price_min_naira} max={pkg.price_max_naira} range={range} />
      {estimate && <div className="mt-3 flex-1"><EstimateFigures estimate={pkg.estimate} compact /></div>}
      <button
        type="button"
        onClick={onChoose}
        aria-pressed={selected}
        aria-label={`${chooseLabel}: ${pkg.name}${installerName ? ` from ${installerName}` : ""}`}
        className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[14.5px] font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30 ${
          selected ? "border-forest bg-forest text-white" : "border-forest/30 bg-white text-forest hover:bg-mint"
        }`}
      >
        {selected && <Check size={16} aria-hidden />} {selected ? "Selected" : chooseLabel}
      </button>
    </article>
  );
}

/** A modal sheet built on <dialog>: focus stays inside, Escape and the backdrop close it. */
export function Sheet({ title, description, onClose, children, wide = false }: { title: string; description?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // No close() on cleanup: that fires the close event, and onClose would shut the sheet straight after it opens.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && ref.current?.close()}
      className={`kx-step-in m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] overflow-y-auto rounded-2xl bg-white p-0 text-ink shadow-2xl ${wide ? "max-w-[860px]" : "max-w-[520px]"}`}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[13.5px] text-body">{description}</p>}
        </div>
        <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="-mr-1.5 rounded-lg p-1.5 text-muted hover:bg-mint hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30">
          <X size={20} />
        </button>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </dialog>
  );
}

/** The yearly estimate as four stat tiles, each marked as an estimate. */
export function EstimateTiles({ estimate, title }: { estimate: Estimate; title: string }) {
  const tiles = [
    { icon: Sun, label: "Solar energy a year", value: `${number(estimate.solar_kwh_year)} kWh`, tone: "bg-[#fdf3d7] text-[#8a5a00]" },
    { icon: Fuel, label: "Petrol not burned", value: `${number(estimate.petrol_litres_year)} litres`, tone: "bg-[#eef0ec] text-[#41504a]" },
    { icon: Coins, label: "Family carbon income", value: formatNaira(Math.round(estimate.family_carbon_naira_year)), tone: "bg-[#e4f3d5] text-[#27500a]" },
    { icon: Leaf, label: "Carbon kept out of the air", value: <Co2Text text={`${estimate.tonnes_year} tCO₂e`} />, tone: "bg-mint-strong text-forest" },
  ];
  return (
    <section aria-labelledby="estimate-heading" className="rounded-2xl border border-line bg-white p-5">
      <h2 id="estimate-heading" className="flex flex-wrap items-center gap-2 text-[16px] font-semibold tracking-tight"><EstimateTag /> {title}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="flex min-w-0 flex-col rounded-xl border border-line bg-[#fbfcfa] p-3.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17} aria-hidden /></span>
            <dt className="order-2 mt-0.5 text-[12.5px] leading-snug text-body">{label} <span className="text-muted">(estimate)</span></dt>
            <dd className="order-1 mt-3 break-words text-[20px] font-semibold leading-tight tracking-tight text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{estimate.basis}</p>
    </section>
  );
}
