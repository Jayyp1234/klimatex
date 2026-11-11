"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  Cpu,
  Fingerprint,
  Fuel,
  Landmark,
  Leaf,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Wallet,
  Zap,
} from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { api, signOut } from "@/lib/api";
import { checkLabel, homeCode, longDate } from "@/lib/household";
import { formatNaira, initialsOf } from "@/lib/marketplace";
import { formatPhone, realEmail } from "@/lib/payout";
import { useHousehold } from "./HouseholdShell";

const BASE = "/app/household/";

const GRADE_COLOUR: Record<string, string> = {
  A: "#14683f", B: "#2f8f00", C: "#86b82b", D: "#d6c22a", E: "#e3a600", F: "#e07a1f", G: "#c2410c",
};

type PayoutDetails = {
  method: "wallet" | "bank";
  wallet: { provider: string; phone: string | null } | null;
  bank: { bank_name: string; account_ending: string; account_name: string | null } | null;
  has_loan: boolean;
};

function Card({ title, icon: Icon, action, children, className = "" }: {
  title: string;
  icon: typeof Sun;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[15.5px] font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint text-forest"><Icon size={16} /></span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium uppercase tracking-[0.07em] text-muted">{label}</dt>
      <dd className={`mt-1 truncate text-[14.5px] font-medium text-ink ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
    </div>
  );
}

/** A ring that fills to the trust score. */
function ScoreRing({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "#2f8f00" : score >= 50 ? "#e3a600" : "#c2410c";
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2ec" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-semibold leading-none tracking-tight">{score}</span>
        <span className="mt-1 text-[11px] text-muted">out of 100</span>
      </div>
    </div>
  );
}

export function ProfileView() {
  const { user, data } = useHousehold();
  const { home, certificate: c, paidNaira } = data;
  const [payout, setPayout] = useState<PayoutDetails | null>(null);

  useEffect(() => {
    api<PayoutDetails>("/api/homes/mine/payout-details").then(setPayout).catch(() => setPayout(null));
  }, []);

  const since = home.daily[0]?.day ?? null;
  const generated = home.daily.reduce((s, d) => s + d.generated, 0);
  const litres = home.months.reduce((s, m) => s + m.litres, 0);
  const tonnes = home.months.reduce((s, m) => s + m.tonnes, 0);
  const grade = c?.grade_now ?? null;
  const checks = c?.checks ?? home.checks;
  const passed = checks.filter((ch) => ch.result === "pass").length;
  const offline = data.alerts.some((a) => a.kind === "no_data");

  const destination = home.loan
    ? { icon: Landmark, title: "Your Access solar loan", detail: `Loan ${home.loan} · every payout goes straight to repayments` }
    : payout?.method === "bank" && payout.bank
      ? { icon: Building2, title: `${payout.bank.bank_name} ···${payout.bank.account_ending}`, detail: payout.bank.account_name ?? "Name confirmed by your bank" }
      : { icon: Wallet, title: "Access wallet", detail: payout?.wallet?.phone ? `Linked to ${payout.wallet.phone}` : home.wallet ?? "Created at installation" };
  const DestinationIcon = destination.icon;

  const leave = async () => {
    await signOut();
    window.location.replace("/app/");
  };

  return (
    <div className="space-y-5">
      {/* Identity */}
      <section className="overflow-hidden rounded-3xl border border-line bg-white">
        <div className="relative h-36 overflow-hidden bg-forest sm:h-44">
          <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 200">
            <defs>
              <radialGradient id="pf-sun" cx="82%" cy="120%" r="70%">
                <stop offset="0" stopColor="#ffc629" stopOpacity="0.55" />
                <stop offset="0.45" stopColor="#86d92b" stopOpacity="0.18" />
                <stop offset="1" stopColor="#0b3f2a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="200" fill="url(#pf-sun)" />
            {Array.from({ length: 9 }, (_, i) => (
              <circle key={i} cx="660" cy="250" r={60 + i * 34} fill="none" stroke="#ffffff" strokeOpacity={0.07 - i * 0.006} strokeWidth="1.2" />
            ))}
            {Array.from({ length: 14 }, (_, i) => (
              <line key={i} x1="660" y1="250" x2={660 + Math.cos(Math.PI + (i * Math.PI) / 13) * 520} y2={250 + Math.sin(Math.PI + (i * Math.PI) / 13) * 520} stroke="#ffffff" strokeOpacity="0.035" strokeWidth="18" />
            ))}
          </svg>
          <div className="absolute right-5 top-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
              <BadgeCheck size={14} className="text-lime" /> Verified home
            </span>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-14 flex flex-wrap items-end gap-5">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#c6ef8f] via-lime to-[#3f9f12] text-[38px] font-semibold tracking-tight text-forest shadow-xl ring-[5px] ring-white">
                {initialsOf(user.name)}
              </div>
              {grade && (
                <span className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl text-[19px] font-bold text-white shadow-lg ring-4 ring-white" style={{ background: GRADE_COLOUR[grade] }} title={`Grade ${grade}`}>
                  {grade}
                </span>
              )}
            </div>
            <div className="w-full min-w-0 pb-1 sm:w-auto sm:flex-1">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">{user.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-body">
                <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-muted" /> {home.area}, Lagos</span>
                <span className="text-line">•</span>
                <span className="font-mono text-[13px]">{homeCode(home.siteId)}</span>
                {since && (<><span className="text-line">•</span><span>On solar since {longDate(since)}</span></>)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 pb-1">
              <Link href={`${BASE}certificate/`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white transition hover:bg-forest-hover">
                <BadgeCheck size={16} /> View certificate
              </Link>
              <Link href={`${BASE}settings/payments/`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13.5px] font-medium hover:bg-mint">
                <Wallet size={16} /> Payment details
              </Link>
              <Link href={`${BASE}settings/preferences/`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13.5px] font-medium hover:bg-mint">
                <SlidersHorizontal size={16} /> Preferences
              </Link>
            </div>
          </div>

          <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {[
              { icon: Leaf, label: "Carbon credited", value: <Co2Text text={`${tonnes.toFixed(2)} tCO₂e`} /> },
              { icon: Fuel, label: "Petrol avoided", value: `${Math.round(litres).toLocaleString("en-NG")} L` },
              { icon: Zap, label: "Solar generated", value: `${Math.round(generated).toLocaleString("en-NG")} kWh` },
              { icon: Wallet, label: "Paid to you", value: formatNaira(paidNaira) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white px-5 py-4">
                <dt className="flex items-center gap-2 text-[12.5px] text-body"><Icon size={14} className="text-leaf" /> {label}</dt>
                <dd className="mt-1.5 text-[21px] font-semibold tracking-tight">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Home and system */}
        <section className="overflow-hidden rounded-3xl border border-line bg-white">
          <div className="relative h-44 sm:h-52">
            <Image src="/images/hero-home.webp" alt="" fill sizes="(min-width: 1280px) 760px, 100vw" className="object-cover object-[60%_40%]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3 text-white">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/75">Your home</p>
                <p className="text-[22px] font-semibold tracking-tight">{home.label} · {home.area}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold backdrop-blur ${offline ? "bg-red-600/85" : "bg-white/15"}`}>
                <span className={`h-2 w-2 rounded-full ${offline ? "bg-white" : "animate-pulse bg-lime"}`} /> {offline ? "Inverter offline" : "Reporting live"}
              </span>
            </div>
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Solar array" value={`${home.panelKwp} kWp`} />
              <Field label="Grid supply" value={`${home.gridHours} h a day`} />
              <Field label="Home code" value={homeCode(home.siteId)} mono />
              <Field label="Area" value={`${home.area}, Lagos`} />
            </dl>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6dc] text-[#9a6b00]"><Cpu size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold">Inverter</p>
                  <p className="truncate font-mono text-[12px] text-body">{home.inverter.serial} · {home.inverter.vendor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-forest"><BadgeCheck size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold">Old generator scrapped</p>
                  <p className="truncate text-[12px] text-body">{home.generator.kva} kVA · {longDate(home.generator.scrappedOn)} · {home.generator.certificate ?? "certificate pending"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <Card title="Account" icon={Fingerprint}>
            <dl className="space-y-4">
              <div className="flex items-center gap-3"><Phone size={16} className="text-muted" /><Field label="Phone" value={formatPhone(user.phone ?? payout?.wallet?.phone ?? null) || "Not added"} /></div>
              <div className="flex items-center gap-3"><Mail size={16} className="text-muted" /><Field label="Email" value={(user.email && realEmail(user.email)) || "Not added"} /></div>
              <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-muted" /><Field label="Signs in with" value={user.phone ? "Phone number and 4-digit PIN" : "Email and password"} /></div>
            </dl>
          </Card>

          <Card title="Your payouts go to" icon={Wallet} action={!home.loan && <Link href={`${BASE}settings/payments/`} className="text-[13px] font-medium text-leaf hover:underline">Change</Link>}>
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-forest to-[#14683f] p-4 text-white">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/12"><DestinationIcon size={22} /></span>
              <div className="min-w-0">
                <p className="truncate text-[15.5px] font-semibold">{destination.title}</p>
                <p className="text-[12.5px] leading-snug text-white/75">{destination.detail}</p>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] text-body">You receive 50% of every credit your home helps sell, paid after each audit.</p>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Trust score" icon={ShieldCheck} className="lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ScoreRing score={c?.trust_score ?? home.score ?? 0} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-body"><strong className="text-ink">{passed} of {checks.length} checks passed.</strong> Every day your inverter reports is checked against the sun, your neighbours and your own history before a tonne counts.</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {checks.map((ch) => (
                  <li key={ch.name} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${ch.result === "pass" ? "bg-[#e4f3d5] text-[#27500a]" : "bg-[#faeeda] text-[#633806]"}`}>
                    {ch.result === "pass" ? "✓" : "!"} {checkLabel(ch.name)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card title="Privacy and consent" icon={Leaf}>
          <ul className="space-y-3 text-[13.5px] text-body">
            <li className="flex gap-2.5"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-leaf" /> <span>You signed consent for KlimateX to sell your carbon savings.</span></li>
            <li className="flex gap-2.5"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-leaf" /> <span>The public registry shows your home only as <span className="whitespace-nowrap font-mono text-[12px]">home-{String(home.siteId).padStart(3, "0")}</span>, never your name.</span></li>
            <li className="flex gap-2.5"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-leaf" /> <span>We read energy data only: no BVN or bank details leave your bank.</span></li>
          </ul>
          <button type="button" onClick={leave} className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-[13px] font-medium text-red-700 hover:bg-red-50">
            <LogOut size={15} /> Sign out of this device
          </button>
        </Card>
      </div>
    </div>
  );
}
