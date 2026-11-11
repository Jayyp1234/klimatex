"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CheckCheck,
  FileBadge,
  Inbox,
  Mail,
  MailOpen,
  PauseCircle,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { destinationLabel, longDate, monthLabel, type Alert, type Dashboard, type Month, type Payout } from "@/lib/household";
import { useHousehold } from "./HouseholdShell";
import { PageHeader } from "./ui";

type Icon = ComponentType<{ size?: number; className?: string }>;
type Category = "action" | "payments" | "reports" | "system";

type Note = {
  id: string;
  category: Category;
  severity: "critical" | "warning" | "info" | "good";
  at: string | null;
  title: string;
  body: string;
  icon: Icon;
  alert?: Alert;
  payout?: Payout;
  month?: Month;
  kind: "alert" | "payout" | "month" | "certificate" | "grade" | "welcome";
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const TONE: Record<Note["severity"], string> = {
  critical: "bg-red-50 text-red-700 ring-red-100",
  warning: "bg-[#fdf3d7] text-[#8a5a00] ring-[#f6e3ae]",
  info: "bg-[#eef3f7] text-[#35546b] ring-[#dde7ef]",
  good: "bg-mint text-forest ring-[#d3e8d6]",
};

const TABS: { id: "all" | "unread" | Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action", label: "Needs action" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "system", label: "System" },
];

const ALERT_ICON: Record<Alert["kind"], Icon> = { payout: CalendarCheck, low_output: TriangleAlert, no_data: WifiOff, held: PauseCircle };

/** Everything worth telling a family, newest first: live alerts from the API plus events read from their own data. */
function buildNotes(data: Dashboard, alerts: Alert[]): Note[] {
  const { home, certificate: c, payouts } = data;
  // A payout alert repeats a payment that already has its own, richer notification.
  const notes: Note[] = alerts.filter((a) => !(a.kind === "payout" && payouts.length > 0)).map((a) => ({
    id: `alert:${a.id}`,
    kind: "alert",
    category: a.kind === "payout" ? "payments" : "action",
    severity: a.severity,
    at: a.at,
    title: a.title,
    body: a.body,
    icon: ALERT_ICON[a.kind],
    alert: a,
  }));

  for (const p of payouts) {
    const paid = p.status === "paid" || p.status === "completed" || p.status === "success";
    notes.push({
      id: `payout:${p.id}`,
      kind: "payout",
      category: "payments",
      severity: paid ? "good" : "info",
      at: p.paidOn ?? p.period?.end ?? null,
      title: paid ? `${naira(p.amountNaira)} ${{ solar_loan: "paid into your solar loan", bank: "sent to your bank account", wallet: "sent to your wallet" }[p.destination]}` : `${naira(p.amountNaira)} payout on its way`,
      body: `Your share of ${p.tonnes.toFixed(2)} tonnes of carbon credits sold from your home${p.period ? ` for ${longDate(p.period.start)} to ${longDate(p.period.end)}` : ""}.`,
      icon: Wallet,
      payout: p,
    });
  }

  for (const m of home.months) {
    notes.push({
      id: `month:${m.month}`,
      kind: "month",
      category: "reports",
      severity: "info",
      at: `${m.month.slice(0, 7)}-28`,
      title: `${monthLabel(m.month)} energy report is ready`,
      body: `Your panels made ${Math.round(m.solarKwh).toLocaleString("en-NG")} kWh and saved about ${Math.round(m.litres).toLocaleString("en-NG")} litres of petrol.`,
      icon: TrendingUp,
      month: m,
    });
  }

  if (c) {
    notes.push({
      id: `certificate:${c.certificate}`,
      kind: "certificate",
      category: "system",
      severity: "good",
      at: data.dataAsOf,
      title: `Your Home Energy Certificate is ready: grade ${c.grade_now}`,
      body: `Certificate ${c.certificate} is measured from your own inverter. Download it as a PDF any time.`,
      icon: FileBadge,
    });
    if (c.grade_before !== c.grade_now) {
      notes.push({
        id: `grade:${c.grade_before}-${c.grade_now}`,
        kind: "grade",
        category: "system",
        severity: "good",
        at: data.dataAsOf,
        title: `Your home moved from grade ${c.grade_before} to ${c.grade_now}`,
        body: `Generator power fell from ${Math.round(c.generator_share_before * 100)}% to ${Math.round(c.generator_share_now * 100)}% of what your home uses.`,
        icon: Sparkles,
      });
    }
  }

  const first = home.daily[0]?.day ?? home.generator.scrappedOn;
  notes.push({
    id: "welcome",
    kind: "welcome",
    category: "system",
    severity: "good",
    at: first,
    title: "Welcome to KlimateX",
    body: `Your solar system is connected and your ${home.generator.kva} kVA generator was scrapped. From today, every clean kilowatt-hour counts.`,
    icon: BellRing,
  });

  return notes.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

function groupLabel(at: string | null) {
  if (!at) return "Earlier";
  const d = new Date(`${at.slice(0, 10)}T00:00:00`);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days < 7) return "This week";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function readKey(userId: number) {
  return `klimatex.notifications.read.${userId}`;
}

function loadRead(userId: number): string[] {
  try {
    return JSON.parse(localStorage.getItem(readKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function NotificationsView() {
  const { user, data, alerts, dismiss, restoreAlerts, dismissedCount, openHeld, openPayout } = useHousehold();
  const notes = useMemo(() => buildNotes(data, alerts), [data, alerts]);
  const [read, setRead] = useState<string[]>(() => loadRead(user.id));
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);

  const save = (next: string[]) => {
    setRead(next);
    try {
      localStorage.setItem(readKey(user.id), JSON.stringify(next));
    } catch {
      // Storage can be blocked; read state then lasts only for this visit.
    }
  };
  const isUnread = (n: Note) => !read.includes(n.id);
  const markRead = (id: string) => !read.includes(id) && save([...read, id]);
  const markUnread = (id: string) => save(read.filter((r) => r !== id));
  const markAll = () => save(Array.from(new Set([...read, ...notes.map((n) => n.id)])));

  const counts = {
    all: notes.length,
    unread: notes.filter(isUnread).length,
    action: notes.filter((n) => n.category === "action").length,
    payments: notes.filter((n) => n.category === "payments").length,
    reports: notes.filter((n) => n.category === "reports").length,
    system: notes.filter((n) => n.category === "system").length,
  };

  const q = query.trim().toLowerCase();
  const visible = notes.filter(
    (n) =>
      (tab === "all" || (tab === "unread" ? isUnread(n) : n.category === tab)) &&
      (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)),
  );
  const groups = visible.reduce<{ label: string; items: Note[] }[]>((acc, n) => {
    const label = groupLabel(n.at);
    const last = acc[acc.length - 1];
    if (last?.label === label) last.items.push(n);
    else acc.push({ label, items: [n] });
    return acc;
  }, []);

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const paidTotal = data.payouts.reduce((s, p) => s + p.amountNaira, 0);

  const [sheet, setSheet] = useState(false);
  const open = (n: Note) => {
    setSelectedId(n.id);
    markRead(n.id);
    setSheet(true);
  };

  const detail = selected ? (
    <Detail
      note={selected}
      data={data}
      unread={isUnread(selected)}
      onToggleRead={() => (isUnread(selected) ? markRead(selected.id) : markUnread(selected.id))}
      onDismiss={selected.alert ? () => { dismiss(selected.alert!.id); setSelectedId(null); setSheet(false); } : undefined}
      onHeld={() => { setSheet(false); openHeld(); }}
      onPayout={(p) => { setSheet(false); openPayout(p); }}
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`Alerts, payments and reports for ${data.home.label}. Latest reading ${longDate(data.dataAsOf)}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {dismissedCount > 0 && (
              <button type="button" onClick={restoreAlerts} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[13px] font-medium hover:bg-mint">
                <RotateCcw size={15} /> Restore {dismissedCount} dismissed
              </button>
            )}
            <button type="button" onClick={markAll} disabled={counts.unread === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-forest px-3.5 text-[13px] font-medium text-white hover:bg-forest-hover disabled:opacity-50">
              <CheckCheck size={15} /> Mark all as read
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Unread", value: String(counts.unread), icon: Mail, tone: "bg-forest text-white" },
          { label: "Needs your action", value: String(counts.action), icon: TriangleAlert, tone: counts.action ? "bg-[#fdf3d7] text-[#8a5a00]" : "bg-mint text-forest" },
          { label: "Payments received", value: naira(paidTotal), icon: Wallet, tone: "bg-mint text-forest" },
          { label: "Reports ready", value: String(counts.reports), icon: TrendingUp, tone: "bg-[#eef3f7] text-[#35546b]" },
        ].map(({ label, value, icon: I, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><I size={18} /></span>
            <div className="min-w-0">
              <p className="truncate text-[12px] text-muted">{label}</p>
              <p className="truncate text-[18px] font-semibold tracking-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Inbox */}
        <section className="overflow-hidden rounded-3xl border border-line bg-white">
          <div className="border-b border-line p-4">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Filter notifications">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    tab === t.id ? "bg-forest text-white" : "bg-[#f3f6f2] text-body hover:bg-mint"
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? "bg-white/20" : "bg-white text-muted"}`}>{counts[t.id]}</span>
                </button>
              ))}
            </div>
            <label className="relative mt-3 block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notifications"
                className="h-10 w-full rounded-xl border border-line bg-[#fafbf9] pl-9 pr-3 text-[14px] outline-none focus:border-leaf focus:bg-white"
              />
            </label>
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-forest"><Inbox size={26} /></span>
              <p className="mt-4 text-[15px] font-semibold">You&rsquo;re all caught up</p>
              <p className="mt-1 max-w-[300px] text-[13.5px] text-body">Nothing here{q ? ` matches “${query}”` : ""}. We&rsquo;ll let you know when something changes.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <p className="sticky top-0 z-[1] border-b border-line bg-[#fafbf9]/95 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted backdrop-blur">{g.label}</p>
                <ul>
                  {g.items.map((n) => {
                    const I = n.icon;
                    const unread = isUnread(n);
                    const active = selected?.id === n.id;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => open(n)}
                          className={`group flex w-full items-start gap-3.5 border-b border-line px-5 py-4 text-left transition-colors last:border-b-0 ${
                            active ? "bg-mint/70" : "hover:bg-[#f7faf6]"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${TONE[n.severity]}`}><I size={18} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span className={`min-w-0 flex-1 text-[14px] leading-snug ${unread ? "font-semibold text-ink" : "font-medium text-body"}`}>{n.title}</span>
                              <span className="shrink-0 pt-0.5 text-[11.5px] text-muted">{longDate(n.at)}</span>
                            </span>
                            <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-body">{n.body}</span>
                          </span>
                          <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-leaf" : "bg-transparent"}`} aria-label={unread ? "Unread" : undefined} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Detail: beside the list on wide screens, a bottom sheet on phones */}
        <aside className="hidden xl:sticky xl:top-20 xl:block">
          {detail ?? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white px-6 py-14 text-center">
              <MailOpen size={28} className="text-muted" />
              <p className="mt-3 text-[14px] font-medium">Select a notification</p>
              <p className="mt-1 text-[13px] text-body">Its details and what you can do next appear here.</p>
            </div>
          )}
        </aside>
      </div>

      {sheet && detail && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={selected?.title}>
          <button type="button" aria-label="Close" onClick={() => setSheet(false)} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-[1] flex justify-center bg-forest pb-1 pt-2.5"><span className="h-1 w-10 rounded-full bg-white/40" /></div>
            <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="absolute right-3 top-4 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"><X size={16} /></button>
            <div className="[&>article]:rounded-none [&>article]:border-0">{detail}</div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f6f8f5] px-3.5 py-3">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Detail({
  note,
  data,
  unread,
  onToggleRead,
  onDismiss,
  onHeld,
  onPayout,
}: {
  note: Note;
  data: Dashboard;
  unread: boolean;
  onToggleRead: () => void;
  onDismiss?: () => void;
  onHeld: () => void;
  onPayout: (p: Payout) => void;
}) {
  const I = note.icon;
  const c = data.certificate;
  const last7 = data.home.daily.slice(-14);
  const peak = Math.max(1, ...last7.map((d) => Math.max(d.generated, d.ceiling ?? 0)));
  const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white hover:bg-forest-hover";

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="relative overflow-hidden bg-forest px-6 pb-6 pt-5 text-white">
        <svg aria-hidden viewBox="0 0 400 160" className="absolute inset-0 h-full w-full opacity-[0.12]">
          {Array.from({ length: 9 }, (_, i) => <circle key={i} cx="360" cy="10" r={30 + i * 26} fill="none" stroke="#c7f36b" strokeWidth="1" />)}
        </svg>
        <div className="relative flex items-center justify-between">
          <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-medium capitalize text-white/85">
            {note.category === "action" ? "Needs action" : note.category}
          </span>
          <span className="text-[12px] text-white/70">{longDate(note.at)}</span>
        </div>
        <span className="relative mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-forest"><I size={22} /></span>
        <h2 className="relative mt-3 text-[19px] font-semibold leading-snug tracking-tight">{note.title}</h2>
      </div>

      <div className="space-y-5 p-6">
        <p className="text-[14px] leading-relaxed text-body">{note.body}</p>

        {note.payout && (
          <>
            <div className="rounded-2xl border border-line p-4">
              <p className="text-[12px] text-muted">Amount</p>
              <p className="text-[28px] font-semibold tracking-tight text-forest">{naira(note.payout.amountNaira)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Stat label="Paid into" value={destinationLabel(note.payout.destination)} />
                <Stat label="Credits" value={<Co2Text text={`${note.payout.tonnes.toFixed(2)} tCO₂e`} />} />
                <Stat label="Serials" value={note.payout.serials.length} />
                <Stat label="Status" value={<span className="capitalize">{note.payout.status}</span>} />
              </div>
              <p className="mt-3 truncate font-mono text-[11.5px] text-muted">Ref {note.payout.reference}</p>
            </div>
            <button type="button" onClick={() => onPayout(note.payout!)} className={`${primary} w-full`}>View receipt <ArrowRight size={16} /></button>
          </>
        )}

        {note.month && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Solar generated" value={`${Math.round(note.month.solarKwh).toLocaleString("en-NG")} kWh`} />
              <Stat label="Petrol avoided" value={`${Math.round(note.month.litres).toLocaleString("en-NG")} L`} />
              <Stat label="Carbon credited" value={<Co2Text text={`${note.month.tonnes.toFixed(3)} tCO₂e`} />} />
              <Stat label="Sunlight limit" value={`${Math.round(note.month.capKwh).toLocaleString("en-NG")} kWh`} />
            </div>
            <Link href="/app/household/energy/monthly/" className={`${primary} w-full`}>Open monthly summary <ArrowRight size={16} /></Link>
          </>
        )}

        {note.alert && (note.alert.kind === "low_output" || note.alert.kind === "no_data") && (
          <>
            <div className="rounded-2xl border border-line p-4">
              <p className="text-[12px] font-medium text-muted">Last 14 days of solar</p>
              <div className="mt-3 flex h-24 items-end gap-1">
                {last7.map((d) => (
                  <span key={d.day} title={`${longDate(d.day)}: ${d.generated.toFixed(1)} kWh`} className="relative flex-1 rounded-t-[3px] bg-[#e7efe5]" style={{ height: `${((d.ceiling ?? d.generated) / peak) * 100}%` }}>
                    <span className={`absolute inset-x-0 bottom-0 rounded-t-[3px] ${d.generated === 0 ? "bg-red-400" : "bg-leaf"}`} style={{ height: `${(d.generated / Math.max(d.ceiling ?? d.generated, 0.01)) * 100}%` }} />
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-muted">Green is what your panels made; the pale bar is what the sun allowed.</p>
            </div>
            <ul className="space-y-2 text-[13px] text-body">
              <li>1. Check the inverter screen is on and the Wi-Fi light is lit.</li>
              <li>2. Wipe dust off the panels if you can reach them safely.</li>
              <li>3. Still off tomorrow? Contact support and we&rsquo;ll send your installer.</li>
            </ul>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/app/household/energy/readings/" className={primary}>Readings</Link>
              <Link href="/app/household/support/" className="inline-flex h-10 items-center justify-center rounded-xl border border-line text-[13.5px] font-medium hover:bg-mint">Get help</Link>
            </div>
          </>
        )}

        {note.alert?.kind === "held" && (
          <button type="button" onClick={onHeld} className={`${primary} w-full`}>See why it was held <ArrowRight size={16} /></button>
        )}
        {note.alert?.kind === "payout" && (
          <Link href="/app/household/payouts/" className={`${primary} w-full`}>Open payouts <ArrowRight size={16} /></Link>
        )}

        {(note.kind === "certificate" || note.kind === "grade") && c && (
          <>
            <div className="flex items-center justify-center gap-4 rounded-2xl bg-[#f6f8f5] py-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e07a1f] font-serif text-[28px] font-bold text-white">{c.grade_before}</span>
              <ArrowRight size={22} className="text-muted" />
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2f8f00] font-serif text-[34px] font-bold text-white ring-4 ring-mint">{c.grade_now}</span>
            </div>
            <Link href="/app/household/certificate/" className={`${primary} w-full`}>View certificate <ArrowRight size={16} /></Link>
          </>
        )}

        {note.kind === "welcome" && (
          <Link href="/app/household/help/" className={`${primary} w-full`}>How KlimateX works <ArrowRight size={16} /></Link>
        )}

        <div className="flex gap-2 border-t border-line pt-4">
          <button type="button" onClick={onToggleRead} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-line text-[13px] font-medium hover:bg-mint">
            {unread ? <><MailOpen size={15} /> Mark as read</> : <><Mail size={15} /> Mark as unread</>}
          </button>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-line text-[13px] font-medium hover:bg-mint">
              <X size={15} /> Dismiss
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
