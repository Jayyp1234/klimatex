"use client";

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BadgeCheck,
  BatteryCharging,
  CalendarDays,
  Check,
  CircleSlash,
  ClipboardCheck,
  Clock,
  Coins,
  Fuel,
  Hammer,
  Handshake,
  Inbox,
  Landmark,
  Link2,
  LoaderCircle,
  PencilLine,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Panel, Pill } from "@/components/household/ui";
import { ApiError } from "@/lib/api";
import { longDate } from "@/lib/household";
import { formatNaira, initialsOf } from "@/lib/marketplace";
import { GENERATOR_LABEL, actOnRequest, loadRequests, nairaDigits, nairaField, packageSpec, priceRange, type OnboardingRequest } from "@/lib/onboarding";

const REFRESH_MS = 15000;

type Icon = ComponentType<{ size?: number; className?: string }>;

const today = () => new Date().toISOString().slice(0, 10);
const daysAhead = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

const input =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-[14px] text-ink outline-none transition focus:border-leaf focus:ring-4 focus:ring-leaf/15";
const action =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-[14px] font-medium text-white transition hover:bg-forest-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30";

type Group = "new" | "progress" | "family" | "done" | "cancelled";

const GROUPS: { key: Group; label: string; icon: Icon; tone: string }[] = [
  { key: "new", label: "New", icon: Inbox, tone: "bg-[#faeeda] text-[#633806]" },
  { key: "progress", label: "In progress", icon: Wrench, tone: "bg-[#e4f3d5] text-[#27500a]" },
  { key: "family", label: "Waiting for family", icon: Clock, tone: "bg-[#eef0ec] text-[#41504a]" },
  { key: "done", label: "Done", icon: BadgeCheck, tone: "bg-forest text-white" },
  { key: "cancelled", label: "Cancelled", icon: CircleSlash, tone: "bg-[#eef0ec] text-muted" },
];

function groupOf(r: OnboardingRequest): Group {
  if (r.status === "cancelled") return "cancelled";
  if (r.certified) return "done";
  if (r.status === "requested") return "new";
  if (r.actions.length > 0) return "progress";
  return "family";
}

/** The request's state in the installer's words (the family's tracker words it for the family). */
const STATUS: Record<string, string> = {
  requested: "New request",
  accepted: "Accepted",
  survey: "Survey booked",
  quoted: "Quote sent",
  visit: "Visit booked",
  certified: "Certified",
  cancelled: "Cancelled by family",
};

function statusOf(r: OnboardingRequest): { label: string; tone: "green" | "amber" | "grey" } {
  if (r.certified) return { label: "Certified", tone: "green" };
  if (r.status === "cancelled") return { label: STATUS.cancelled, tone: "grey" };
  const label = r.status === "approved" ? (r.loan?.status === "approved" ? "Loan approved" : "Quote accepted") : STATUS[r.status] ?? r.status;
  return { label, tone: r.actions.length ? "amber" : "grey" };
}

function paymentText(r: OnboardingRequest) {
  if (r.payment !== "loan" && r.loan?.status !== "referred") return "Cash";
  const loan = r.loan;
  if (loan?.status === "approved") return `Access loan approved, ${formatNaira(loan.limit_naira ?? 0)}`;
  if (loan?.status === "referred") return "Loan referred to Access; paying cash";
  return loan?.limit_naira ? `Access loan, pre-check up to ${formatNaira(loan.limit_naira)}` : "Access loan";
}

const EVENT_ICON: Record<string, Icon> = {
  started: UserRound,
  linked: Link2,
  requested: Send,
  accepted: Handshake,
  survey: ClipboardCheck,
  quoted: ReceiptText,
  approved: BadgeCheck,
  visit: Truck,
  changed: PencilLine,
  cancelled: CircleSlash,
  certified: ShieldCheck,
};

/** The family's latest change, if it came after the request was last sent: shown at the top of the card. */
function latestChange(r: OnboardingRequest) {
  const events = r.events;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].status === "changed") return events[i];
    if (!["requested", "started"].includes(events[i].status)) return null;
  }
  return null;
}

