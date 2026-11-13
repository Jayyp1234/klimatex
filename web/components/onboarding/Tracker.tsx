"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleSlash,
  ClipboardCheck,
  FileBadge,
  Gauge,
  Handshake,
  Link2,
  LoaderCircle,
  Lock,
  LogOut,
  MapPin,
  PencilLine,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { ApiError, getSession, saveSession, type User } from "@/lib/api";
import { longDate } from "@/lib/household";
import { formatNaira, initialsOf } from "@/lib/marketplace";
import {
  CONTINUE_HREF,
  GENERATOR_LABEL,
  acceptQuote,
  cancelRequest,
  loadCatalogue,
  loadMine,
  packageSpec,
  priceRange,
  type Catalogue,
  type OnboardingView,
} from "@/lib/onboarding";
import { AskKlimatex } from "./AskKlimatex";
import { StageScene, type SpotKind } from "./illustrations";
import { EstimateTiles, InlineError, InstallerBadge, secondaryButton } from "./parts";
import { ChangeSheet, DetailsSheet, RestartPanel } from "./TrackerChanges";

const REFRESH_MS = 10000;
const BASE = "/app/household/";

type Icon = ComponentType<{ size?: number; className?: string }>;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";
const withDates = (text: string) => text.replace(/\d{4}-\d{2}-\d{2}/g, (d) => longDate(d));

/** Access lends up to the pre-check limit, capped by what the sandbox approves; anything above is paid in cash. */
function loanLine(quote: number, limit: number, cap: number | null) {
  const borrow = Math.min(quote, limit, cap ?? limit);
  return borrow < quote
    ? `When you accept, Access is asked for ${formatNaira(borrow)}. You pay the other ${formatNaira(quote - borrow)} in cash.`
    : `When you accept, Access is asked for the full ${formatNaira(quote)}.`;
}

