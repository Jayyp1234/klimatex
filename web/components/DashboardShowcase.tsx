"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/** Real screens from the platform (demo data), one per role. */
const DASHBOARDS = [
  { id: "household", label: "Household", src: "/images/screens/dash-household.webp",
    text: "Grade, petrol saved, payouts, the street's grade and tips to earn more, for every family." },
  { id: "installer", label: "Installer", src: "/images/screens/dash-installer.webp",
    text: "Every home fitted: solar made, audit status, earnings, and which homes need a visit." },
  { id: "auditor", label: "Auditor", src: "/images/screens/dash-auditor.webp",
    text: "Nine checks on every home, a sample drawn with a visible seed, and sign-off with a full trail." },
  { id: "marketplace", label: "Buyers", src: "/images/screens/dash-marketplace.webp",
    text: "Serialised credits traced to real home-months, retired in the buyer's name, checkable by anyone." },
  { id: "lender", label: "Access Bank", src: "/images/screens/dash-lender.webp",
    text: "Solar loans by metered energy grade, with carbon payouts flowing straight into repayments." },
  { id: "streets", label: "Streets", src: "/images/screens/dash-streets.webp",
    text: "How clean each street's power is, published as street totals only." },
];
const INTERVAL_MS = 4500;

/** Tabs that auto-advance with a progress bar until someone picks one. */
export function DashboardShowcase() {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [calm, setCalm] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  const playing = auto && visible && !calm;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % DASHBOARDS.length), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  const current = DASHBOARDS[index];

  return (
    <div ref={root}>
      <div role="tablist" aria-label="Dashboards" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {DASHBOARDS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            id={`dash-tab-${d.id}`}
            aria-selected={i === index}
            aria-controls="dash-panel"
            onClick={() => {
              setIndex(i);
              setAuto(false);
            }}
            className={`relative shrink-0 overflow-hidden rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
              i === index ? "bg-forest text-white" : "bg-white text-body ring-1 ring-line hover:text-ink"
            }`}
          >
            {d.label}
            {i === index && playing && (
              <span key={index} aria-hidden className="kx-progress absolute inset-x-0 bottom-0 h-[3px] bg-[#9bd86b]" style={{ ["--kx-duration" as string]: `${INTERVAL_MS}ms` }} />
            )}
          </button>
        ))}
      </div>

      <div id="dash-panel" role="tabpanel" aria-labelledby={`dash-tab-${current.id}`} className="mt-5">
        <p className="min-h-[3em] max-w-[640px] text-[15.5px] leading-[1.5] text-body sm:min-h-0">{current.text}</p>
        <div className="relative mt-4 aspect-[1184/784] overflow-hidden rounded-2xl border border-line bg-[#f2f4f1] shadow-[0_24px_60px_-18px_rgb(11_63_42/0.35)]">
          {DASHBOARDS.map((d, i) => (
            <Image
              key={d.id}
              src={d.src}
              alt={i === index ? `${d.label} dashboard, demonstration data` : ""}
              aria-hidden={i !== index}
              fill
              sizes="(min-width: 1160px) 1112px, 100vw"
              className={`object-cover object-top transition-all duration-700 ease-out ${i === index ? "scale-100 opacity-100" : "scale-[1.015] opacity-0"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
