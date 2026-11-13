"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CircleHelp,
  Coins,
  FileBadge,
  Fuel,
  Home,
  Landmark,
  LoaderCircle,
  LogIn,
  MapPin,
  MessageSquareText,
  Phone,
  Recycle,
  ShieldCheck,
  Sun,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { CodeInput } from "@/components/app/CodeInput";
import { weakPin } from "@/components/app/PhoneSignIn";
import { ApiError, getSession } from "@/lib/api";
import { links } from "@/lib/links";
import { formatNaira } from "@/lib/marketplace";
import {
  createAccount,
  loadCatalogue,
  loadMine,
  packageSpec,
  priceRange,
  saveAnswers,
  startPhone,
  submitRequest,
  verifyPhone,
  type Catalogue,
  type OnboardingView,
  type Package,
  type Path,
} from "@/lib/onboarding";
import { EstimateFigures, InlineError, InstallerBadge, fieldClass, primaryButton, secondaryButton } from "./parts";

type Step =
  | "welcome"
  | "explain"
  | "triage"
  | "catalog"
  | "package"
  | "payment"
  | "perks"
  | "phone"
  | "code"
  | "account"
  | "request"
  | "inverter"
  | "generator"
  | "installer";

const TRACKER = "/app/household/";
const noSubscribe = () => () => undefined;
const RESEND_SECONDS = 30;

/** The labelled progress for each path. Each entry lists the steps it covers. */
const PROGRESS: Record<Path, { label: string; steps: Step[] }[]> = {
  need: [
    { label: "Choose a package", steps: ["catalog", "package"] },
    { label: "Cash or loan", steps: ["payment"] },
    { label: "Your account", steps: ["phone", "code", "account"] },
    { label: "Send your request", steps: ["request"] },
  ],
  have: [
    { label: "See the perks", steps: ["perks"] },
    { label: "Your account", steps: ["phone", "code", "account"] },
    { label: "Link your inverter", steps: ["inverter"] },
    { label: "Your generator", steps: ["generator"] },
    { label: "Pick an installer", steps: ["installer"] },
  ],
};

const GENERATOR_HELP: Record<string, string> = {
  trade_in: "The installer collects it at the visit and a licensed recycler scraps it. You get a trade-in value.",
  backup: "Keep it for emergencies. Your readings show how little you need it.",
  none: "You don't own a generator any more.",
};

/** Which screen a signed-up family continues on, from what the server says happens next. */
function stepFor(view: OnboardingView): Step | null {
  switch (view.next.action) {
    case "loan_check":
    case "send_request":
      return "request";
    case "link_inverter":
      return "inverter";
    case "generator":
      return "generator";
    case "pick_installer":
      return "installer";
    default:
      return null;
  }
}

function Progress({ path, step, loan }: { path: Path; step: Step; loan: boolean }) {
  const stages = PROGRESS[path].map((s) => (loan && s.steps.includes("request") ? { ...s, label: "Loan check and request" } : s));
  const index = stages.findIndex((s) => s.steps.includes(step));
  if (index < 0) return null;
  return (
    <div className="mb-8">
      <p className="text-[13px] font-medium text-body">
        Step {index + 1} of {stages.length + 1} · <span className="text-ink">{stages[index].label}</span>
      </p>
      <ol className="mt-2.5 flex gap-1.5" aria-hidden>
        {[...stages, { label: "Track your home" }].map((s, i) => (
          <li key={s.label} className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-forest" : i === index ? "bg-leaf" : "bg-mint-strong"}`} />
        ))}
      </ol>
    </div>
  );
}

function BackButton({ onClick, children = "Back" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-body transition hover:bg-mint hover:text-ink">
      <ArrowLeft size={15} aria-hidden /> {children}
    </button>
  );
}

function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h1 tabIndex={-1} data-step-heading className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink outline-none sm:text-[32px]">{children}</h1>
      {sub && <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-body">{sub}</p>}
    </>
  );
}

