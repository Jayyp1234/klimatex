import type { ReactNode } from "react";
import { BadgeCheck, Coins, Fuel, Leaf, Sparkles, Sun, TriangleAlert } from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { formatNaira } from "@/lib/marketplace";
import { number, type Estimate, type Installer } from "@/lib/onboarding";

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