/** The picture for where the family is now. */
function stageOf(view: OnboardingView): SpotKind {
  switch (view.status) {
    case "cancelled":
      return "cancelled";
    case "requested":
      return "request";
    case "accepted":
      return "accepted";
    case "survey":
      return "survey";
    case "quoted":
      return "quote";
    case "approved":
      return "install";
    case "visit":
      return "installer";
    case "certified":
      return "certificate";
    default:
      return view.next.action === "loan_check" ? "loan" : view.next.action === "link_inverter" ? "inverter" : view.next.action === "generator" ? "generator" : view.next.action === "pick_installer" ? "installer" : "request";
  }
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

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3 text-sm">
      <dt className="text-body">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Past events with their dates and notes, then the steps still to come. */
function Journey({ view }: { view: OnboardingView }) {
  const cancelled = view.status === "cancelled";
  const upcoming = cancelled ? [] : view.steps.filter((s) => !s.done);
  const events = view.events;
  return (
    <section aria-labelledby="journey-heading" className="rounded-2xl border border-line bg-white p-5">
      <h2 id="journey-heading" className="text-[16px] font-semibold tracking-tight">Your journey</h2>
      <ol className="mt-4">
        {events.map((e, i) => {
          const EventIcon = EVENT_ICON[e.status] ?? BadgeCheck;
          const tone =
            e.status === "cancelled" ? "bg-[#eef0ec] text-[#41504a] ring-1 ring-[#c9d0cb]" : e.status === "changed" ? "bg-[#fdf3d7] text-[#8a5a00]" : "bg-forest text-white";
          const last = i === events.length - 1 && upcoming.length === 0;
          return (
            <li key={`${e.status}-${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5 bg-forest/25" />}
              <span aria-hidden className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}><EventIcon size={15} /></span>
              <div className="min-w-0 pt-1">
                <p className="text-[14.5px] font-semibold leading-snug text-ink">{e.label}</p>
                <p className="text-[12.5px] text-muted"><time dateTime={e.at}>{when(e.at)}</time></p>
                {e.note && <p className={`mt-1 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug ${e.status === "changed" ? "bg-[#fdf6e3] text-[#633806]" : "bg-[#f6f8f5] text-body"}`}>{e.note}</p>}
              </div>
            </li>
          );
        })}
        {upcoming.map((s, i) => {
          const last = i === upcoming.length - 1;
          return (
            <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5 border-l-2 border-dashed border-line" />}
              <span
                aria-hidden
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  s.current ? "kx-ring bg-lime text-forest" : "border-2 border-dashed border-line bg-white text-muted"
                }`}
              >
                {s.current ? <ArrowRight size={15} /> : view.steps.indexOf(s) + 1}
              </span>
              <div className="min-w-0 pt-1">
                <p className={`text-[14.5px] leading-snug ${s.current ? "font-semibold text-ink" : "text-muted"}`}>
                  {s.label} <span className="sr-only">({s.current ? "next" : "to come"})</span>
                </p>
                {s.current ? <p className="text-[12.5px] font-medium text-leaf">Next up</p> : <p className="text-[12.5px] text-muted">To come</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Grade, payouts and certificate stay locked until the home is certified. A blurred preview shows what's coming. */
function LockedTiles() {
  const tiles = [
    { icon: Gauge, title: "Grade", body: "Your A–G energy grade, from your own meter readings.", preview: <span className="text-[44px] font-bold leading-none text-forest">B</span> },
    { icon: Wallet, title: "Payouts", body: "Your share of every carbon credit sold.", preview: <span className="text-[28px] font-semibold leading-none text-forest">₦4,200</span> },
    { icon: FileBadge, title: "Certificate", body: "Your Home Energy Certificate to download and share.", preview: <FileBadge size={44} className="text-forest" /> },
  ];
  return (
    <section aria-labelledby="locked-heading">
      <h2 id="locked-heading" className="mb-3 text-[16px] font-semibold tracking-tight">Unlocks when your home is certified</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(({ icon: TileIcon, title, body, preview }) => (
          <div key={title} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div aria-hidden className="relative flex h-[88px] items-center justify-center bg-[linear-gradient(135deg,#eff5ee,#f8faf6)]">
              <span className="select-none blur-[6px]">{preview}</span>
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-forest shadow-sm ring-1 ring-line"><Lock size={15} /></span>
            </div>
            <div className="p-4">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink"><TileIcon size={16} className="text-leaf" aria-hidden /> {title}</p>
              <p className="mt-0.5 text-[13px] text-body">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * What a signed-up family sees until their home is certified: where they are, whose move it is, their estimates,
 * Ask KlimateX, and ways to change their choices, edit their details or cancel. `page` is "assistant" on /app/household/assistant/.
 */
export function Tracker({
  user,
  initial,
  page = "dashboard",
  onCertified,
  onSignOut,
}: {
  user: User;
  initial: OnboardingView;
  page?: "dashboard" | "assistant";
  onCertified: () => void;
  onSignOut: () => void;
}) {
  const [view, setView] = useState(initial);
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<"change" | "details" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState("");

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

  // Packages and installers, for "change my choices" and "start again".
  const needCatalogue = sheet === "change" || restarting;
  useEffect(() => {
    if (!needCatalogue || catalogue) return;
    loadCatalogue()
      .then((c) => {
        setCatalogue(c);
        setCatalogueError("");
      })
      .catch((e) => setCatalogueError(e instanceof ApiError ? e.message : "The installer list couldn't be loaded."));
  }, [needCatalogue, catalogue]);

  function refresh() {
    setRefreshing(true);
    loadMine()
      .then((next) => (next.certified ? onCertified() : setView(next)))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't refresh. Try again."))
      .finally(() => setRefreshing(false));
  }

  async function run(key: string, task: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(key);
    try {
      await task();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const changed = (next: OnboardingView, message: string) => {
    setView(next);
    setSheet(null);
    setRestarting(false);
    setConfirmCancel(false);
    setError("");
    setNotice(message);
  };

  const { next, installer } = view;
  const cancelled = view.status === "cancelled";
  const yourMove = next.by === "family";
  const familyStep = yourMove && next.action !== "accept_quote" && next.action !== "restart" && next.action !== null;
  const totalSteps = view.steps.length;
  const done = view.steps.filter((s) => s.done).length;
  const progress = cancelled ? 0 : Math.round((done / totalSteps) * 100);
  const loan = view.loan;
  const firstName = name.split(" ")[0];
  const panels = view.path === "have" || view.status === "approved";

  const header = (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" aria-label="KlimateX home" className="shrink-0"><Image src="/logo.svg" alt="KlimateX" width={130} height={32} priority className="h-7 w-auto" /></Link>
          <nav aria-label="Your sign-up" className="hidden items-center gap-1 sm:flex">
            {[
              { href: BASE, label: "My progress", active: page === "dashboard" },
              { href: `${BASE}assistant/`, label: "Ask KlimateX", active: page === "assistant" },
            ].map((l) => (
              <Link key={l.href} href={l.href} aria-current={l.active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${l.active ? "bg-mint text-forest" : "text-body hover:bg-mint hover:text-ink"}`}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="hidden h-8 w-8 items-center justify-center rounded-lg bg-forest text-[11px] font-semibold text-white sm:flex">{initialsOf(name)}</span>
          <span className="hidden max-w-[160px] truncate text-sm font-medium md:block">{name}</span>
          <button type="button" onClick={onSignOut} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint">
            <LogOut size={15} aria-hidden /> Sign out
          </button>
        </div>
      </div>
      <nav aria-label="Your sign-up" className="flex gap-1 border-t border-line px-4 py-2 sm:hidden">
        {[
          { href: BASE, label: "My progress", active: page === "dashboard" },
          { href: `${BASE}assistant/`, label: "Ask KlimateX", active: page === "assistant" },
        ].map((l) => (
          <Link key={l.href} href={l.href} aria-current={l.active ? "page" : undefined}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-[13.5px] font-medium ${l.active ? "bg-forest text-white" : "bg-[#f6f8f5] text-body"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );

  if (page === "assistant") {
    return (
      <div className="min-h-screen bg-[#f6f8f5] text-ink">
        {header}
        <main className="kx-step-in mx-auto max-w-[860px] space-y-4 px-4 pb-16 pt-6 sm:px-6">
          <Link href={BASE} className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-body hover:bg-mint hover:text-ink">
            <ArrowLeft size={15} aria-hidden /> My progress
          </Link>
          <div className="flex flex-col gap-3 rounded-2xl bg-forest px-5 py-4 text-white sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-lime">{yourMove ? "Your move" : "Where you are"}</p>
              <p className="mt-1 text-[15px] font-medium leading-snug">{withDates(next.text)}</p>
            </div>
            {(familyStep || next.action === "accept_quote" || next.action === "restart") && (
              <Link href={familyStep ? CONTINUE_HREF : BASE} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-[14px] font-semibold text-forest hover:bg-mint">
                {familyStep ? "Continue" : next.action === "accept_quote" ? "See my quote" : "Start again"} <ArrowRight size={15} aria-hidden />
              </Link>
            )}
          </div>
          <AskKlimatex name={name} full />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8f5] text-ink">
      {header}

      <main className="kx-step-in mx-auto max-w-[1080px] space-y-5 px-4 pb-16 pt-6 sm:px-6">
        {/* Who and where */}
        <section aria-labelledby="hello-heading" className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
            <StageScene kind={stageOf(view)} panels={panels} className="h-[112px] w-[144px] shrink-0 self-center sm:h-[132px] sm:w-[170px]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${view.path === "need" ? "bg-[#e4f3d5] text-[#27500a]" : "bg-[#fdf3d7] text-[#8a5a00]"}`}>
                  {view.path === "need" ? "Getting solar" : "Linking my solar"}
                </span>
                {cancelled && <span className="rounded-md bg-[#eef0ec] px-2 py-0.5 text-[12px] font-semibold text-[#41504a]">Cancelled</span>}
              </div>
              <h1 id="hello-heading" className="mt-2 break-words text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]">Hello, {firstName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[14px] text-body">
                <MapPin size={14} aria-hidden /> {view.area}, Lagos
                {view.package && <><span aria-hidden>·</span> {view.package.name}</>}
                {installer && <><span aria-hidden>·</span> {installer.name}</>}
              </p>
              <div className="mt-4 max-w-[460px]">
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="font-medium text-ink">{cancelled ? "Paused" : `Step ${Math.min(done + 1, totalSteps)} of ${totalSteps}`}</span>
                  <span className="text-muted">{cancelled ? "Start again any time" : view.path === "need" ? "to a certified solar home" : "to a certified home"}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mint-strong" role="progressbar" aria-label="Sign-up progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <span className="block h-full rounded-full bg-gradient-to-r from-forest to-leaf transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(progress, cancelled ? 0 : 6)}%` }} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:flex-col">
              <button type="button" onClick={() => setSheet("details")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint sm:flex-none">
                <PencilLine size={14} aria-hidden /> Edit my details
              </button>
              <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint disabled:opacity-60 sm:flex-none">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden /> Refresh
              </button>
            </div>
          </div>
        </section>

        {/* What happens next, and whose move it is */}
        <section aria-labelledby="next-heading" className={`relative overflow-hidden rounded-2xl px-5 py-5 sm:px-6 ${cancelled ? "border border-line bg-white text-ink" : "bg-forest text-white"}`}>
          {!cancelled && <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-lime/15 blur-2xl" />}
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              aria-hidden
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-semibold ${
                cancelled ? "bg-[#eef0ec] text-[#41504a]" : yourMove ? "bg-lime text-forest" : "bg-white/15 text-white"
              }`}
            >
              {cancelled ? <CircleSlash size={20} /> : initialsOf(yourMove ? name : installer?.name ?? "Installer")}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-semibold ${cancelled ? "bg-[#eef0ec] text-[#41504a]" : yourMove ? "bg-lime text-forest" : "bg-white/15 text-white"}`}>
                {cancelled ? "Request cancelled" : yourMove ? "Your move" : next.by === "installer" ? `${installer?.name ?? "Your installer"}'s move` : "Next"}
              </p>
              <h2 id="next-heading" className="mt-2 text-[19px] font-semibold leading-snug tracking-tight">{withDates(next.text)}</h2>
              {view.quote_naira !== null && next.action === "accept_quote" && (
                <p className="mt-1 text-sm text-white/80">
                  {view.payment === "loan" && loan?.limit_naira ? loanLine(view.quote_naira, loan.limit_naira, loan.cap_naira) : "You pay your installer in cash."}
                </p>
              )}
              {next.by === "installer" && (
                <p className="mt-1.5 flex items-center gap-2 text-[13px] text-white/75">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-lime kx-ring" /> Nothing to do for now. This page updates by itself.
                </p>
              )}
              {cancelled && <p className="mt-1 text-[13.5px] text-body">Your account is kept. Nothing goes to an installer until you start again.</p>}
            </div>
            {next.action === "accept_quote" ? (
              <button type="button" onClick={() => run("accept", async () => setView(await acceptQuote()))} disabled={busy !== null}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-forest transition hover:bg-mint disabled:opacity-70 sm:w-auto">
                {busy === "accept" && <LoaderCircle size={16} className="animate-spin" aria-hidden />} Accept quote
              </button>
            ) : familyStep ? (
              <Link href={CONTINUE_HREF} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-forest transition hover:bg-mint sm:w-auto">
                Continue <ArrowRight size={16} aria-hidden />
              </Link>
            ) : cancelled && !restarting ? (
              <button type="button" onClick={() => setRestarting(true)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest px-5 text-[15px] font-semibold text-white transition hover:bg-forest-hover sm:w-auto">
                Start again <ArrowRight size={16} aria-hidden />
              </button>
            ) : null}
          </div>
        </section>
        {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-forest/20 bg-mint px-4 py-3 text-sm text-ink"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-leaf" aria-hidden /> {notice}</p>}
        <InlineError message={error} />

        {restarting && (catalogue ? (
          <RestartPanel view={view} catalogue={catalogue} onDone={changed} />
        ) : catalogueError ? (
          <InlineError message={catalogueError} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" aria-hidden /> Loading packages…</p>
        ))}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Journey view={view} />

          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section aria-labelledby="choices-heading" className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h2 id="choices-heading" className="text-[16px] font-semibold tracking-tight">Your choices</h2>
                {view.can_change && !cancelled && (
                  <button type="button" onClick={() => setSheet("change")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-forest/30 bg-white px-3 text-[13px] font-medium text-forest hover:bg-mint">
                    <PencilLine size={14} aria-hidden /> Change my choices
                  </button>
                )}
              </div>
              {installer && (
                <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-[13px] font-semibold text-lime">{initialsOf(installer.name)}</span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-body">Installer</p>
                    <p className="text-[15px] font-semibold">{installer.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-body"><MapPin size={13} aria-hidden /> {installer.area}</p>
                    <div className="mt-2"><InstallerBadge installer={installer} /></div>
                  </div>
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
              {!view.can_change && (
                <p className="flex items-start gap-2 border-t border-line bg-[#fafbf9] px-5 py-3 text-[13px] text-body">
                  <Lock size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                  Your quote is accepted and your install is being booked, so your choices are locked. To change them, contact your installer or KlimateX support.
                </p>
              )}
            </section>

            {/* Cancel, behind an in-page confirmation */}
            {view.can_change && !cancelled && (
              <section aria-labelledby="cancel-heading" className="rounded-2xl border border-line bg-white p-5">
                <h2 id="cancel-heading" className="text-[15px] font-semibold">Changed your mind?</h2>
                {!confirmCancel ? (
                  <>
                    <p className="mt-1 text-[13.5px] text-body">You can cancel your request until you accept a quote. Your account stays.</p>
                    <button type="button" onClick={() => setConfirmCancel(true)} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 text-[13.5px] font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200">
                      <CircleSlash size={15} aria-hidden /> Cancel request
                    </button>
                  </>
                ) : (
                  <div role="alertdialog" aria-labelledby="cancel-confirm" aria-describedby="cancel-confirm-body" className="kx-step-in mt-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
                    <p id="cancel-confirm" className="text-[14.5px] font-semibold text-red-900">Cancel your request?</p>
                    <p id="cancel-confirm-body" className="mt-1 text-[13.5px] text-red-900/80">
                      {installer ? `${installer.name} stops working on it` : "It stops here"}{view.quote_naira !== null ? ` and your quote of ${formatNaira(view.quote_naira)} is dropped` : view.survey_on ? " and your visit date is dropped" : ""}. Your account and answers are kept, and you can start again any time.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button type="button" autoFocus onClick={() => setConfirmCancel(false)} className={`${secondaryButton} h-10 text-[14px]`}>Keep my request</button>
                      <button type="button" disabled={busy !== null} onClick={() => run("cancel", async () => changed(await cancelRequest(), "Your request is cancelled. Start again whenever you're ready."))}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-[14px] font-medium text-white hover:bg-red-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200">
                        {busy === "cancel" && <LoaderCircle size={15} className="animate-spin" aria-hidden />} Yes, cancel request
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        <EstimateTiles estimate={view.estimate} title={view.path === "need" ? "What this system could do in a year" : "What a home like yours could do in a year"} />

        <AskKlimatex name={name} />

        <LockedTiles />

        <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] text-muted">
          <Sparkles size={13} aria-hidden /> Questions? Ask KlimateX above, any time. It reads your sign-up but can&apos;t change it.
        </p>
      </main>

      {sheet === "change" && (catalogue ? (
        <ChangeSheet view={view} catalogue={catalogue} onClose={() => setSheet(null)} onDone={changed} />
      ) : null)}
      {sheet === "change" && !catalogue && (
        <div role="status" className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-xl bg-forest px-4 py-2.5 text-sm text-white shadow-xl">
          {catalogueError ? <span>{catalogueError} <button type="button" className="ml-2 underline" onClick={() => setSheet(null)}>Close</button></span> : "Loading packages…"}
        </div>
      )}
      {sheet === "details" && (
        <DetailsSheet
          name={name}
          area={view.area}
          onClose={() => setSheet(null)}
          onDone={(next, newName) => {
            setName(newName);
            const session = getSession();
            if (session) saveSession({ ...session, user: { ...session.user, name: newName } });
            changed(next, "Your details are saved.");
          }}
        />
      )}
    </div>
  );
}
