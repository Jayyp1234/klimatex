"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import {
  ArrowRight,
  ChevronDown,
  FileBadge,
  Headphones,
  KeyRound,
  Landmark,
  Rocket,
  Search,
  ShieldCheck,
  Sun,
  Wallet,
} from "lucide-react";
import { useHousehold } from "./HouseholdShell";

type Icon = ComponentType<{ size?: number; className?: string }>;
type Topic = "start" | "solar" | "payments" | "certificate" | "loan" | "account";

const TOPICS: { id: Topic; label: string; blurb: string; icon: Icon; tone: string }[] = [
  { id: "start", label: "Getting started", blurb: "How KlimateX turns clean power into money", icon: Rocket, tone: "bg-[#e8f3df] text-[#2f6b00]" },
  { id: "solar", label: "Solar and readings", blurb: "Daily readings, sunlight checks, offline days", icon: Sun, tone: "bg-[#fdf3d7] text-[#8a5a00]" },
  { id: "payments", label: "Payouts", blurb: "When you're paid, how much, and where", icon: Wallet, tone: "bg-mint text-forest" },
  { id: "certificate", label: "Certificate and grades", blurb: "What your A to G grade means", icon: FileBadge, tone: "bg-[#eef3f7] text-[#35546b]" },
  { id: "loan", label: "Solar loan", blurb: "Repayments from your carbon earnings", icon: Landmark, tone: "bg-[#f3eefb] text-[#5b3b8c]" },
  { id: "account", label: "Account and privacy", blurb: "Phone sign-in, PIN and your data", icon: KeyRound, tone: "bg-[#fbeeee] text-[#9b2c2c]" },
];

const FAQ: { topic: Topic; q: string; a: string }[] = [
  { topic: "start", q: "How does KlimateX earn money for my home?", a: "Before solar, your home burned petrol in a generator. Every kilowatt-hour your panels make instead avoids that petrol and the carbon it would have released. We measure it from your inverter, an independent auditor checks it, and the carbon registry issues credits. Companies buy those credits, and your share is paid to you." },
  { topic: "start", q: "Do I need to do anything each month?", a: "No. Keep your inverter switched on and connected. Readings arrive on their own, checks run every day, and you get a message when a report or payment is ready." },
  { topic: "start", q: "Why was my generator scrapped?", a: "A credit only counts if the old generator can never run again. Your installer handed it to a licensed recycler, who issued the certificate number shown on your profile. That proof is part of what buyers pay for." },
  { topic: "solar", q: "What are the daily checks?", a: "Every day we compare what your panels made with the sunlight NASA measured over your street, your own past days, and similar homes nearby. Readings that are impossible, flat, copied or missing are flagged before any tonne counts." },
  { topic: "solar", q: "My home shows “no data”. What should I do?", a: "Check that the inverter screen is on and its Wi-Fi light is lit, then wait a day. If it is still offline, open Contact Support and choose “System not working”. We'll ask your installer to visit." },
  { topic: "solar", q: "Why is a day marked “above what the sun allowed”?", a: "A panel can't make more than the sunlight that reached it. When a reading is higher, it is usually a meter fault, so that day is left out of your credits until it's explained. You are never charged for it." },
  { topic: "payments", q: "How much of each credit do I receive?", a: "You receive 50% of what every credit from your home sells for. The rest pays your installer, the auditor and KlimateX's running costs. Your payout screen shows each payment with the credit serials that paid for it." },
  { topic: "payments", q: "When am I paid?", a: "After each audited period is signed off and the credits are sold. The money is sent the same day and you get a notification with the amount and reference." },
  { topic: "payments", q: "Can I be paid into my own bank account?", a: "Yes. Open Settings, then Payment details, and add any Nigerian bank account in your name. The bank confirms the account name before it's saved. If you have a solar loan, payments go to the loan first." },
  { topic: "payments", q: "What does “held” mean?", a: "A period is held when a check failed and the auditor needs to look closer. Nothing is lost: once it's cleared, the credits are issued and you're paid. Open the alert and press “See why” for the plain-language reason." },
  { topic: "certificate", q: "What does my grade mean?", a: "Your grade shows how much of your home's power still comes from a generator: A is 0 to 2%, G is over 75%. It is measured from your own inverter over months, not guessed in a one-day survey." },
  { topic: "certificate", q: "How do I download my certificate?", a: "Open Certificate and press “Download PDF”. In the print window, choose “Save as PDF”. It is laid out for A4 paper and carries a QR code anyone can scan to check it." },
  { topic: "certificate", q: "How can I reach grade A?", a: "Your certificate lists the next step for your home, usually a small battery. Less generator time earns more credits, and the step can be financed with an Access solar loan." },
  { topic: "loan", q: "How do carbon payouts repay my loan?", a: "While your solar loan is open, every payout goes straight to Access Bank as a repayment. You'll see each one on the Loan page and in your notifications. When the loan is cleared, payouts go to your wallet or bank." },
  { topic: "loan", q: "Do I still pay my loan instalments?", a: "Yes. Carbon payouts reduce what you owe, but they don't replace your agreed instalments. For questions about your loan schedule, visit any Access Bank branch." },
  { topic: "account", q: "How do I sign in?", a: "With your phone number and your 4-digit PIN. The first time, or if you forget your PIN, we send a 6-digit code to prove the phone is yours." },
  { topic: "account", q: "Who can see my data?", a: "You, your installer, the auditor and KlimateX. The public carbon registry sees only a code for your home, never your name, phone or address. We read energy data only: no BVN or bank details leave your bank." },
  { topic: "account", q: "Can I download my readings?", a: "Yes. Open Settings, then Preferences, and use “Your data” to download your daily readings and payout history as spreadsheets." },
];

