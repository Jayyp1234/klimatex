"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, Clock, FileBadge, Gauge, LoaderCircle, Lock, LogOut, MapPin, RefreshCw, Wallet } from "lucide-react";
import { ApiError, type User } from "@/lib/api";
import { longDate } from "@/lib/household";
import { formatNaira } from "@/lib/marketplace";
import { CONTINUE_HREF, GENERATOR_LABEL, acceptQuote, loadMine, packageSpec, priceRange, type OnboardingView } from "@/lib/onboarding";
import { EstimateFigures, InlineError, InstallerBadge, primaryButton } from "./parts";

const REFRESH_MS = 10000;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";

/** Access lends up to the pre-check limit, capped by what the sandbox approves; anything above is paid in cash. */
function loanLine(quote: number, limit: number, cap: number | null) {
  const borrow = Math.min(quote, limit, cap ?? limit);
  return borrow < quote
    ? `When you accept, Access is asked for ${formatNaira(borrow)}. You pay the other ${formatNaira(quote - borrow)} in cash.`
    : `When you accept, Access is asked for the full ${formatNaira(quote)}.`;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3 text-sm">
      <dt className="text-body">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * What a signed-up family sees until their home is certified: where they are, whose move it is,
 * their estimates, and the parts of the dashboard that unlock later.
 */
export function Tracker({ user, initial, onCertified, onSignOut }: { user: User; initial: OnboardingView; onCertified: () => void; onSignOut: () => void }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // The installer moves the request along from their own dashboard; keep this page current.
  useEffect(() => {
    if (view.certified) return;
    const timer = window.setInterval(() => {
      loadMine()
        .then((next) => (next.certified ? onCertified() : setView(next)))
        .catch(() => undefined);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [view.certified, onCertified]);

  function refresh() {
    setRefreshing(true);
    loadMine()
      .then((next) => (next.certified ? onCertified() : setView(next)))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't refresh. Try again."))
      .finally(() => setRefreshing(false));
  }

  async function accept() {
    setError("");
    setBusy(true);
    try {
      setView(await acceptQuote());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const { next, installer } = view;
  const yourMove = next.by === "family";
  const familyStep = yourMove && next.action !== "accept_quote" && next.action !== null;
  const done = view.steps.filter((s) => s.done).length;
  const loan = view.loan;

  return (
    <div className="min-h-screen bg-[#f6f8f5] text-ink">
      <header className="border-b border-line bg-white/95">
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="KlimateX home"><Image src="/logo.svg" alt="KlimateX" width={130} height={32} priority className="h-7 w-auto" /></Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium sm:block">{user.name}</span>
            <button type="button" onClick={onSignOut} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint">
              <LogOut size={15} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1040px] space-y-5 px-4 pb-16 pt-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Hello, {user.name}</h1>
            <p className="mt-1 text-[15px] text-body">
              {view.path === "need" ? "Your solar is on its way." : "Your home is on its way to KlimateX."} {view.area}, Lagos · step {Math.min(done + 1, view.steps.length)} of {view.steps.length}
            </p>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden /> Refresh
          </button>
        </div>

        {/* What happens next, and whose move it is */}
        <section aria-labelledby="next-heading" className="relative overflow-hidden rounded-2xl bg-forest px-5 py-5 text-white sm:px-6">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-lime/15 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className={`inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold ${yourMove ? "bg-lime text-forest" : "bg-white/15 text-white"}`}>
                {yourMove ? "Your move" : next.by === "installer" ? `${installer?.name ?? "Your installer"}'s move` : "Next"}
              </p>
              <h2 id="next-heading" className="mt-2 text-[19px] font-semibold leading-snug tracking-tight">{next.text.replace(/\d{4}-\d{2}-\d{2}/g, (d) => longDate(d))}</h2>
              {view.quote_naira !== null && next.action === "accept_quote" && (
                <p className="mt-1 text-sm text-white/75">
                  {view.payment === "loan" && loan?.limit_naira ? loanLine(view.quote_naira, loan.limit_naira, loan.cap_naira) : "You pay your installer in cash."}
                </p>
              )}
            </div>
            {next.action === "accept_quote" ? (
              <button type="button" onClick={accept} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-forest transition hover:bg-mint disabled:opacity-70 sm:w-auto">
                {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden />} Accept quote
              </button>
            ) : familyStep ? (
              <Link href={CONTINUE_HREF} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-forest transition hover:bg-mint sm:w-auto">
                Continue <ArrowRight size={16} aria-hidden />
              </Link>
            ) : null}
          </div>
        </section>
        <InlineError message={error} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Steps */}
          <section aria-labelledby="steps-heading" className="rounded-2xl border border-line bg-white p-5">
            <h2 id="steps-heading" className="text-[16px] font-semibold tracking-tight">Your steps</h2>
            <ol className="mt-4">
              {view.steps.map((s, i) => {
                const last = i === view.steps.length - 1;
                const state = s.done ? "Done" : s.current ? "In progress" : "To come";
                return (
                  <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                    {!last && <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-24px)] w-0.5 ${s.done ? "bg-forest" : "bg-line"}`} />}
                    <span
                      aria-hidden
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                        s.done ? "bg-forest text-white" : s.current ? "bg-mint text-forest ring-2 ring-leaf" : "bg-[#eef2ee] text-muted"
                      }`}
                    >
                      {s.done ? <Check size={14} strokeWidth={3} /> : s.current ? <Clock size={14} /> : i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className={`text-[15px] ${s.done || s.current ? "font-semibold text-ink" : "text-muted"}`}>
                        {s.label} <span className="sr-only">({state})</span>
                      </p>
                      <p className="text-[12.5px] text-muted">
                        {s.done ? (s.at ? when(s.at) : "Done") : s.current ? "In progress" : "To come"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Choices so far */}
          <section aria-labelledby="choices-heading" className="overflow-hidden rounded-2xl border border-line bg-white">
            <h2 id="choices-heading" className="border-b border-line px-5 py-4 text-[16px] font-semibold tracking-tight">Your request</h2>
            {installer && (
              <div className="border-b border-line px-5 py-4">
                <p className="text-[12.5px] text-body">Installer</p>
                <p className="text-[15px] font-semibold">{installer.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] text-body"><MapPin size={13} aria-hidden /> {installer.area}</p>
                <div className="mt-2"><InstallerBadge installer={installer} /></div>
              </div>
            )}
            <dl className="divide-y divide-line">
              {view.package && (
                <>
                  <Detail label="Package">{view.package.name}</Detail>
                  <Detail label="System"><span className="font-normal text-body">{packageSpec(view.package)}</span></Detail>
                  <Detail label="Price range">{priceRange(view.package.price_min_naira, view.package.price_max_naira)}</Detail>
                </>
              )}
              {view.path === "need" && <Detail label="Payment">{view.payment === "loan" ? "Access loan" : "Cash"}</Detail>}
              {loan?.limit_naira != null && (
                <Detail label={loan.status === "approved" ? "Loan approved" : "Loan pre-check"}>
                  {formatNaira(loan.limit_naira)}
                  {loan.monthly_naira ? <span className="block text-[12px] font-normal text-body">about {formatNaira(loan.monthly_naira)} a month · {loan.months} months</span> : null}
                </Detail>
              )}
              {loan?.status === "referred" && <Detail label="Loan">Referred to Access for review</Detail>}
              {view.quote_naira !== null && <Detail label="Quote">{formatNaira(view.quote_naira)}</Detail>}
              {view.survey_on && <Detail label={view.path === "need" ? "Survey" : "Check visit"}>{longDate(view.survey_on)}</Detail>}
              {view.path === "have" && (
                <>
                  <Detail label="Inverter">{view.inverter.brand ? `${view.inverter.brand} · ${view.inverter.serial ?? ""}` : "Not linked yet"}</Detail>
                  <Detail label="Generator">{view.generator ? GENERATOR_LABEL[view.generator] ?? view.generator : "Not answered yet"}</Detail>
                </>
              )}
            </dl>
          </section>
        </div>

        <EstimateFigures estimate={view.estimate} title={view.path === "need" ? "What this system could do in a year" : "What a home like yours could do in a year"} />

        {/* The dashboard parts that open after certification */}
        <section aria-labelledby="locked-heading">
          <h2 id="locked-heading" className="sr-only">Unlocks when your home is certified</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Gauge, title: "Grade", body: "Your A–G energy grade, from your own meter readings." },
              { icon: Wallet, title: "Payouts", body: "Your share of every carbon credit sold." },
              { icon: FileBadge, title: "Certificate", body: "Your Home Energy Certificate to download and share." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-dashed border-line bg-white/60 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef2ee] text-muted"><Icon size={17} aria-hidden /></span>
                  <Lock size={16} className="text-muted" aria-hidden />
                </div>
                <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-[13px] text-body">{body}</p>
                <p className="mt-3 text-[12.5px] font-medium text-muted">Unlocks when your home is certified</p>
              </div>
            ))}
          </div>
        </section>

        {familyStep && (
          <p className="text-center">
            <Link href={CONTINUE_HREF} className={primaryButton}>Continue where you left off <ArrowRight size={17} aria-hidden /></Link>
          </p>
        )}
      </main>
    </div>
  );
}
