"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound, LoaderCircle, MessageSquareText, Phone, TriangleAlert, UserRound } from "lucide-react";
import { ApiError, phoneComplete, phoneSignIn, phoneStart, phoneVerify } from "@/lib/api";
import { homeFor } from "@/lib/workspaces";
import { CodeInput } from "./CodeInput";

type Step = "phone" | "pin" | "code" | "setup";

/** Synthetic sandbox homes. Numbers follow the seed: 0700 001 00NN is Home NN. */
const DEMO_HOMES = [
  { label: "Adaeze, Home 12", phone: "0700 001 0012" },
  { label: "Home 07, first visit", phone: "0700 001 0007" },
];

const RESEND_SECONDS = 30;

/** Mirrors the server's rule so a weak PIN is caught before the family types it twice. */
const RUNS = "0123456789";
export const weakPin = (pin: string) =>
  new Set(pin).size === 1 || RUNS.includes(pin) || [...RUNS].reverse().join("").includes(pin) || ["1212", "2580", "1004", "2000", "2026"].includes(pin);

const field =
  "h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-[15px] text-ink outline-none transition placeholder:text-muted/80 focus:border-leaf focus:ring-4 focus:ring-leaf/12";

function PrimaryButton({ busy, children, disabled = false }: { busy: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-medium text-white shadow-[0_10px_24px_-12px_rgb(11_63_42/0.7)] transition hover:bg-forest-hover active:scale-[0.99] disabled:opacity-60"
    >
      {busy && <LoaderCircle size={18} className="animate-spin" />}
      {children}
      {!busy && <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p id="phone-error" role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {message}
    </p>
  );
}

function StepHeading({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-forest ring-1 ring-forest/10">{icon}</span>
      <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.03em] text-ink">{title}</h1>
      <p className="mt-1.5 text-[15px] text-body">{children}</p>
    </>
  );
}

