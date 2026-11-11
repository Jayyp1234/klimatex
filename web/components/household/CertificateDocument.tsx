"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Check, Copy, Download, Printer, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { Co2Text } from "@/components/Co2Text";
import { checkLabel, homeCode, longDate, type Certificate, type Dashboard } from "@/lib/household";

/** EPC-style bands: the share of the home's power that still comes from a generator. */
const BANDS = [
  { grade: "A", range: "0–2%", colour: "#14683f" },
  { grade: "B", range: "3–10%", colour: "#2f8f00" },
  { grade: "C", range: "11–25%", colour: "#86b82b" },
  { grade: "D", range: "26–40%", colour: "#cdb51f" },
  { grade: "E", range: "41–55%", colour: "#e3a600" },
  { grade: "F", range: "56–75%", colour: "#e07a1f" },
  { grade: "G", range: "over 75%", colour: "#c2410c" },
];

const noop = () => () => {};

const A4_WIDTH = 794; // 210 mm at 96 dpi
const A4_HEIGHT = 1123;

function addYear(iso: string | null) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function potentialGrade(potential: string) {
  return /^([A-G])\b/.exec(potential.trim())?.[1] ?? "A";
}

function Pointer({ label, share, align }: { label: string; share: string; align: "now" | "before" | "potential" }) {
  const tone = align === "now" ? "#0b3f2a" : align === "potential" ? "#14683f" : "#6b7872";
  return (
    <span className="flex h-[24px] items-center">
      <span className="h-0 w-0 border-y-[12px] border-r-[10px] border-y-transparent" style={{ borderRightColor: tone }} />
      <span className="flex h-[24px] items-center gap-1.5 rounded-r-md px-2.5 text-[12px] font-semibold text-white" style={{ background: tone }}>
        <span className="text-[15px]">{label}</span>
        <span className="font-normal opacity-85">{share}</span>
      </span>
    </span>
  );
}

