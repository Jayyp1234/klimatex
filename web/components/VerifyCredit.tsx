"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle, Search, X } from "lucide-react";
import { API_BASE } from "@/lib/links";

const OPEN_EVENT = "klimatex:verify";

type Credit = {
  serial: string;
  vintage: number;
  project: string;
  status: string;
  simulated: boolean;
  retired_for: string | null;
  retired_at: string | null;
  auditor: string | null;
  signed_at: string | null;
  home_months: unknown[];
  ledger_root: string;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "found"; credit: Credit };

export function VerifyButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {children}
    </button>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Not recorded";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

export function VerifyDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [serial, setSerial] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const check = useCallback(async (value: string) => {
    if (!/^[A-Za-z0-9-]+$/.test(value)) {
      setState({ kind: "error", message: "Enter a credit serial, for example KX-NG-2026-LAG01-000001." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const response = await fetch(`${API_BASE}/api/verify/${encodeURIComponent(value)}`);
      if (response.status === 404) {
        setState({ kind: "error", message: "No credit exists with that serial. Check it and try again." });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      setState({ kind: "found", credit: (await response.json()).data as Credit });
    } catch {
      setState({ kind: "error", message: "The registry can't be reached right now. Try again shortly." });
    }
  }, []);

  useEffect(() => {
    // An event may carry a serial, e.g. from a payout's credit list; it is looked up straight away.
    const open = (event: Event) => {
      ref.current?.showModal();
      const given = (event as CustomEvent<{ serial?: string }>).detail?.serial;
      if (given) {
        setSerial(given);
        void check(given);
      }
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [check]);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    await check(serial.trim());
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="verify-title"
      className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-2xl bg-white p-0 text-ink shadow-2xl"
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="verify-title" className="text-xl font-semibold tracking-tight">
              Verify a credit
            </h2>
            <p className="mt-1 text-sm text-body">Check any serial against the public registry.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="-mr-1.5 -mt-1 rounded-md p-1.5 text-muted hover:bg-mint hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={lookup} className="mt-5 flex gap-2">
          <label htmlFor="serial" className="sr-only">
            Credit serial
          </label>
          <input
            id="serial"
            value={serial}
            onChange={(event) => {
              setSerial(event.target.value);
              if (state.kind === "error") setState({ kind: "idle" });
            }}
            placeholder="KX-NG-2026-LAG01-000001"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 font-mono text-[13px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
          />
          <button
            type="submit"
            disabled={state.kind === "loading"}
            className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-hover disabled:opacity-70"
          >
            {state.kind === "loading" ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
            Verify
          </button>
        </form>

        {state.kind === "error" && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {state.message}
          </p>
        )}

        {state.kind === "found" && (
          <div className="mt-5" aria-live="polite">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-leaf">
              <CheckCircle2 size={18} /> Credit found in the registry
            </p>
            <dl>
              <Row label="Serial" value={<span className="font-mono text-[13px]">{state.credit.serial}</span>} />
              <Row label="Status" value={<span className="capitalize">{state.credit.status}</span>} />
              <Row label="Project and vintage" value={`${state.credit.project} · ${state.credit.vintage}`} />
              <Row label="Signed off by" value={state.credit.auditor ?? "Not signed"} />
              <Row label="Signed off on" value={formatDate(state.credit.signed_at)} />
              {state.credit.retired_for && <Row label="Retired for" value={state.credit.retired_for} />}
              {state.credit.retired_at && <Row label="Retired on" value={formatDate(state.credit.retired_at)} />}
              <Row label="Home-months behind it" value={state.credit.home_months.length} />
              <Row
                label="Ledger root"
                value={<span className="font-mono text-[13px]">{state.credit.ledger_root.slice(0, 12)}…</span>}
              />
            </dl>
            {state.credit.simulated && (
              <p className="mt-3 text-xs text-muted">Demonstration record issued in the sandbox.</p>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