export function PhoneSignIn() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [returning, setReturning] = useState(false);
  const [name, setName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function run(task: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const begin = (forgotPin = false) =>
    run(async () => {
      const result = await phoneStart(phone, forgotPin);
      setMasked(result.phone);
      if (result.next === "pin") {
        setPin("");
        setStep("pin");
        return;
      }
      setDemoCode(result.demo_code ?? null);
      setCode("");
      setResendIn(RESEND_SECONDS);
      setStep("code");
    });

  const signInWithPin = (value: string) =>
    run(async () => {
      try {
        const user = await phoneSignIn(phone, value);
        router.push(homeFor(user.role));
      } catch (e) {
        setPin("");
        throw e;
      }
    });

  const checkCode = (value: string) =>
    run(async () => {
      try {
        const result = await phoneVerify(phone, value);
        setSetupToken(result.setup_token);
        setReturning(result.returning);
        setName(result.name.startsWith("Household ") ? "" : result.name);
        setNewPin("");
        setConfirmPin("");
        setConfirming(false);
        setStep("setup");
      } catch (e) {
        setCode("");
        throw e;
      }
    });

  const finish = (pinValue: string) =>
    run(async () => {
      try {
        const user = await phoneComplete(setupToken, pinValue, name);
        router.push(returning ? homeFor(user.role) : "/app/welcome/");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // The setup window closed: go back to the start rather than leave a dead form.
          setStep("phone");
        } else {
          setNewPin("");
          setConfirmPin("");
          setConfirming(false);
        }
        throw e;
      }
    });

  function confirmChosenPin(value: string) {
    if (value !== newPin) {
      setError("Those PINs don't match. Choose your PIN again.");
      setNewPin("");
      setConfirmPin("");
      setConfirming(false);
      return;
    }
    finish(value);
  }

  function restart() {
    setStep("phone");
    setError("");
    window.setTimeout(() => phoneRef.current?.focus(), 0);
  }

  const back = (
    <button type="button" onClick={restart} className="mb-6 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-body transition hover:bg-mint hover:text-ink">
      <ArrowLeft size={15} /> Use a different number
    </button>
  );

  if (step === "pin") {
    return (
      <div>
        {back}
        <StepHeading icon={<KeyRound size={22} />} title="Enter your PIN">Signing in as {masked}.</StepHeading>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (pin.length === 4) signInWithPin(pin);
          }}
        >
          <div className="max-w-[260px]">
            <CodeInput length={4} secret label="PIN" value={pin} onChange={(v) => { setPin(v); setError(""); }} onComplete={signInWithPin} invalid={Boolean(error)} disabled={busy} />
          </div>
          <ErrorNote message={error} />
          <PrimaryButton busy={busy} disabled={pin.length !== 4}>{busy ? "Signing in" : "Sign in"}</PrimaryButton>
        </form>
        <button type="button" onClick={() => begin(true)} disabled={busy} className="mt-5 text-sm font-medium text-leaf hover:underline">
          Forgot your PIN? Get a code to reset it
        </button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div>
        {back}
        <StepHeading icon={<MessageSquareText size={22} />} title="Check your messages">We sent a 6-digit code to {masked}. It works for 10 minutes.</StepHeading>
        {demoCode && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#e3a600]/60 bg-[#fdf6e3] px-4 py-3 text-sm text-[#633806]">
            <span>
              Sandbox: no SMS is sent. Your code is <span className="font-mono font-semibold tracking-wider">{demoCode}</span>
            </span>
            <button type="button" onClick={() => { setCode(demoCode); checkCode(demoCode); }} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[13px] font-medium text-ink ring-1 ring-[#e3a600]/40 hover:bg-[#fff9ea]">
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
          <CodeInput length={6} label="Code" value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={checkCode} invalid={Boolean(error)} disabled={busy} />
          <ErrorNote message={error} />
          <PrimaryButton busy={busy} disabled={code.length !== 6}>{busy ? "Checking" : "Continue"}</PrimaryButton>
        </form>
        <p className="mt-5 text-sm text-body">
          No code?{" "}
          {resendIn > 0 ? (
            <span className="text-muted">Send again in {resendIn}s</span>
          ) : (
            <button type="button" onClick={() => begin(true)} disabled={busy} className="font-medium text-leaf hover:underline">Send a new code</button>
          )}
        </p>
      </div>
    );
  }

  if (step === "setup") {
    return (
      <div>
        <StepHeading icon={<KeyRound size={22} />} title={returning ? "Choose a new PIN" : "Set up your account"}>
          {returning ? "Pick 4 digits you'll remember. Don't use your birthday or 1234." : "Two quick things, then you're in."}
        </StepHeading>
        <div className="mt-8 space-y-6">
          {!returning && (
            <div>
              <label htmlFor="your-name" className="text-sm font-medium text-ink">What should we call you?</label>
              <div className="relative mt-1.5">
                <UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input id="your-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="For example, Mama Tunde" maxLength={60} className={`${field} border-line`} />
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-ink">{confirming ? "Enter your PIN again" : returning ? "New 4-digit PIN" : "Create a 4-digit PIN"}</p>
            <p className="mt-0.5 text-[13px] text-body">{confirming ? "Just to be sure." : "You'll use it every time you sign in."}</p>
            <div className="mt-3 max-w-[260px]">
              {confirming ? (
                <CodeInput key="confirm" length={4} secret label="Confirm PIN" value={confirmPin} onChange={(v) => { setConfirmPin(v); setError(""); }} onComplete={confirmChosenPin} invalid={Boolean(error)} disabled={busy} />
              ) : (
                <CodeInput
                  key="choose"
                  length={4}
                  secret
                  autoFocus={returning}
                  label="New PIN"
                  value={newPin}
                  onChange={(v) => { setNewPin(v); setError(""); }}
                  onComplete={(value) => {
                    if (weakPin(value)) {
                      setError("That PIN is too easy to guess. Avoid repeats like 1111 and runs like 1234.");
                      setNewPin("");
                      return;
                    }
                    setConfirming(true);
                  }}
                  invalid={Boolean(error)}
                  disabled={busy}
                />
              )}
            </div>
          </div>
          <ErrorNote message={error} />
          {busy && (
            <p className="flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" /> Saving your PIN</p>
          )}
        </div>
      </div>
    );
  }

  function submitPhone(event: FormEvent) {
    event.preventDefault();
    begin();
  }

  return (
    <div>
      <StepHeading icon={<Phone size={22} />} title="Sign in to your home">Use the phone number your installer registered.</StepHeading>
      <form onSubmit={submitPhone} className="mt-8 space-y-5">
        <div>
          <label htmlFor="phone" className="text-sm font-medium text-ink">Phone number</label>
          <div className="relative mt-1.5">
            <Phone size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={phoneRef}
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError("");
              }}
              placeholder="0803 123 4567"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "phone-error" : undefined}
              className={`${field} ${error ? "border-red-300" : "border-line"}`}
            />
          </div>
        </div>
        <ErrorNote message={error} />
        <PrimaryButton busy={busy}>{busy ? "Checking" : "Continue"}</PrimaryButton>
      </form>

      <p className="mt-5 rounded-xl bg-mint/60 px-4 py-3 text-[13px] leading-relaxed text-body">
        <span className="font-medium text-ink">First time here?</span> Enter your number and we&apos;ll text you a code to set up your PIN. No password to remember.
      </p>

      <div className="mt-8">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /> Demo homes <span className="h-px flex-1 bg-line" />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {DEMO_HOMES.map((home) => (
            <button
              key={home.phone}
              type="button"
              onClick={() => {
                setPhone(home.phone);
                setError("");
                phoneRef.current?.focus();
              }}
              aria-pressed={phone === home.phone}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                phone === home.phone ? "border-forest bg-forest text-white" : "border-line bg-white text-body hover:border-forest/40 hover:text-ink"
              }`}
            >
              {home.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