/** The certificate itself: one A4 page, identical on screen and in the PDF. */
function Sheet({ c, data, qr, issued, validUntil }: { c: Certificate; data: Dashboard; qr: string; issued: string | null; validUntil: string | null }) {
  const { home } = data;
  const potential = potentialGrade(c.potential);
  const passed = c.checks.filter((ch) => ch.result === "pass").length;
  const nowColour = BANDS.find((b) => b.grade === c.grade_now)?.colour ?? "#2f8f00";
  const arc = `seal-arc-${useId().replace(/:/g, "")}`;
  return (
    <div className="certificate-sheet relative bg-white text-[#10201a]" style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
      {/* Frame */}
      <div className="absolute inset-[22px] rounded-[6px] border-[2.5px] border-[#0b3f2a]" />
      <div className="absolute inset-[30px] rounded-[4px] border border-[#c9a227]" />
      {[["left-[22px] top-[22px]", ""], ["right-[22px] top-[22px]", "rotate-90"], ["right-[22px] bottom-[22px]", "rotate-180"], ["left-[22px] bottom-[22px]", "-rotate-90"]].map(([pos, rot]) => (
        <svg key={pos} aria-hidden viewBox="0 0 60 60" className={`absolute h-[60px] w-[60px] ${pos} ${rot}`}>
          <path d="M2 34 V8 a6 6 0 0 1 6 -6 H34" fill="none" stroke="#c9a227" strokeWidth="2" />
          <path d="M12 26 V14 a2 2 0 0 1 2 -2 H26" fill="none" stroke="#0b3f2a" strokeWidth="1.6" />
          <circle cx="8" cy="8" r="3" fill="#c9a227" />
        </svg>
      ))}
      {/* Watermark */}
      <svg aria-hidden viewBox="0 0 200 200" className="absolute left-1/2 top-[52%] h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 opacity-[0.035]">
        <path d="M100 10 C40 40 20 110 60 170 C120 170 180 120 180 30 C150 20 120 15 100 10Z" fill="#0b3f2a" />
      </svg>

      <div className="relative flex h-full flex-col px-[64px] pb-[50px] pt-[54px] [&>*]:shrink-0">
        {/* Header */}
        <div className="flex items-start justify-between">
          <Image src="/logo.svg" alt="KlimateX" width={150} height={36} className="h-[34px] w-auto" />
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6b7872]">Certificate number</p>
            <p className="font-mono text-[13px] font-semibold">{c.certificate}</p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#9a7a12]">Metered, not modelled</p>
          <h1 className="mt-2 font-serif text-[38px] font-semibold leading-none tracking-[-0.01em] text-[#0b3f2a]">Home Energy Certificate</h1>
          <div className="mx-auto mt-3 flex w-[300px] items-center gap-3">
            <span className="h-px flex-1 bg-[#c9a227]" />
            <span className="h-2 w-2 rotate-45 bg-[#c9a227]" />
            <span className="h-px flex-1 bg-[#c9a227]" />
          </div>
          <p className="mx-auto mt-3 max-w-[560px] font-serif text-[15px] italic leading-relaxed text-[#41504a]">
            This certifies that the home below was measured from its own solar inverter and graded on the share of its power that still comes from a generator.
          </p>
        </div>

        {/* Home and grade */}
        <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-8 rounded-[14px] border border-[#e1e7e0] bg-[#fbfcfa] px-7 py-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[12.5px]">
            {[
              ["Household", home.householdName],
              ["Home", `${home.label} · ${homeCode(home.siteId)}`],
              ["Location", `${home.area}, Lagos, Nigeria`],
              ["Solar system", `${home.panelKwp} kWp · ${home.inverter.serial}`],
              ["Measured", `${longDate(home.daily[0]?.day ?? null)} to ${longDate(data.dataAsOf)}`],
              ["Generator", `${home.generator.kva} kVA, scrapped ${longDate(home.generator.scrappedOn)}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#6b7872]">{label}</dt>
                <dd className="mt-0.5 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col items-center">
            <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full" style={{ background: `conic-gradient(${nowColour} 0 100%)` }}>
              <div className="absolute inset-[6px] rounded-full border-2 border-white/70" />
              <span className="font-serif text-[58px] font-bold leading-none text-white">{c.grade_now}</span>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7872]">Grade now</p>
          </div>
        </div>

        {/* Band chart */}
        <div className="mt-5 grid grid-cols-[1fr_92px_92px_92px] gap-x-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7872]">Share of power from a generator</p>
          {["Before solar", "Now", "Potential"].map((h) => (
            <p key={h} className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7872]">{h}</p>
          ))}
          {BANDS.map((b, i) => (
            <div key={b.grade} className="contents">
              <div className="mt-1 flex h-[24px]">
                <span className="flex h-full items-center justify-between pl-3 pr-2 text-[13px] font-bold text-white" style={{ background: b.colour, width: `${44 + i * 8}%` }}>
                  {b.grade}
                  <span className="text-[10.5px] font-medium opacity-90">{b.range}</span>
                </span>
                <span className="h-0 w-0 border-y-[12px] border-l-[11px] border-y-transparent" style={{ borderLeftColor: b.colour }} />
              </div>
              {([
                [c.grade_before === b.grade, "before", `${Math.round(c.generator_share_before * 100)}%`],
                [c.grade_now === b.grade, "now", `${Math.round(c.generator_share_now * 100)}%`],
                [potential === b.grade, "potential", "battery"],
              ] as [boolean, "before" | "now" | "potential", string][]).map(([on, kind, share]) => (
                <div key={kind} className="mt-1 flex justify-center">
                  {on && <Pointer label={b.grade} share={share} align={kind} />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Figures */}
        <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-[12px] border border-[#e1e7e0]">
          {[
            ["Credited a year", <Co2Text key="t" text={`${c.credited_tco2e_per_year.toFixed(2)} tCO₂e`} />],
            ["Petrol avoided", `${c.petrol_litres_avoided_period.toLocaleString("en-NG")} L`],
            ["Trust score", `${c.trust_score} / 100`],
            ["Checks passed", `${passed} of ${c.checks.length}`],
          ].map(([label, value], i) => (
            <div key={String(label)} className={`px-4 py-3 text-center ${i ? "border-l border-[#e1e7e0]" : ""}`}>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-[#6b7872]">{label}</p>
              <p className="mt-1 text-[17px] font-semibold text-[#0b3f2a]">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7872]">Recommended next step</p>
            <p className="mt-1 text-[13.5px] font-medium">{c.potential}. Less generator time earns more credits, and the step can be financed with an Access solar loan.</p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7872]">Verification</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#41504a]">
              {c.checks.map((ch) => `${checkLabel(ch.name)} ${ch.result === "pass" ? "✓" : "✗"}`).join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-[96px] w-[96px] rounded-[8px] border border-[#e1e7e0] p-1.5" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[#6b7872]">Scan for details</p>
          </div>
        </div>

        {/* Seal and signatures */}
        <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-6">
          <div>
            <p className="font-serif text-[22px] italic text-[#0b3f2a]">KlimateX Operations</p>
            <div className="mt-1 h-px bg-[#10201a]/60" />
            <p className="mt-1.5 text-[10.5px] text-[#6b7872]">Issued {longDate(issued)} · valid to {longDate(validUntil)}</p>
          </div>
          <svg viewBox="0 0 120 120" className="h-[96px] w-[96px]" aria-label="KlimateX seal">
            <circle cx="60" cy="60" r="56" fill="#0b3f2a" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="#c9a227" strokeWidth="1.5" strokeDasharray="2 3" />
            <circle cx="60" cy="60" r="38" fill="none" stroke="#c9a227" strokeWidth="1" />
            <defs><path id={arc} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
            <text fill="#c9a227" fontSize="8" fontWeight="700"><textPath href={`#${arc}`} textLength="272" lengthAdjust="spacing">METERED • VERIFIED • KLIMATEX • LAGOS • </textPath></text>
            <text x="60" y="58" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700" fontFamily="Georgia, serif">{c.grade_now}</text>
            <text x="60" y="74" textAnchor="middle" fill="#c9a227" fontSize="7.5" fontWeight="700" letterSpacing="1.5">{issued?.slice(0, 4)}</text>
          </svg>
          <div className="text-right">
            <p className="font-serif text-[22px] italic text-[#0b3f2a]">Independent auditor</p>
            <div className="mt-1 h-px bg-[#10201a]/60" />
            <p className="mt-1.5 text-[10.5px] text-[#6b7872]">Sample review and period sign-off</p>
          </div>
        </div>
        <p className="mt-4 text-center text-[9px] leading-snug text-[#6b7872]">
          KlimateX scale (proposed), not an official rating. Grades follow the metered share of power from a generator. Carbon credited under Gold Standard JUST: Fossil Fuel Generators v1.0 methodology factors; credits are issued and retired by the carbon registry.
        </p>
      </div>
    </div>
  );
}

export function CertificateDocument({ c, data }: { c: Certificate; data: Dashboard }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const issued = data.dataAsOf;
  const validUntil = addYear(issued);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => {
      const style = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setScale(Math.min(1, inner / A4_WIDTH));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const text = `KlimateX Home Energy Certificate ${c.certificate}\n${data.home.label}, ${data.home.area}, Lagos\nGrade ${c.grade_now} (was ${c.grade_before})\nTrust score ${c.trust_score}/100\nIssued ${issued ?? ""}`;
    QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b3f2a", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [c, data.home, issued]);

  const mounted = useSyncExternalStore(noop, () => true, () => false);

  /** The browser names the saved PDF after the page title, so use the certificate number. */
  const download = () => {
    const title = document.title;
    document.title = `KlimateX certificate ${c.certificate}`;
    window.print();
    setTimeout(() => { document.title = title; }, 500);
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(c.certificate);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the number is still visible on the page.
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          body > *:not(.certificate-print) { display: none !important; }
          .certificate-print { display: block !important; width: 210mm; height: 297mm; overflow: hidden; }
          .certificate-print .certificate-sheet { width: 210mm !important; height: 297mm !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen { .certificate-print { display: none; } }
      `}</style>

      <div ref={frame} className="min-w-0 rounded-3xl bg-gradient-to-b from-[#e9efe7] to-[#dfe7dc] p-4 sm:p-8">
        <div className="mx-auto overflow-hidden rounded-[6px] shadow-[0_30px_80px_-20px_rgba(11,63,42,0.45)]" style={{ width: A4_WIDTH * scale, height: A4_HEIGHT * scale }}>
          <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
            <Sheet c={c} data={data} qr={qr} issued={issued} validUntil={validUntil} />
          </div>
        </div>
      </div>

      {mounted && createPortal(
        <div className="certificate-print">
          <Sheet c={c} data={data} qr={qr} issued={issued} validUntil={validUntil} />
        </div>,
        document.body,
      )}

      <aside className="space-y-4 print:hidden">
        <div className="rounded-3xl border border-line bg-white p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Your certificate</p>
          <p className="mt-1 font-mono text-[14px] font-semibold">{c.certificate}</p>
          <div className="mt-4 grid gap-2.5">
            <button type="button" onClick={download} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest text-[14px] font-semibold text-white hover:bg-forest-hover">
              <Download size={17} /> Download PDF
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line text-[13.5px] font-medium hover:bg-mint">
              <Printer size={16} /> Print
            </button>
            <button type="button" onClick={copyNumber} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line text-[13.5px] font-medium hover:bg-mint">
              {copied ? <><Check size={16} className="text-leaf" /> Copied</> : <><Copy size={16} /> Copy certificate number</>}
            </button>
          </div>
          <p className="mt-3 text-[12px] text-muted">In the print window, choose &ldquo;Save as PDF&rdquo;. The page is laid out for A4.</p>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck size={17} className="text-leaf" /> What makes it trustworthy</p>
          <ul className="mt-3 space-y-2.5 text-[13px] text-body">
            <li className="flex gap-2"><BadgeCheck size={15} className="mt-0.5 shrink-0 text-leaf" /> Built from {data.home.daily.length} days of inverter readings, not a one-day survey.</li>
            <li className="flex gap-2"><BadgeCheck size={15} className="mt-0.5 shrink-0 text-leaf" /> Every day checked against NASA sunlight for your street.</li>
            <li className="flex gap-2"><BadgeCheck size={15} className="mt-0.5 shrink-0 text-leaf" /> Generator scrapped with a recycler certificate ({data.home.generator.certificate ?? "pending"}).</li>
            <li className="flex gap-2"><BadgeCheck size={15} className="mt-0.5 shrink-0 text-leaf" /> Re-graded every month as new data arrives.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