export function HelpCenter() {
  const { user } = useHousehold();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [open, setOpen] = useState<string | null>(FAQ[0].q);

  const q = query.trim().toLowerCase();
  const results = FAQ.filter((f) => (!topic || f.topic === topic) && (!q || `${f.q} ${f.a}`.toLowerCase().includes(q)));
  const label = topic ? TOPICS.find((t) => t.id === topic)!.label : q ? "Search results" : "Popular questions";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-forest px-6 py-10 text-white sm:px-10 sm:py-12">
        <svg aria-hidden viewBox="0 0 600 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full opacity-[0.14]">
          {Array.from({ length: 10 }, (_, i) => <circle key={i} cx="560" cy="40" r={40 + i * 34} fill="none" stroke="#c7f36b" strokeWidth="1.2" />)}
        </svg>
        <div className="relative max-w-[640px]">
          <p className="text-[13px] font-medium text-lime">Help Center</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">How can we help, {user.name.split(" ")[0]}?</h1>
          <p className="mt-2 text-[15px] text-white/75">Plain answers about your solar, payouts, certificate and loan.</p>
          <label className="relative mt-6 block">
            <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setTopic(null); }}
              placeholder="Search, for example “held” or “bank account”"
              className="h-13 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-[15px] text-ink shadow-xl outline-none ring-lime/60 focus:ring-4"
            />
          </label>
        </div>
      </section>

      {/* Topics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOPICS.map((t) => {
          const active = topic === t.id;
          const count = FAQ.filter((f) => f.topic === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => { setTopic(active ? null : t.id); setQuery(""); setOpen(null); }}
              className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-all ${active ? "border-forest ring-2 ring-forest/15" : "border-line hover:-translate-y-0.5 hover:shadow-md"}`}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.tone}`}><t.icon size={21} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{t.label}</span>
                <span className="block truncate text-[13px] text-body">{t.blurb}</span>
              </span>
              <span className="text-[12px] text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Questions */}
        <section className="rounded-3xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="text-[16px] font-semibold">{label}</h2>
            {(topic || q) && (
              <button type="button" onClick={() => { setTopic(null); setQuery(""); }} className="text-[13px] font-medium text-leaf hover:underline">Show all</button>
            )}
          </div>
          {results.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-[15px] font-semibold">No answers match “{query}”</p>
              <p className="mt-1 text-[13.5px] text-body">Try another word, or ask us directly.</p>
              <Link href="/app/household/support/" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white hover:bg-forest-hover">Contact Support <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <ul>
              {results.map((f) => {
                const expanded = open === f.q;
                return (
                  <li key={f.q} className="border-b border-line last:border-0">
                    <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : f.q)} className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-[#f9fbf8]">
                      <span className={`flex-1 text-[14.5px] ${expanded ? "font-semibold text-forest" : "font-medium"}`}>{f.q}</span>
                      <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && <p className="-mt-1 px-6 pb-5 text-[14px] leading-relaxed text-body">{f.a}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Side */}
        <aside className="space-y-4 xl:sticky xl:top-20">
          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="bg-mint px-5 py-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-white"><Headphones size={20} /></span>
              <p className="mt-3 text-[16px] font-semibold">Still need help?</p>
              <p className="mt-1 text-[13.5px] text-body">Send us a message. Your home and readings are attached, so you don&rsquo;t have to explain twice.</p>
            </div>
            <div className="p-4">
              <Link href="/app/household/support/" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[14px] font-semibold text-white hover:bg-forest-hover">Contact Support <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck size={17} className="text-leaf" /> Staying safe</p>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-body">
              <li>KlimateX will never ask for your PIN, BVN or card details.</li>
              <li>We never ask you to pay to receive a payout.</li>
              <li>Only open the inverter if your installer is with you.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