/** A large button that picks one answer. */
function Choice({ icon, title, body, onClick, selected, busy = false }: { icon: ReactNode; title: string; body: string; onClick: () => void; selected?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={busy}
      className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30 disabled:opacity-60 sm:p-5 ${
        selected ? "border-forest bg-mint ring-1 ring-forest" : "border-line bg-white hover:border-forest/40 hover:bg-[#fafcf9]"
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-forest text-white" : "bg-mint text-forest"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-body">{body}</span>
      </span>
      {busy ? <LoaderCircle size={18} className="mt-1 shrink-0 animate-spin text-muted" aria-hidden /> : <ArrowRight size={18} className="mt-1 shrink-0 text-muted" aria-hidden />}
    </button>
  );
}

function Busy({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <>
      {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden />}
      {children}
      {!busy && <ArrowRight size={17} className="transition group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
}

export function GetStarted() {
  const [step, setStep] = useState<Step>("welcome");
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState("");
  const [path, setPath] = useState<Path | null>(null);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [payment, setPayment] = useState<"cash" | "loan" | null>(null);

  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState("");
  const [existing, setExisting] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [setupToken, setSetupToken] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [view, setView] = useState<OnboardingView | null>(null);
  const [brand, setBrand] = useState("");
  const [serial, setSerial] = useState("");
  const [installerId, setInstallerId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // "?continue" comes from the tracker. Read without a hydration mismatch: empty on the server, the real query in the browser.
  const resumeRequested = useSyncExternalStore(noSubscribe, () => window.location.search.includes("continue"), () => false);
  const [resumed, setResumed] = useState(false);
  const resuming = resumeRequested && !resumed;
  const router = useRouter();
  const top = useRef<HTMLDivElement>(null);

  const fetchCatalogue = () =>
    loadCatalogue()
      .then((c) => {
        setCatalogue(c);
        setCatalogueError("");
      })
      .catch((e) => setCatalogueError(e instanceof ApiError ? e.message : "The installer list couldn't be loaded."));

  useEffect(() => {
    fetchCatalogue();
    // A signed-in family with an unfinished step continues where they left off (the tracker links here).
    if (!resumeRequested) return;
    if (getSession()?.user.role !== "household") {
      window.location.replace("/get-started/");
      return;
    }
    loadMine()
      .then((mine) => {
        const next = stepFor(mine);
        if (!next) return window.location.replace(TRACKER);
        setView(mine);
        setPath(mine.path);
        setPayment(mine.payment);
        setPackageId(mine.package?.id ?? null);
        setBrand(mine.inverter.brand ?? "");
        setSerial(mine.inverter.serial ?? "");
        setStep(next);
      })
      .catch(() => undefined)
      .finally(() => setResumed(true));
  }, [resumeRequested]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  /** Moves to a step: clears the old error, scrolls up and puts keyboard focus on the new heading. */
  function go(next: Step) {
    setError("");
    setStep(next);
    window.setTimeout(() => {
      top.current?.scrollIntoView({ block: "start" });
      document.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    }, 0);
  }

  async function run(key: string, task: () => Promise<void>) {
    setError("");
    setBusy(key);
    try {
      await task();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  /** After each saved answer: the next family step, or the tracker once the request has gone. */
  function advance(next: OnboardingView) {
    setView(next);
    const target = stepFor(next);
    if (target) go(target);
    else router.push(TRACKER);
  }

  const pkg: Package | null = catalogue?.installers.flatMap((i) => i.packages).find((p) => p.id === packageId) ?? null;
  const pkgInstaller = pkg ? catalogue?.installers.find((i) => i.id === pkg.installer_id) ?? null : null;

  /* ───────── Phone, code and account ───────── */

  const sendCode = () =>
    run("phone", async () => {
      const result = await startPhone(phone);
      setMasked(result.phone);
      if (result.next === "signin") {
        setExisting(true);
        return;
      }
      setExisting(false);
      setDemoCode(result.demo_code ?? null);
      setCode("");
      setResendIn(RESEND_SECONDS);
      if (step !== "code") go("code");
    });

  const checkCode = (value: string) =>
    run("code", async () => {
      try {
        const result = await verifyPhone(phone, value);
        setSetupToken(result.setup_token);
        go("account");
      } catch (e) {
        setCode("");
        throw e;
      }
    });

  function submitAccount(event: FormEvent) {
    event.preventDefault();
    if (pin.length !== 4 || weakPin(pin)) {
      setPinError(pin.length !== 4 ? "Choose a 4-digit PIN." : "That PIN is too easy to guess. Avoid repeats like 1111 and runs like 1234.");
      return;
    }
    if (pin !== confirmPin) {
      setPinError("Those PINs don't match. Enter the same 4 digits twice.");
      return;
    }
    run("account", async () => {
      try {
        const created = await createAccount({
          setup_token: setupToken,
          pin,
          name,
          area,
          path: path!,
          ...(path === "need" ? { package_id: packageId!, payment: payment! } : {}),
        });
        advance(created);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // The verified code is only good for a short while: start the phone step again.
          setCode("");
          go("phone");
        }
        throw e;
      }
    });
  }

  /* ───────── Screens ───────── */

  let screen: ReactNode;
  const wide = step === "catalog";

  if (resuming) {
    screen = <p className="flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" /> Picking up where you left off…</p>;
  } else if (step === "welcome") {
    screen = (
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-leaf">For families in Lagos</p>
        <Heading sub="KlimateX reads your solar inverter, counts the petrol your generator no longer burns, and pays your family for the carbon it keeps out of the air.">
          Solar that pays your family back
        </Heading>
        <div className="mt-8 space-y-3">
          <Choice icon={<CircleHelp size={22} />} title="What is KlimateX?" body="A one-minute explainer." onClick={() => go("explain")} />
          <Choice icon={<Sun size={22} />} title="Get started" body="Find solar for your home, or link the solar you already have. No sign-up until you've seen what you get." onClick={() => go("triage")} />
          <Link
            href={links.signIn}
            className="flex w-full items-start gap-4 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-forest/40 hover:bg-[#fafcf9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30 sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint text-forest"><LogIn size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-ink">I have an account</span>
              <span className="mt-0.5 block text-[14px] leading-snug text-body">Sign in with your phone number and PIN.</span>
            </span>
            <ArrowRight size={18} className="mt-1 shrink-0 text-muted" aria-hidden />
          </Link>
        </div>
      </section>
    );
  } else if (step === "explain") {
    screen = (
      <section>
        <BackButton onClick={() => go("welcome")} />
        <Heading>What is KlimateX?</Heading>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-body">
          <p>
            KlimateX connects your home&apos;s solar inverter to a carbon record. Every day it reads how much power your panels made and works out the petrol a generator
            would have burned to make it.
          </p>
          <p>
            Those savings are checked, turned into carbon credits and sold to companies. Half of what they pay goes to your family, through Access Bank.
          </p>
        </div>
        <ul className="mt-6 space-y-3">
          {[
            { icon: Sun, text: "Your grade and savings come from your own meter readings, not guesses." },
            { icon: ShieldCheck, text: "Nine automatic checks and an independent verifier confirm the savings before anything is sold." },
            { icon: Wallet, text: "Your share is paid to your Access wallet, your bank, or straight into your solar loan." },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 rounded-xl bg-mint/60 px-4 py-3 text-[14.5px] text-ink">
              <Icon size={18} className="mt-0.5 shrink-0 text-forest" aria-hidden /> {text}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => go("triage")} className={`${primaryButton} mt-8 w-full sm:w-auto`}>
          <Busy busy={false}>Get started</Busy>
        </button>
      </section>
    );
  } else if (step === "triage") {
    screen = (
      <section>
        <BackButton onClick={() => go("welcome")} />
        <Heading sub="Either way, you'll see what you get before we ask for your number.">Do you already have solar, or do you need it?</Heading>
        <div className="mt-8 space-y-3">
          <Choice
            icon={<Wrench size={22} />}
            title="I need solar"
            body="See every KlimateX installer's packages and prices, with what each one could save you."
            onClick={() => {
              setPath("need");
              go("catalog");
            }}
          />
          <Choice
            icon={<Sun size={22} />}
            title="I already have solar"
            body="Link your inverter and start earning from the solar you already paid for."
            onClick={() => {
              setPath("have");
              go("perks");
            }}
          />
        </div>
      </section>
    );
  } else if (step === "catalog") {
    screen = (
      <section>
        <BackButton onClick={() => go("triage")} />
        <Heading sub="Every listed installer and package at once. Pick the one that fits your home; the installer confirms the price after a survey.">Solar packages near you</Heading>
        {!catalogue ? (
          catalogueError ? (
            <div className="mt-6 space-y-3"><InlineError message={catalogueError} /><button type="button" onClick={fetchCatalogue} className={secondaryButton}>Try again</button></div>
          ) : (
            <p className="mt-6 flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" /> Loading installers…</p>
          )
        ) : (
          <>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white px-5 py-4">
                <dt className="text-[13px] text-body">All packages</dt>
                <dd className="mt-0.5 text-[18px] font-semibold tracking-tight">{priceRange(...catalogue.price_range_naira)}</dd>
              </div>
              <div className="rounded-2xl border border-forest/20 bg-mint px-5 py-4">
                <dt className="text-[13px] text-body">A typical family home</dt>
                <dd className="mt-0.5 text-[18px] font-semibold tracking-tight text-forest">{priceRange(...catalogue.family_home_range_naira)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-xl border border-dashed border-[#e3a600]/60 bg-[#fdf6e3] px-4 py-3 text-[13.5px] text-[#633806]">{catalogue.note}</p>

            <div className="mt-8 space-y-8">
              {catalogue.installers.map((installer) => (
                <section key={installer.id} aria-labelledby={`installer-${installer.id}`} className="rounded-2xl border border-line bg-[#fbfcfa] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <h2 id={`installer-${installer.id}`} className="text-[18px] font-semibold tracking-tight">{installer.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1 text-[13px] text-body"><MapPin size={13} aria-hidden /> {installer.area} · {installer.accreditation_id}</p>
                    </div>
                    <InstallerBadge installer={installer} />
                  </div>
                  <p className="mt-2 text-[14px] text-body">{installer.blurb}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {installer.packages.map((p) => (
                      <article key={p.id} className="flex flex-col rounded-xl border border-line bg-white p-4">
                        <h3 className="text-[16px] font-semibold">{p.name}</h3>
                        <p className="mt-0.5 text-[12.5px] text-body">{packageSpec(p)}</p>
                        <p className="mt-2 text-[13.5px] text-ink"><span className="text-body">Powers:</span> {p.powers}</p>
                        <p className="mt-3 text-[19px] font-semibold tracking-tight text-forest">{priceRange(p.price_min_naira, p.price_max_naira)}</p>
                        <div className="mt-3 flex-1"><EstimateFigures estimate={p.estimate} compact /></div>
                        <button
                          type="button"
                          onClick={() => {
                            setPackageId(p.id);
                            go("package");
                          }}
                          aria-label={`Choose ${p.name} from ${installer.name}`}
                          className={`${secondaryButton} mt-4 h-11 w-full border-forest/30 text-forest`}
                        >
                          Choose this package
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    );
  } else if (step === "package" && pkg && pkgInstaller && catalogue) {
    screen = (
      <section>
        <BackButton onClick={() => go("catalog")}>All packages</BackButton>
        <Heading sub={`From ${pkgInstaller.name}, ${pkgInstaller.area}.`}>{pkg.name}</Heading>
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2"><InstallerBadge installer={pkgInstaller} /></div>
          <p className="mt-3 text-[13px] text-body">Price range</p>
          <p className="text-[26px] font-semibold tracking-tight text-forest">{priceRange(pkg.price_min_naira, pkg.price_max_naira)}</p>
          <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-[14px] sm:grid-cols-2">
            <div><dt className="text-body">System</dt><dd className="font-medium">{packageSpec(pkg)}</dd></div>
            <div><dt className="text-body">Panel size</dt><dd className="font-medium">{pkg.panel_kwp} kWp</dd></div>
            <div className="sm:col-span-2"><dt className="text-body">What it powers</dt><dd className="font-medium">{pkg.powers}</dd></div>
          </dl>
        </div>
        <div className="mt-4"><EstimateFigures estimate={pkg.estimate} /></div>
        <p className="mt-3 text-[13px] text-muted">{catalogue.note}</p>
        <button type="button" onClick={() => go("payment")} className={`${primaryButton} mt-8 w-full sm:w-auto`}>
          <Busy busy={false}>Continue with this package</Busy>
        </button>
      </section>
    );
  } else if (step === "payment" && pkg) {
    screen = (
      <section>
        <BackButton onClick={() => go("package")} />
        <Heading sub={`${pkg.name}: ${priceRange(pkg.price_min_naira, pkg.price_max_naira)}. You can still change your mind before you accept the quote.`}>How will you pay?</Heading>
        <div className="mt-8 space-y-3">
          <Choice
            icon={<Coins size={22} />}
            title="Cash"
            body="Pay the installer directly once you accept their quote."
            selected={payment === "cash"}
            onClick={() => {
              setPayment("cash");
              go("phone");
            }}
          />
          <Choice
            icon={<Landmark size={22} />}
            title="Loan required"
            body="After you create your account, a quick Access Bank pre-check shows how much you could borrow. Your carbon income can help repay it."
            selected={payment === "loan"}
            onClick={() => {
              setPayment("loan");
              go("phone");
            }}
          />
        </div>
      </section>
    );
  } else if (step === "perks" && path === "have") {
    const perks = [
      { icon: BellRing, title: "Alerts that save your system", body: "We tell you when output drops or your inverter goes offline." },
      { icon: Recycle, title: "A trade-in for your generator", body: "Hand in the generator you kept and a licensed recycler scraps it." },
      { icon: FileBadge, title: "A grade and certificate", body: "An A–G Home Energy Certificate measured from your own inverter." },
      { icon: Landmark, title: "Upgrade loans priced on your data", body: "More panels or a bigger battery, priced on how your home actually performs." },
      { icon: Coins, title: "Carbon payouts", body: "From the day you join, never backdated, and only once the verifier confirms your home qualifies." },
    ];
    screen = (
      <section>
        <BackButton onClick={() => go("triage")} />
        <Heading sub="Link your inverter and KlimateX starts reading it every day.">Your solar can do more for you</Heading>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {perks.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-forest"><Icon size={19} aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-body">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        {catalogue && <div className="mt-4"><EstimateFigures estimate={catalogue.options.estimate_existing_solar} title="A typical 1.6 kWp home system, in a year" /></div>}
        <button type="button" onClick={() => go("phone")} className={`${primaryButton} mt-8 w-full sm:w-auto`}>
          <Busy busy={false}>Create my account</Busy>
        </button>
      </section>
    );
  } else if (step === "phone") {
    screen = (
      <section>
        <BackButton onClick={() => go(path === "have" ? "perks" : "payment")} />
        <Heading sub="We'll text you a 6-digit code. This number becomes how you sign in.">What&apos;s your phone number?</Heading>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            sendCode();
          }}
        >
          <div>
            <label htmlFor="signup-phone" className="text-sm font-medium text-ink">Phone number</label>
            <div className="relative mt-1.5">
              <Phone size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="signup-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setExisting(false);
                  setError("");
                }}
                placeholder="0803 123 4567"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "signup-phone-error" : undefined}
                className={`${fieldClass} pl-11`}
              />
            </div>
          </div>
          <InlineError id="signup-phone-error" message={error} />
          {existing && (
            <div role="status" className="rounded-xl border border-forest/20 bg-mint px-4 py-3 text-sm text-ink">
              <p><strong>{masked}</strong> already has a KlimateX account.</p>
              <Link href={links.signIn} className="mt-1 inline-flex items-center gap-1 font-medium text-leaf hover:underline">Sign in instead <ArrowRight size={14} aria-hidden /></Link>
            </div>
          )}
          <button type="submit" disabled={busy === "phone"} className={`${primaryButton} w-full`}>
            <Busy busy={busy === "phone"}>{busy === "phone" ? "Sending code" : "Send my code"}</Busy>
          </button>
        </form>
      </section>
    );
  } else if (step === "code") {
    screen = (
      <section>
        <BackButton onClick={() => go("phone")}>Use a different number</BackButton>
        <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-forest ring-1 ring-forest/10"><MessageSquareText size={22} aria-hidden /></span>
        <Heading sub={`We sent a 6-digit code to ${masked}. It works for 10 minutes.`}>Check your messages</Heading>
        {demoCode && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#e3a600]/60 bg-[#fdf6e3] px-4 py-3 text-sm text-[#633806]">
            <span>
              Sandbox: no SMS is sent. Your code is <span className="font-mono font-semibold tracking-wider">{demoCode}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setCode(demoCode);
                checkCode(demoCode);
              }}
              className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[13px] font-medium text-ink ring-1 ring-[#e3a600]/40 hover:bg-[#fff9ea]"
            >
              Fill it in
            </button>
          </div>
        )}
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length === 6) checkCode(code);
          }}
        >
          <CodeInput length={6} label="Code" value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={checkCode} invalid={Boolean(error)} disabled={busy === "code"} />
          <InlineError message={error} />
          <button type="submit" disabled={busy === "code" || code.length !== 6} className={`${primaryButton} w-full`}>
            <Busy busy={busy === "code"}>{busy === "code" ? "Checking" : "Continue"}</Busy>
          </button>
        </form>
        <p className="mt-5 text-sm text-body">
          No code?{" "}
          {resendIn > 0 ? (
            <span className="text-muted">Send again in {resendIn}s</span>
          ) : (
            <button type="button" onClick={sendCode} disabled={busy !== null} className="font-medium text-leaf hover:underline">Send a new code</button>
          )}
        </p>
      </section>
    );
  } else if (step === "account") {
    screen = (
      <section>
        <Heading sub="Three quick things and your account is ready.">Set up your account</Heading>
        <form className="mt-8 space-y-6" onSubmit={submitAccount}>
          <div>
            <label htmlFor="signup-name" className="text-sm font-medium text-ink">Your name</label>
            <div className="relative mt-1.5">
              <UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="signup-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="For example, Mama Tunde" className={`${fieldClass} pl-11`} />
            </div>
          </div>
          <div>
            <label htmlFor="signup-area" className="text-sm font-medium text-ink">Area the home is in</label>
            <div className="relative mt-1.5">
              <Home size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="signup-area" required value={area} onChange={(e) => setArea(e.target.value)} autoComplete="address-level2" maxLength={60} placeholder="For example, Surulere" className={`${fieldClass} pl-11`} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Create a 4-digit PIN</p>
            <p className="mt-0.5 text-[13px] text-body">You&apos;ll use it with your phone number to sign in. Avoid 1234 or your birthday.</p>
            <div className="mt-3 max-w-[260px]">
              <CodeInput length={4} secret autoFocus={false} label="New PIN" value={pin} onChange={(v) => { setPin(v); setPinError(""); }} invalid={Boolean(pinError)} disabled={busy === "account"} />
            </div>
            <p className="mt-4 text-sm font-medium text-ink">Enter the PIN again</p>
            <div className="mt-2 max-w-[260px]">
              <CodeInput length={4} secret autoFocus={false} label="Confirm PIN" value={confirmPin} onChange={(v) => { setConfirmPin(v); setPinError(""); }} invalid={Boolean(pinError)} disabled={busy === "account"} />
            </div>
          </div>
          <InlineError message={pinError} />
          <InlineError message={error}>
            {error.includes("already has a KlimateX account") && (
              <> <Link href={links.signIn} className="font-medium underline">Sign in</Link></>
            )}
          </InlineError>
          <button type="submit" disabled={busy === "account"} className={`${primaryButton} w-full`}>
            <Busy busy={busy === "account"}>{busy === "account" ? "Creating your account" : "Create my account"}</Busy>
          </button>
        </form>
      </section>
    );
  } else if (step === "request" && view) {
    const installerName = view.installer?.name ?? "your installer";
    const loan = view.payment === "loan";
    const banded = Boolean(view.loan?.income_band);
    const minPrice = view.package?.price_min_naira ?? 0;
    screen = (
      <section>
        <Heading sub={loan ? "First a quick, no-obligation Access Bank pre-check. Then your request goes to the installer." : "The installer accepts in the app, books a survey and sends you a quote."}>
          {loan ? "Your loan pre-check" : `Send your request to ${installerName}`}
        </Heading>
        {view.package && (
          <div className="mt-6 rounded-2xl border border-line bg-white p-4">
            <p className="text-[15px] font-semibold">{view.package.name} <span className="font-normal text-body">· {installerName}</span></p>
            <p className="mt-0.5 text-[13px] text-body">{packageSpec(view.package)}</p>
            <p className="mt-1 text-[15px] font-semibold text-forest">{priceRange(view.package.price_min_naira, view.package.price_max_naira)} · {loan ? "Loan required" : "Cash"}</p>
          </div>
        )}
        {loan && catalogue && (
          <div className="mt-6">
            <p className="text-[15px] font-medium text-ink" id="income-label">Roughly what does your household earn a month?</p>
            <div role="group" aria-labelledby="income-label" className="mt-3 grid gap-2">
              {catalogue.options.income_bands.map((band) => {
                const chosen = view.loan?.income_band === band.key;
                return (
                  <button
                    key={band.key}
                    type="button"
                    aria-pressed={chosen}
                    disabled={busy !== null}
                    onClick={() => run(`band-${band.key}`, async () => setView(await saveAnswers({ income_band: band.key })))}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30 disabled:opacity-70 ${
                      chosen ? "border-forest bg-mint font-semibold text-forest ring-1 ring-forest" : "border-line bg-white text-ink hover:border-forest/40"
                    }`}
                  >
                    {band.label}
                    {busy === `band-${band.key}` ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : chosen ? <Check size={17} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
            {banded && view.loan?.limit_naira !== null && view.loan && (
              <div role="status" className="mt-4 rounded-2xl border border-forest/20 bg-mint p-4">
                <p className="text-[13px] text-body">Access could lend you up to</p>
                <p className="text-[24px] font-semibold tracking-tight text-forest">{formatNaira(view.loan.limit_naira ?? 0)}</p>
                <p className="text-[14px] text-ink">About {formatNaira(view.loan.monthly_naira ?? 0)} a month over {view.loan.months} months.</p>
                <p className="mt-2 text-[13px] leading-relaxed text-body">
                  {(view.loan.limit_naira ?? 0) < minPrice
                    ? "That covers part of the price. You'd pay the rest in cash. "
                    : "That could cover the whole price. "}
                  This is a pre-check, not an offer: Access decides when you accept the quote. The demo sandbox approves loans up to ₦1,000,000 and refers larger ones for review.
                </p>
              </div>
            )}
          </div>
        )}
        <div className="mt-6"><InlineError message={error} /></div>
        <button
          type="button"
          disabled={busy !== null || (loan && !banded)}
          onClick={() => run("submit", async () => advance(await submitRequest()))}
          className={`${primaryButton} mt-4 w-full`}
        >
          <Busy busy={busy === "submit"}>{`Send request to ${installerName}`}</Busy>
        </button>
        {loan && !banded && <p className="mt-2 text-center text-[13px] text-muted">Choose an income range first.</p>}
      </section>
    );
  } else if (step === "inverter" && view && catalogue) {
    screen = (
      <section>
        <Heading sub="Find the brand and serial number on the sticker on the side of your inverter. Your installer checks it at the visit.">Link your inverter</Heading>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            run("inverter", async () => advance(await saveAnswers({ inverter_brand: brand, inverter_serial: serial })));
          }}
        >
          <div>
            <label htmlFor="inverter-brand" className="text-sm font-medium text-ink">Brand</label>
            <select id="inverter-brand" required value={brand} onChange={(e) => setBrand(e.target.value)} className={`${fieldClass} mt-1.5`}>
              <option value="" disabled>Choose a brand</option>
              {catalogue.options.inverter_brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="inverter-serial" className="text-sm font-medium text-ink">Serial number</label>
            <input
              id="inverter-serial"
              required
              value={serial}
              onChange={(e) => { setSerial(e.target.value.toUpperCase()); setError(""); }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              placeholder="For example, GRW-2291-7741"
              aria-invalid={Boolean(error)}
              aria-describedby="serial-help"
              className={`${fieldClass} mt-1.5 font-mono tracking-wide`}
            />
            <p id="serial-help" className="mt-1.5 text-[12.5px] text-muted">6 to 40 letters and numbers. Each inverter can be linked to one home only.</p>
          </div>
          <InlineError message={error} />
          <button type="submit" disabled={busy !== null || !brand || serial.trim().length < 6} className={`${primaryButton} w-full`}>
            <Busy busy={busy === "inverter"}>Save and continue</Busy>
          </button>
        </form>
      </section>
    );
  } else if (step === "generator" && view && catalogue) {
    screen = (
      <section>
        <BackButton onClick={() => go("inverter")}>Inverter details</BackButton>
        <Heading sub="Your installer records this at the check visit.">What about your generator?</Heading>
        <div className="mt-8 space-y-3">
          {catalogue.options.generator.map((g) => (
            <Choice
              key={g.key}
              icon={g.key === "trade_in" ? <Recycle size={22} /> : g.key === "backup" ? <Fuel size={22} /> : <Check size={22} />}
              title={g.label}
              body={GENERATOR_HELP[g.key] ?? ""}
              selected={view.generator === g.key}
              busy={busy === `gen-${g.key}`}
              onClick={() => run(`gen-${g.key}`, async () => advance(await saveAnswers({ generator: g.key })))}
            />
          ))}
        </div>
        <div className="mt-4"><InlineError message={error} /></div>
      </section>
    );
  } else if (step === "installer" && view && catalogue) {
    screen = (
      <section>
        <BackButton onClick={() => go("generator")}>Generator</BackButton>
        <Heading sub="They confirm your inverter serial, take a GPS-tagged photo and note your generator. This stops anyone linking an inverter that isn't theirs. If your own installer is listed, pick them.">
          Pick an installer for your check visit
        </Heading>
        <form
          className="mt-8 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (installerId) run("submit", async () => advance(await submitRequest(installerId)));
          }}
        >
          <fieldset className="space-y-3">
            <legend className="sr-only">Installer</legend>
            {catalogue.installers.map((i) => (
              <label
                key={i.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-leaf/30 ${
                  installerId === i.id ? "border-forest bg-mint ring-1 ring-forest" : "border-line bg-white hover:border-forest/40"
                }`}
              >
                <input type="radio" name="installer" value={i.id} checked={installerId === i.id} onChange={() => setInstallerId(i.id)} className="mt-1 h-4 w-4 accent-[#0b3f2a]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold">{i.name}</span>
                    <InstallerBadge installer={i} />
                  </span>
                  <span className="mt-0.5 block text-[13px] text-body">{i.area} · {i.blurb}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="pt-2"><InlineError message={error} /></div>
          <button type="submit" disabled={busy !== null || !installerId} className={`${primaryButton} w-full`}>
            <Busy busy={busy === "submit"}>Book my check visit</Busy>
          </button>
        </form>
      </section>
    );
  } else {
    // A step whose data isn't there (for example the catalogue failed): start the path again.
    screen = (
      <section>
        <Heading>Let&apos;s start again</Heading>
        <button type="button" onClick={() => go("welcome")} className={`${primaryButton} mt-6`}><Busy busy={false}>Back to the start</Busy></button>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#eff5ee,transparent_55%)]">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <Link href="/" aria-label="KlimateX home">
          <Image src="/logo.svg" alt="KlimateX" width={130} height={32} priority className="h-7 w-auto" />
        </Link>
        {!view && (
          <Link href={links.signIn} className="text-sm font-medium text-body hover:text-ink">I have an account</Link>
        )}
      </header>
      <main ref={top} className={`mx-auto scroll-mt-4 px-4 pb-20 pt-10 sm:px-6 ${wide ? "max-w-[1100px]" : "max-w-[640px]"}`}>
        {path && !resuming && <Progress path={path} step={step} loan={payment === "loan"} />}
        {screen}
      </main>
    </div>
  );
}
