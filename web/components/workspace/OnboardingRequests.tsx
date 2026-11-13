"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CalendarDays, Check, Hammer, Inbox, LoaderCircle, RefreshCw, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { Panel, Pill } from "@/components/household/ui";
import { ApiError } from "@/lib/api";
import { longDate } from "@/lib/household";
import { formatNaira } from "@/lib/marketplace";
import { GENERATOR_LABEL, actOnRequest, loadRequests, type OnboardingRequest } from "@/lib/onboarding";

const REFRESH_MS = 15000;

const daysAhead = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

const input = "h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/15";
const action = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-medium text-white transition hover:bg-forest-hover disabled:opacity-60";

/** The request's state in the installer's words (the family's tracker words it for the family). */
const STATUS: Record<string, string> = {
  requested: "New request",
  accepted: "Accepted",
  survey: "Survey booked",
  quoted: "Quote sent",
  visit: "Visit booked",
  certified: "Certified",
};

function statusOf(r: OnboardingRequest): { label: string; tone: "green" | "amber" | "grey" } {
  if (r.certified) return { label: "Certified", tone: "green" };
  const label = r.status === "approved" ? (r.loan?.status === "approved" ? "Loan approved" : "Quote accepted") : STATUS[r.status] ?? r.status;
  return { label, tone: r.actions.length ? "amber" : "grey" };
}

function pathText(r: OnboardingRequest) {
  if (r.path === "need") return `Needs solar: ${r.package?.name ?? "package not chosen"}`;
  return `Has solar: ${[r.inverter.brand, r.inverter.serial].filter(Boolean).join(" ") || "inverter not linked"}`;
}

function paymentText(r: OnboardingRequest) {
  if (r.path === "have") return r.generator ? `Generator: ${GENERATOR_LABEL[r.generator] ?? r.generator}` : "No payment";
  if (r.payment !== "loan" && r.loan?.status !== "referred") return "Cash";
  const loan = r.loan;
  if (loan?.status === "approved") return `Access loan approved, ${formatNaira(loan.limit_naira ?? 0)}`;
  if (loan?.status === "referred") return "Loan referred to Access; paying cash";
  return loan?.limit_naira ? `Loan, pre-check up to ${formatNaira(loan.limit_naira)}` : "Loan";
}

/** One request and the buttons the installer is allowed to press now. */
function RequestCard({ request, admin, onChange }: { request: OnboardingRequest; admin: boolean; onChange: (r: OnboardingRequest) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => daysAhead(request.path === "need" ? 3 : 2));
  const [amount, setAmount] = useState(() => String(request.package?.price_min_naira ?? ""));
  const status = statusOf(request);
  const id = `req-${request.id}`;

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

  const spinner = (name: string) => (busy === name ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : null);
  const amountNaira = Number(amount.replace(/\D/g, ""));

  return (
    <li className="rounded-xl border border-line bg-white p-4" aria-labelledby={`${id}-family`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p id={`${id}-family`} className="text-[15px] font-semibold">{request.family} <span className="font-normal text-muted">· {request.phone}</span></p>
          <p className="text-[13px] text-body">{request.area} · requested {when(request.requested_at)}</p>
        </div>
        <Pill tone={status.tone}>{status.tone === "green" ? <BadgeCheck size={12} aria-hidden /> : null}{status.label}</Pill>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13.5px] sm:grid-cols-2">
        <div className="min-w-0"><dt className="sr-only">Path</dt><dd className="font-medium text-ink">{pathText(request)}</dd></div>
        <div className="min-w-0"><dt className="sr-only">{request.path === "need" ? "Payment" : "Generator"}</dt><dd className="text-body">{paymentText(request)}</dd></div>
        {admin && request.installer && <div className="min-w-0"><dt className="inline text-body">Installer: </dt><dd className="inline">{request.installer.name}</dd></div>}
        {request.survey_on && <div><dt className="inline text-body">{request.path === "need" ? "Survey: " : "Check visit: "}</dt><dd className="inline">{longDate(request.survey_on)}</dd></div>}
        {request.quote_naira !== null && <div><dt className="inline text-body">Quote: </dt><dd className="inline font-medium">{formatNaira(request.quote_naira)}</dd></div>}
      </dl>

      {request.actions.length === 0 && !request.certified && request.next.by === "family" && (
        <p className="mt-3 text-[13px] text-muted">Waiting for the family{request.next.action === "accept_quote" ? " to accept the quote" : ""}.</p>
      )}

      {request.actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2.5 border-t border-line pt-4">
          {request.actions.includes("accept") && (
            request.path === "have" ? (
              <>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-body">
                  Check visit date
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
                </label>
                <button type="button" disabled={busy !== null} onClick={() => act("accept", date ? { date } : {})} className={action}>
                  {spinner("accept") ?? <Check size={14} aria-hidden />} Accept and book visit
                </button>
              </>
            ) : (
              <button type="button" disabled={busy !== null} onClick={() => act("accept")} className={action}>
                {spinner("accept") ?? <Check size={14} aria-hidden />} Accept request
              </button>
            )
          )}
          {request.actions.includes("survey") && (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-body">
                Survey date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
              </label>
              <button type="button" disabled={busy !== null} onClick={() => act("survey", date ? { date } : {})} className={action}>
                {spinner("survey") ?? <CalendarDays size={14} aria-hidden />} Book survey
              </button>
            </>
          )}
          {request.actions.includes("quote") && (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-body">
                Quote (₦)
                <input
                  inputMode="numeric"
                  value={amount ? Number(amount.replace(/\D/g, "") || 0).toLocaleString("en-NG") : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="3,000,000"
                  className={`${input} w-[140px] tabular-nums`}
                />
              </label>
              <button type="button" disabled={busy !== null || !amountNaira} onClick={() => act("quote", { amount_naira: amountNaira })} className={action}>
                {spinner("quote") ?? <Send size={14} aria-hidden />} Send quote
              </button>
            </>
          )}
          {request.actions.includes("complete") && (
            <button type="button" disabled={busy !== null} onClick={() => act("complete")} className={action}>
              {spinner("complete") ?? <Hammer size={14} aria-hidden />} Complete install
            </button>
          )}
          {request.actions.includes("verify") && (
            <button type="button" disabled={busy !== null} onClick={() => act("verify")} className={action}>
              {spinner("verify") ?? <ShieldCheck size={14} aria-hidden />} Verify home
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

  // Families accept quotes from their own phones, so keep the list current while the presenter watches.
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
  const open = (requests ?? []).filter((r) => r.actions.length > 0);
  const others = (requests ?? []).filter((r) => r.actions.length === 0);

  return (
    <div id="requests" className="scroll-mt-6">
      <Panel
        title="Requests"
        description={
          requests
            ? `${open.length} waiting on ${admin ? "an installer" : "you"} · ${others.length} with the family or done`
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
          <ul className="space-y-3">
            {[...open, ...others].map((r) => <RequestCard key={r.id} request={r} admin={admin} onChange={update} />)}
          </ul>
        )}
      </Panel>
    </div>
  );
}
