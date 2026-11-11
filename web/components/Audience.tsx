"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Bell, Coins, Home, Layers, MessageSquare, Zap } from "lucide-react";
import { links, solutions, type SolutionId } from "@/lib/links";
import { Co2Text } from "./Co2Text";

type View = {
  text: string;
  cta: string;
  device: "phone" | "panel";
  eyebrow: string;
  title: string;
  cardLabel: string;
  badge: string;
  stats: [{ value: string; label: string }, { value: string; label: string }];
};

// Figures are from the seeded demo period (Jan to Jun 2026).
const views: Record<SolutionId, View> = {
  families: {
    text: "Switch to solar, earn verified credits and receive payments, with a clear Home Energy Certificate for your home.",
    cta: "Explore the household app",
    device: "phone",
    eyebrow: "Good morning,",
    title: "Adaeze",
    cardLabel: "Home Energy Certificate",
    badge: "Grade B",
    stats: [
      { value: "2.1 tCO₂e", label: "Annual credits" },
      { value: "₦4,276", label: "Latest payout" },
    ],
  },
  installers: {
    text: "Onboard a home in one visit: consent, generator trade-in, inverter pairing and GPS-tagged proof, with fleet earnings in one view.",
    cta: "Explore the installer app",
    device: "phone",
    eyebrow: "Your fleet",
    title: "Arewa Solar",
    cardLabel: "Homes installed",
    badge: "20 homes",
    stats: [
      { value: "93", label: "Average trust score" },
      { value: "₦22,500", label: "Latest earnings" },
    ],
  },
  auditors: {
    text: "Review evidence behind every home, draw a sample with a visible seed, and sign off a monitoring period with a full audit trail.",
    cta: "Explore the auditor portal",
    device: "panel",
    eyebrow: "Monitoring period",
    title: "LAG01 · Jan to Jun 2026",
    cardLabel: "Automated controls",
    badge: "3 flags",
    stats: [
      { value: "18.225", label: "Eligible tCO₂e" },
      { value: "6 sites", label: "Sample, seed 42" },
    ],
  },
  buyers: {
    text: "Buy serialised credits traced to real home-months, retire them in your name and hold a certificate anyone can check.",
    cta: "Explore the marketplace",
    device: "panel",
    eyebrow: "Marketplace",
    title: "LAG01 household batch",
    cardLabel: "Vintage 2026",
    badge: "8 t available",
    stats: [
      { value: "₦15,000", label: "Price per tonne" },
      { value: "10 t", label: "Retired to date" },
    ],
  },
  bank: {
    text: "See homes and solar loans by metered energy grade, with carbon payouts flowing directly into repayments and wallets.",
    cta: "Explore the lender dashboard",
    device: "panel",
    eyebrow: "Portfolio",
    title: "Metered energy grades",
    cardLabel: "Homes on A or B",
    badge: "20 of 20",
    stats: [
      { value: "₦8,598", label: "Carbon repayments" },
      { value: "₦66,402", label: "Wallet inflows" },
    ],
  },
};

const appNav = [
  { label: "Home", icon: Home },
  { label: "Energy", icon: Zap },
  { label: "Credits", icon: Layers },
  { label: "Messages", icon: MessageSquare },
];

function Screen({ view }: { view: View }) {
  const phone = view.device === "phone";
  return (
    <div
      className={
        phone
          ? "w-[218px] rounded-t-[34px] border-[5px] border-b-0 border-ink bg-white"
          : "w-full max-w-[320px] rounded-t-2xl border border-b-0 border-line bg-white shadow-xl"
      }
    >
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <Image src="/logo.svg" alt="" width={84} height={20} className="h-[18px] w-auto" />
          <Bell size={15} className="text-ink" aria-hidden />
        </div>
        <p className="mt-5 text-[11px] text-muted">{view.eyebrow}</p>
        <p className="text-[15px] font-semibold tracking-tight">{view.title}</p>
        <div className="mt-3 flex h-[76px] overflow-hidden rounded-xl bg-mint">
          <div className="flex flex-col justify-center gap-1.5 pl-3">
            <span className="text-[10px] font-medium text-forest">{view.cardLabel}</span>
            <span className="w-fit rounded-md bg-forest px-2 py-0.5 text-[10px] font-medium text-white">{view.badge}</span>
          </div>
          <Image src="/images/home-thumb.webp" alt="" width={120} height={76} className="ml-auto h-full w-[84px] object-cover" />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {view.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-line px-2.5 py-2.5">
              <p className="whitespace-nowrap text-[13px] font-semibold tracking-tight"><Co2Text text={stat.value} /></p>
              <p className="mt-0.5 text-[10px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      {phone && (
        <div className="grid grid-cols-4 border-t border-line px-1.5 pb-3 pt-2">
          {appNav.map(({ label, icon: Icon }, index) => (
            <span key={label} className={`flex flex-col items-center gap-0.5 text-[9px] ${index === 0 ? "font-semibold text-forest" : "text-muted"}`}>
              <Icon size={14} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      )}
      {!phone && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[11px] text-muted">
          <Coins size={13} aria-hidden /> Demonstration data
        </div>
      )}
    </div>
  );
}

export function Audience() {
  const [active, setActive] = useState<SolutionId>("families");
  const section = useRef<HTMLElement>(null);
  const view = views[active];

  useEffect(() => {
    const onHash = () => {
      const match = solutions.find((s) => window.location.hash === `#for-${s.id}`);
      if (match) {
        setActive(match.id);
        section.current?.scrollIntoView();
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <section ref={section} id="solutions" className="relative overflow-hidden bg-white">
      <div className="absolute inset-y-0 left-0 hidden w-[max(340px,calc((100vw-1160px)/2+340px))] lg:block">
        <Image
          src="/images/installer.webp"
          alt="Solar installation technician in a hard hat and safety vest"
          fill
          sizes="40vw"
          className="object-cover object-[center_20%]"
        />
        <div aria-hidden className="absolute inset-y-0 right-0 w-28 bg-gradient-to-r from-transparent to-white" />
      </div>

      <div className="relative mx-auto grid max-w-[1160px] grid-cols-[minmax(0,1fr)] items-end lg:min-h-[340px] lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)_260px] lg:gap-8">
        <div aria-hidden className="hidden lg:block" />

        <div className="self-center px-4 py-10 sm:px-6 lg:px-0 lg:py-9">
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[36px]">
            Built for the people
            <br />
            who make it work
          </h2>

          <div role="tablist" aria-label="Who KlimateX is for" className="mt-6 flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none]">
            {solutions.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={active === s.id}
                aria-controls="audience-panel"
                onClick={() => setActive(s.id)}
                className={`-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active === s.id ? "border-forest text-forest" : "border-transparent text-body hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div id="audience-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
            <p className="mt-5 max-w-[420px] text-[16px] leading-[1.55] text-body">{view.text}</p>
            <a
              href={active === "families" ? links.signIn : links.workSignIn}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-forest-hover"
            >
              {view.cta} <ArrowRight size={16} />
            </a>
          </div>
        </div>

        <div className="flex justify-center px-4 pt-2 lg:px-0 lg:pt-8">
          <Screen view={view} />
        </div>
      </div>
    </section>
  );
}
