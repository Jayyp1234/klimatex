"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Eye, EyeOff, House, LoaderCircle, Lock, Mail, ShieldCheck, Sun, TriangleAlert } from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { ApiError, getSession, signIn } from "@/lib/api";
import { homeFor } from "@/lib/workspaces";
import { PhoneSignIn } from "./PhoneSignIn";

/** Synthetic sandbox accounts, so a presenter can sign in as any role without typing an address. */
const DEMO_ACCOUNTS = [
  { label: "Buyer", email: "buyer@demo.klimatex.test" },
  { label: "Auditor", email: "auditor@demo.klimatex.test" },
  { label: "Installer", email: "installer@demo.klimatex.test" },
  { label: "Lender", email: "lender@demo.klimatex.test" },
  { label: "Operations", email: "admin@demo.klimatex.test" },
];

const input =
  "h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-[15px] text-ink outline-none transition placeholder:text-muted/80 focus:border-leaf focus:ring-4 focus:ring-leaf/12";

function BrandPanel() {
  return (
    <section aria-hidden className="relative hidden overflow-hidden bg-forest lg:flex lg:flex-col">
      <Image src="/images/hero-home.webp" alt="" fill priority sizes="50vw" className="object-cover opacity-30 mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest/85 to-[#06281a]/95" />
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-lime/15 blur-3xl" />
      <div className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-[#ffc629]/10 blur-3xl" />

      <div className="relative flex flex-1 flex-col px-12 pb-12 pt-11 xl:px-16">
        <Link href="/" tabIndex={-1} className="w-fit rounded-xl bg-white px-3 py-2 shadow-sm">
          <Image src="/logo.svg" alt="KlimateX" width={130} height={32} className="h-7 w-auto" />
        </Link>

        <div className="my-auto max-w-[460px] pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-lime">Household carbon infrastructure</p>
          <h2 className="mt-4 text-[38px] font-semibold leading-[1.1] tracking-[-0.03em] text-white xl:text-[42px]">
            Every tonne measured.
            <br />
            Every naira traced.
          </h2>
          <p className="mt-4 max-w-[400px] text-[16px] leading-relaxed text-white/70">
            Families sign in with their phone. Companies and partners use their work email.
          </p>

          <div className="relative mt-8 h-[292px] xl:h-[230px] [@media(max-height:860px)]:h-[175px]">
            <div className="absolute left-0 top-0 w-[268px] rotate-[-3deg] rounded-2xl bg-white p-5 shadow-2xl shadow-black/30 transition duration-700 starting:translate-y-4 starting:opacity-0">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink">Home Energy Certificate</p>
                <span className="rounded-md bg-forest px-2 py-0.5 text-[11px] font-semibold text-white">Grade B</span>
              </div>
              <p className="mt-3 text-ink">
                <span className="text-[28px] font-semibold tracking-tight text-forest">2.1</span>{" "}
                <span className="text-[14px] font-medium"><Co2Text text="tCO₂e / year" /></span>
              </p>
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-body">
                <Sun size={14} className="shrink-0 text-[#e3a600]" /> 2,006 kWh of solar a year
              </div>
            </div>

            <div className="absolute right-0 top-[142px] w-[262px] rotate-[2.5deg] xl:top-[92px] [@media(max-height:860px)]:hidden rounded-2xl bg-white p-5 shadow-2xl shadow-black/30 transition delay-150 duration-700 starting:translate-y-4 starting:opacity-0">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-leaf">
                <BadgeCheck size={17} /> Credit retired
              </div>
              <p className="mt-2 font-mono text-[12px] text-ink">KX-NG-2026-LAG01-000001</p>
              <p className="mt-1 text-xs text-body">For Mama Nkechi Provisions Ltd</p>
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-body">
                <ShieldCheck size={14} className="text-leaf" /> Ledger chain intact
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/45">Sandbox environment. Households and figures are synthetic.</p>
      </div>
    </section>
  );
}

type Door = "home" | "work";

export function SignInForm() {
  const [door, setDoor] = useState<Door>("home");

  useEffect(() => {
    const session = getSession();
    if (session) {
      window.location.replace(homeFor(session.user.role));
      return;
    }
    // Links meant for companies (the marketplace, partner emails) open the work sign-in: /app/?as=work
    if (new URLSearchParams(window.location.search).get("as") === "work") queueMicrotask(() => setDoor("work"));
  }, []);

  const tab = (value: Door, label: string, Icon: typeof House) => (
    <button
      type="button"
      role="tab"
      aria-selected={door === value}
      onClick={() => setDoor(value)}
      className={`flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition ${
        door === value ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-body hover:text-ink"
      }`}
    >
      <Icon size={16} className="shrink-0" /> {label}
    </button>
  );

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="relative flex flex-col bg-[radial-gradient(circle_at_top_right,#eff5ee,transparent_55%)] px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="KlimateX home" className="lg:hidden">
            <Image src="/logo.svg" alt="KlimateX" width={130} height={32} priority className="h-7 w-auto" />
          </Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-body transition hover:bg-mint hover:text-ink">
            <ArrowLeft size={15} /> Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <div role="tablist" aria-label="Who is signing in" className="mb-9 flex gap-1 rounded-xl bg-[#eef2ee] p-1">
            {tab("home", "My home", House)}
            {tab("work", "Business", Building2)}
          </div>
          {door === "home" ? <PhoneSignIn /> : <EmailSignIn />}
        </div>

        <p className="text-center text-xs text-muted">
          {door === "home"
            ? "Trouble signing in? Call your installer, or reset your PIN with a text code."
            : "Trouble signing in? Ask your KlimateX administrator to reset your access."}
        </p>
      </main>
    </div>
  );
}

function EmailSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await signIn(email.trim(), password);
      setDone(true);
      router.push(homeFor(user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setBusy(false);
      passwordRef.current?.select();
    }
  }

  function chooseDemo(address: string) {
    setEmail(address);
    setError("");
    passwordRef.current?.focus();
  }

  const watchCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));
  const invalid = Boolean(error);

  return (
    <div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-forest ring-1 ring-forest/10">
            <Lock size={22} />
          </span>
          <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.03em] text-ink">Business &amp; staff sign-in</h1>
          <p className="mt-1.5 text-[15px] text-body">For buyers, installers, auditors, lenders and the KlimateX team.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-ink">Work email</label>
              <div className="relative mt-1.5">
                <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="name@company.com"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? "signin-error" : undefined}
                  className={`${input} ${invalid ? "border-red-300" : "border-line"}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
              <div className="relative mt-1.5">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  onKeyUp={watchCaps}
                  onKeyDown={watchCaps}
                  onBlur={() => setCapsLock(false)}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? "signin-error" : capsLock ? "caps-warning" : undefined}
                  className={`${input} pr-12 ${invalid ? "border-red-300" : "border-line"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-mint hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {capsLock && (
                <p id="caps-warning" className="mt-2 flex items-center gap-1.5 text-[13px] text-[#8a5a00]">
                  <TriangleAlert size={14} /> Caps Lock is on
                </p>
              )}
            </div>

            {error && (
              <p id="signin-error" role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-medium text-white shadow-[0_10px_24px_-12px_rgb(11_63_42/0.7)] transition hover:bg-forest-hover active:scale-[0.99] disabled:opacity-80"
            >
              {busy && <LoaderCircle size={18} className="animate-spin" />}
              {done ? "Opening your workspace" : busy ? "Signing in" : "Sign in"}
              {!busy && <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <div className="mt-9">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" /> Demo accounts <span className="h-px flex-1 bg-line" />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => chooseDemo(account.email)}
                  aria-pressed={email === account.email}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                    email === account.email ? "border-forest bg-forest text-white" : "border-line bg-white text-body hover:border-forest/40 hover:text-ink"
                  }`}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted">Fills in the email. Use the demo password your team was given.</p>
          </div>
    </div>
  );
}
