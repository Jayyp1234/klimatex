import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "./EnergyChart";

type Icon = ComponentType<{ size?: number; className?: string }>;

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 max-w-[640px] text-[15px] text-body">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 print:hidden">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className = "", flush = false }: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-line bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-body">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Kpi({ icon: IconComponent, label, value, detail, trend }: { icon: Icon; label: string; value: ReactNode; detail?: ReactNode; trend?: number[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2.5 text-[13px] font-medium text-body">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-forest"><IconComponent size={16} /></span>
        {label}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[24px] font-semibold leading-tight tracking-tight">{value}</p>
          {detail && <p className="mt-1 text-[12.5px] text-body">{detail}</p>}
        </div>
        {trend && <Sparkline values={trend} />}
      </div>
    </div>
  );
}

export function Change({ now, before, label }: { now: number; before: number | undefined; label: string }) {
  if (!before) return <span>{label}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const Arrow = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <Arrow size={14} className={pct >= 0 ? "text-leaf" : "text-[#8a5a00]"} aria-hidden />
      <span className="font-medium text-ink">{pct >= 0 ? "+" : ""}{pct}%</span> vs {label}
    </span>
  );
}

const TONES = {
  green: "bg-[#e4f3d5] text-[#27500a]",
  amber: "bg-[#faeeda] text-[#633806]",
  red: "bg-red-50 text-red-800",
  grey: "bg-[#eef0ec] text-[#41504a]",
};

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function ViewAll({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-leaf hover:underline">
      {children} <ArrowRight size={14} />
    </Link>
  );
}

export const buttonSecondary = "inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[13px] font-medium text-ink hover:bg-mint";
export const selectClass = "h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] font-medium outline-none focus:border-leaf";