function Fact({ icon: FactIcon, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint text-forest"><FactIcon size={14} /></span>
      <div className="min-w-0">
        <dt className="text-[12px] text-body">{label}</dt>
        <dd className="break-words text-[13.5px] font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

/** One request, its history, and the buttons the installer is allowed to press now. */
function RequestCard({ request, admin, onChange }: { request: OnboardingRequest; admin: boolean; onChange: (r: OnboardingRequest) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => daysAhead(request.path === "need" ? 3 : 2));
  const [amount, setAmount] = useState(() => String(request.package?.price_min_naira ?? ""));
  const [allEvents, setAllEvents] = useState(false);
  const status = statusOf(request);
  const id = `req-${request.id}`;
  const cancelled = request.status === "cancelled";
  const change = latestChange(request);
  const need = request.path === "need";

  async function act(name: OnboardingRequest["actions"][number], body: { date?: string; amount_naira?: number } = {}) {
    setError("");
    setBusy(name);
    try {
      onChange(await actOnRequest(request.id, name, body));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const spinner = (name: string, fallback: ReactNode) => (busy === name ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : fallback);
  const amountNaira = Number(amount || 0);
  const events = [...request.events].reverse();
  const shown = allEvents ? events : events.slice(0, 3);

  return (
    <li className={`rounded-2xl border p-4 sm:p-5 ${cancelled ? "border-dashed border-line bg-[#fafbf9] opacity-75" : "border-line bg-white"}`} aria-labelledby={`${id}-family`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold ${cancelled ? "bg-[#eef0ec] text-muted" : need ? "bg-forest text-lime" : "bg-[#fdf3d7] text-[#8a5a00]"}`}>
          {initialsOf(request.family)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${need ? "bg-[#e4f3d5] text-[#27500a]" : "bg-[#fdf3d7] text-[#8a5a00]"}`}>
              {need ? <Sun size={12} aria-hidden /> : <Link2 size={12} aria-hidden />} {need ? "Needs solar" : "Has solar"}
            </span>
            <Pill tone={status.tone}>{status.tone === "green" ? <BadgeCheck size={12} aria-hidden /> : null}{status.label}</Pill>
          </div>
          <p id={`${id}-family`} className="mt-1.5 break-words text-[15.5px] font-semibold leading-snug">{request.family}</p>
          <p className="break-words text-[13px] text-body">{request.phone} · {request.area} · requested {when(request.requested_at)}</p>
        </div>
      </div>

      {change && !cancelled && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#e3a600]/40 bg-[#fdf6e3] px-3.5 py-2.5 text-[13.5px] text-[#633806]">
          <PencilLine size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span><strong>Family changed their request</strong> · {when(change.at)}<span className="block">{change.note}</span></span>
        </p>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {need ? (
          <>
            <Fact icon={BatteryCharging} label="Package">
              {request.package ? <>{request.package.name}<span className="block text-[12px] font-normal text-body">{packageSpec(request.package)}</span></> : "Not chosen"}
            </Fact>
            <Fact icon={request.payment === "loan" ? Landmark : Coins} label="Payment">{paymentText(request)}</Fact>
          </>
        ) : (
          <>
            <Fact icon={Link2} label="Inverter">{[request.inverter.brand, request.inverter.serial].filter(Boolean).join(" · ") || "Not linked"}</Fact>
            <Fact icon={Fuel} label="Generator">{request.generator ? GENERATOR_LABEL[request.generator] ?? request.generator : "Not answered"}</Fact>
          </>
        )}
        {request.quote_naira !== null && <Fact icon={ReceiptText} label="Quote">{formatNaira(request.quote_naira)}</Fact>}
        {request.survey_on && <Fact icon={CalendarDays} label={need ? "Survey" : "Check visit"}>{longDate(request.survey_on)}</Fact>}
        {admin && request.installer && <Fact icon={Wrench} label="Installer">{request.installer.name}</Fact>}
      </dl>

      {/* Mini timeline, newest first */}
      {events.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#f6f8f5] px-3.5 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">History</p>
          <ol className="mt-2 space-y-2">
            {shown.map((e, i) => {
              const EventIcon = EVENT_ICON[e.status] ?? BadgeCheck;
              return (
                <li key={`${e.status}-${e.at}-${i}`} className="flex gap-2.5 text-[13px]">
                  <EventIcon size={14} className={`mt-0.5 shrink-0 ${e.status === "changed" ? "text-[#8a5a00]" : e.status === "cancelled" ? "text-muted" : "text-leaf"}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-ink">
                      <span className="font-medium">{e.status === "changed" ? "Family changed their request" : e.status === "cancelled" ? "Family cancelled" : e.label}</span>
                      <span className="text-muted"> · {when(e.at)}</span>
                    </p>
                    {e.note && e.status !== "cancelled" && <p className="break-words text-[12.5px] text-body">{e.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {events.length > 3 && (
            <button type="button" onClick={() => setAllEvents(!allEvents)} aria-expanded={allEvents} className="mt-2 text-[12.5px] font-medium text-leaf hover:underline">
              {allEvents ? "Show less" : `Show all ${events.length} updates`}
            </button>
          )}
        </div>
      )}

      {!cancelled && request.actions.length === 0 && !request.certified && request.next.by === "family" && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-body"><Clock size={14} aria-hidden /> Waiting for the family{request.next.action === "accept_quote" ? " to accept the quote" : ""}.</p>
      )}

      {!cancelled && request.actions.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          {request.actions.includes("accept") &&
            (need ? (
              <button type="button" disabled={busy !== null} onClick={() => act("accept")} className={`${action} w-full sm:w-auto`}>
                {spinner("accept", <Check size={16} aria-hidden />)} Accept request
              </button>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-[200px_auto] sm:items-end">
                <div>
                  <label htmlFor={`${id}-date`} className="text-[12.5px] font-medium text-body">Check visit date</label>
                  <input id={`${id}-date`} type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} />
                </div>
                <button type="button" disabled={busy !== null || !date} onClick={() => act("accept", { date })} className={action}>
                  {spinner("accept", <Check size={16} aria-hidden />)} Accept and book visit
                </button>
              </div>
            ))}
          {request.actions.includes("survey") && (
            <div className="grid gap-2.5 sm:grid-cols-[200px_auto] sm:items-end">
              <div>
                <label htmlFor={`${id}-date`} className="text-[12.5px] font-medium text-body">Survey date</label>
                <input id={`${id}-date`} type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} />
              </div>
              <button type="button" disabled={busy !== null || !date} onClick={() => act("survey", { date })} className={action}>
                {spinner("survey", <CalendarDays size={16} aria-hidden />)} Book survey
              </button>
            </div>
          )}
          {request.actions.includes("quote") && (
            <div className="grid gap-2.5 sm:grid-cols-[220px_auto] sm:items-end">
              <div>
                <label htmlFor={`${id}-quote`} className="text-[12.5px] font-medium text-body">Quote</label>
                <div className="relative mt-1">
                  <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-body">₦</span>
                  <input
                    id={`${id}-quote`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={nairaField(amount)}
                    onChange={(e) => setAmount(nairaDigits(e.target.value))}
                    placeholder="3,000,000"
                    aria-describedby={request.package ? `${id}-quote-help` : undefined}
                    className={`${input} pl-8 text-[15px] font-semibold tabular-nums`}
                  />
                </div>
              </div>
              <button type="button" disabled={busy !== null || !amountNaira} onClick={() => act("quote", { amount_naira: amountNaira })} className={action}>
                {spinner("quote", <Send size={16} aria-hidden />)} Send quote of {amountNaira ? formatNaira(amountNaira) : "₦0"}
              </button>
              {request.package && (
                <p id={`${id}-quote-help`} className="text-[12px] text-muted sm:col-span-2">
                  Package range {priceRange(request.package.price_min_naira, request.package.price_max_naira)}.
                </p>
              )}
            </div>
          )}
          {request.actions.includes("complete") && (
            <button type="button" disabled={busy !== null} onClick={() => act("complete")} className={`${action} w-full sm:w-auto`}>
              {spinner("complete", <Hammer size={16} aria-hidden />)} Complete install
            </button>
          )}
          {request.actions.includes("verify") && (
            <button type="button" disabled={busy !== null} onClick={() => act("verify")} className={`${action} w-full sm:w-auto`}>
              {spinner("verify", <ShieldCheck size={16} aria-hidden />)} Verify home
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </li>
  );
}

/**
 * Families who signed up themselves and asked for this installer (admin sees everyone's).
 * The installer moves each one along: accept, survey, quote, then install or verify.
 */
export function OnboardingRequests({ admin = false }: { admin?: boolean }) {
  const [requests, setRequests] = useState<OnboardingRequest[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Group | "all">("all");

  const fetchList = useCallback(
    () =>
      loadRequests()
        .then((list) => {
          setRequests(list);
          setError("");
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Requests couldn't be loaded.")),
    [],
  );

  // Families accept quotes and change their choices from their own phones, so keep the list current while the presenter watches.
  useEffect(() => {
    fetchList();
    const timer = window.setInterval(fetchList, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchList]);

  const refresh = () => {
    setRefreshing(true);
    fetchList().finally(() => setRefreshing(false));
  };

  const update = (next: OnboardingRequest) => setRequests((list) => (list ?? []).map((r) => (r.id === next.id ? next : r)));
  const list = requests ?? [];
  const counts = Object.fromEntries(GROUPS.map((g) => [g.key, list.filter((r) => groupOf(r) === g.key).length])) as Record<Group, number>;
  const order: Group[] = ["new", "progress", "family", "done", "cancelled"];
  const sorted = [...list].sort((a, b) => order.indexOf(groupOf(a)) - order.indexOf(groupOf(b)));
  const visible = filter === "all" ? sorted : sorted.filter((r) => groupOf(r) === filter);
  const waiting = counts.new + counts.progress;

  return (
    <div id="requests" className="scroll-mt-6">
      <Panel
        title="Requests"
        description={
          requests
            ? `${waiting} waiting on ${admin ? "an installer" : "you"} · ${counts.family} with the family`
            : admin ? "Families who signed up and asked for an installer." : "Families who signed up and asked for you."
        }
        actions={
          <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden /> Refresh
          </button>
        }
      >
        {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p>}
        {!requests ? (
          !error && <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" /> Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="flex flex-col items-center gap-2 rounded-xl bg-mint px-4 py-8 text-center text-sm text-body">
            <Inbox size={20} className="text-forest" aria-hidden /> No requests yet. They appear here when a family picks {admin ? "an installer" : "you"} on the website or Telegram.
          </p>
        ) : (
          <>
            <dl className="hidden gap-2.5 sm:grid sm:grid-cols-5">
              {GROUPS.map(({ key, label, icon: GroupIcon, tone }) => (
                <div key={key} className={`flex min-w-0 items-center gap-2.5 rounded-xl border border-line p-3 ${key === "cancelled" ? "col-span-2 sm:col-span-1" : ""}`}>
                  <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><GroupIcon size={16} /></span>
                  <div className="flex min-w-0 flex-col-reverse">
                    <dt className="text-[12px] leading-tight text-body">{label}</dt>
                    <dd className="text-[20px] font-semibold leading-tight tracking-tight tabular-nums">{counts[key]}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div role="group" aria-label="Show requests" className="flex flex-wrap gap-1.5 sm:mt-4">
              {[{ key: "all" as const, label: "All", count: list.length }, ...GROUPS.map((g) => ({ key: g.key, label: g.label, count: counts[g.key] }))].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={filter === chip.key}
                  onClick={() => setFilter(chip.key)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30 ${
                    filter === chip.key ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:bg-mint"
                  }`}
                >
                  {chip.label}
                  <span className={`rounded-full px-1.5 text-[11.5px] tabular-nums ${filter === chip.key ? "bg-white/20" : "bg-[#eef0ec] text-body"}`}>{chip.count}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[#f6f8f5] px-4 py-6 text-center text-sm text-body">Nothing here right now.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {visible.map((r) => <RequestCard key={`${r.id}-${r.events.length}`} request={r} admin={admin} onChange={update} />)}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
