"use client";

import { useState, type ComponentType } from "react";
import {
  BellRing,
  Check,
  Download,
  FileBadge,
  Globe,
  Landmark,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Moon,
  PauseCircle,
  Smartphone,
  TrendingUp,
  Wallet,
  WifiOff,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { downloadCsv, fetchMessage, LANGUAGES } from "@/lib/household";
import { formatPhone, realEmail } from "@/lib/payout";
import { useHousehold } from "./HouseholdShell";
import { PageHeader } from "./ui";

type Icon = ComponentType<{ size?: number; className?: string }>;
type Channel = "app" | "sms" | "email";
type Topic = "payments" | "held" | "system" | "reports" | "certificate" | "loan";

const TOPICS: { id: Topic; label: string; hint: string; icon: Icon; locked?: boolean }[] = [
  { id: "payments", label: "Payments", hint: "Money paid to your loan, wallet or bank", icon: Wallet },
  { id: "held", label: "Held periods", hint: "When a month is paused and why", icon: PauseCircle, locked: true },
  { id: "system", label: "System offline or low", hint: "Your inverter stops reporting or makes too little", icon: WifiOff, locked: true },
  { id: "reports", label: "Monthly report", hint: "Energy made, petrol saved and credits earned", icon: TrendingUp },
  { id: "certificate", label: "Certificate and grade", hint: "A new certificate or a change of grade", icon: FileBadge },
  { id: "loan", label: "Solar loan", hint: "Repayments and balance updates from Access Bank", icon: Landmark },
];

const CHANNELS: { id: Channel; label: string; icon: Icon }[] = [
  { id: "app", label: "In the app", icon: BellRing },
  { id: "sms", label: "SMS", icon: Smartphone },
  { id: "email", label: "Email", icon: Mail },
];

const NATIVE: Record<string, { name: string; hello: string }> = {
  en: { name: "English", hello: "Good morning" },
  pcm: { name: "Naijá", hello: "Good morning o" },
  yo: { name: "Yorùbá", hello: "Ẹ káàárọ̀" },
  ig: { name: "Igbo", hello: "Ụtụtụ ọma" },
  ha: { name: "Hausa", hello: "Ina kwana" },
};

type Prefs = {
  matrix: Record<Topic, Record<Channel, boolean>>;
  quiet: { on: boolean; from: string; to: string };
  detail: "short" | "full";
};

const DEFAULTS: Prefs = {
  matrix: {
    payments: { app: true, sms: true, email: true },
    held: { app: true, sms: true, email: false },
    system: { app: true, sms: true, email: false },
    reports: { app: true, sms: false, email: true },
    certificate: { app: true, sms: false, email: true },
    loan: { app: true, sms: false, email: false },
  },
  quiet: { on: true, from: "21:00", to: "07:00" },
  detail: "short",
};

const key = (userId: number) => `klimatex.preferences.${userId}`;

function load(userId: number): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId)) ?? "null");
    return saved ? { ...DEFAULTS, ...saved, matrix: { ...DEFAULTS.matrix, ...saved.matrix } } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${on ? "bg-leaf" : "bg-[#d9e0d7]"} ${disabled ? "opacity-60" : ""}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function Section({ title, description, icon: I, children, aside }: { title: string; description: string; icon: Icon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div className="flex gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-forest"><I size={19} /></span>
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-[13.5px] text-body">{description}</p>
          </div>
        </div>
        {aside}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function PreferencesView() {
  const { user, data, lang, setLang } = useHousehold();
  const [prefs, setPrefs] = useState<Prefs>(() => load(user.id));
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(key(user.id), JSON.stringify(next));
    } catch {
      // Blocked storage: the choice lasts for this visit only.
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const setCell = (topic: Topic, channel: Channel, value: boolean) =>
    update({ ...prefs, matrix: { ...prefs.matrix, [topic]: { ...prefs.matrix[topic], [channel]: value } } });

  const loadPreview = async (code = lang) => {
    setBusy(true);
    setError("");
    try {
      setPreview(await fetchMessage(data.home.siteId, code));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The message couldn't be loaded.");
    }
    setBusy(false);
  };

  const phone = user.phone ? formatPhone(user.phone) : "your registered phone";
  const exportReadings = () =>
    downloadCsv(
      `klimatex-${data.home.label.toLowerCase().replace(/\s+/g, "-")}-readings.csv`,
      ["day", "solar_kwh", "used_kwh", "grid_kwh", "backup_kwh", "sunlight_limit_kwh"],
      data.home.daily.map((d) => [d.day, d.generated, d.toLoad, d.grid, d.backup, d.ceiling ?? ""]),
    );
  const exportPayouts = () =>
    downloadCsv(
      `klimatex-${data.home.label.toLowerCase().replace(/\s+/g, "-")}-payouts.csv`,
      ["reference", "paid_on", "amount_naira", "destination", "tonnes", "status"],
      data.payouts.map((p) => [p.reference, p.paidOn ?? "", p.amountNaira, p.destination, p.tonnes, p.status]),
    );

  return (
    <>
      <PageHeader
        title="Preferences"
        description="Choose your language and how KlimateX keeps you posted."
        actions={
          <span className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-opacity ${saved ? "bg-mint text-forest opacity-100" : "opacity-0"}`} aria-live="polite">
            <Check size={15} /> Saved
          </span>
        }
      />

      <div className="space-y-5">
        <Section title="Language" description="Your monthly summary, alerts and held-period explanations are written in this language." icon={Globe}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {LANGUAGES.map((l) => {
              const active = lang === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { setLang(l.code); setPreview(null); }}
                  aria-pressed={active}
                  className={`relative rounded-2xl border p-4 text-left transition-all ${active ? "border-forest bg-mint/60 ring-2 ring-forest/15" : "border-line hover:border-leaf/50 hover:bg-[#f7faf6]"}`}
                >
                  {active && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-forest text-white"><Check size={12} /></span>}
                  <p className="text-[15px] font-semibold">{NATIVE[l.code]?.name ?? l.label}</p>
                  <p className="text-[12px] text-muted">{l.label}</p>
                  <p className="mt-3 text-[13px] italic text-body">&ldquo;{NATIVE[l.code]?.hello ?? "Hello"}, {user.name.split(" ")[0]}&rdquo;</p>
                </button>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl bg-[#f6f8f5] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[13.5px] font-medium"><MessageSquareText size={16} className="text-leaf" /> This month&rsquo;s message, as you&rsquo;ll receive it</p>
              <button type="button" onClick={() => loadPreview()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[13px] font-medium hover:bg-mint disabled:opacity-60">
                {busy && <LoaderCircle size={15} className="animate-spin" />} {preview ? "Refresh preview" : "Show preview"}
              </button>
            </div>
            {preview && (
              <div className="mt-3 max-w-[560px] rounded-2xl rounded-tl-md bg-white p-4 text-[14px] leading-relaxed shadow-sm ring-1 ring-line">{preview}</div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
        </Section>

        <Section title="What we tell you, and where" description="Safety alerts always reach you in the app. Everything else is your choice." icon={BellRing}>
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="pb-3 font-medium">Topic</th>
                  {CHANNELS.map((ch) => (
                    <th key={ch.id} className="w-[110px] pb-3 text-center font-medium">
                      <span className="inline-flex items-center gap-1.5"><ch.icon size={14} /> {ch.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOPICS.map((t) => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f6f2] text-forest"><t.icon size={16} /></span>
                        <div>
                          <p className="text-[14px] font-medium">{t.label}</p>
                          <p className="text-[12.5px] text-muted">{t.hint}</p>
                        </div>
                      </div>
                    </td>
                    {CHANNELS.map((ch) => {
                      const locked = t.locked && ch.id === "app";
                      return (
                        <td key={ch.id} className="text-center">
                          <Toggle
                            on={locked || prefs.matrix[t.id][ch.id]}
                            disabled={locked}
                            label={`${t.label} by ${ch.label}`}
                            onChange={(v) => setCell(t.id, ch.id, v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { icon: BellRing, title: "In the app", body: "Shown in Notifications and on your dashboard." },
              { icon: Smartphone, title: "SMS", body: `Texts go to ${phone}. Standard texts, no data needed.` },
              { icon: Mail, title: "Email", body: user.email && realEmail(user.email) ? `Sent to ${user.email}.` : "Add an email at your next installer visit." },
            ].map((c) => (
              <div key={c.title} className="flex gap-3 rounded-2xl border border-line p-3.5">
                <c.icon size={16} className="mt-0.5 shrink-0 text-leaf" />
                <div>
                  <p className="text-[13px] font-medium">{c.title}</p>
                  <p className="text-[12.5px] text-body">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section
            title="Quiet hours"
            description="No texts at night. Urgent alerts wait until morning."
            icon={Moon}
            aside={<Toggle on={prefs.quiet.on} label="Quiet hours" onChange={(v) => update({ ...prefs, quiet: { ...prefs.quiet, on: v } })} />}
          >
            <div className={`grid grid-cols-2 gap-3 transition-opacity ${prefs.quiet.on ? "" : "pointer-events-none opacity-50"}`}>
              {(["from", "to"] as const).map((edge) => (
                <label key={edge} className="block">
                  <span className="text-[12.5px] text-muted">{edge === "from" ? "From" : "Until"}</span>
                  <input
                    type="time"
                    value={prefs.quiet[edge]}
                    onChange={(e) => update({ ...prefs, quiet: { ...prefs.quiet, [edge]: e.target.value } })}
                    className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-[15px] font-medium outline-none focus:border-leaf"
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title="Monthly report style" description="How much detail your monthly message carries." icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["short", "Short", "Energy made and money earned, in two lines."],
                ["full", "Detailed", "Adds petrol saved, credits and your grade."],
              ] as const).map(([id, label, body]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={prefs.detail === id}
                  onClick={() => update({ ...prefs, detail: id })}
                  className={`rounded-2xl border p-4 text-left transition-all ${prefs.detail === id ? "border-forest bg-mint/60 ring-2 ring-forest/15" : "border-line hover:bg-[#f7faf6]"}`}
                >
                  <p className="text-[14px] font-semibold">{label}</p>
                  <p className="mt-1 text-[12.5px] text-body">{body}</p>
                </button>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Your data" description="Everything we measure from your home is yours. Download it any time." icon={Download}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "Daily solar readings", body: `${data.home.daily.length} days from your inverter, as a spreadsheet`, onClick: exportReadings },
              { title: "Payout history", body: `${data.payouts.length} payment${data.payouts.length === 1 ? "" : "s"} with references`, onClick: exportPayouts },
            ].map((d) => (
              <button key={d.title} type="button" onClick={d.onClick} className="group flex items-center gap-3.5 rounded-2xl border border-line p-4 text-left hover:border-leaf/50 hover:bg-[#f7faf6]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-white"><Download size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{d.title}</span>
                  <span className="block text-[12.5px] text-muted">{d.body}</span>
                </span>
                <span className="text-[12px] font-medium text-leaf group-hover:underline">CSV</span>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
