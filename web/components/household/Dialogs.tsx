"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { ApiError } from "@/lib/api";
import { checkLabel, destinationLabel, fetchMessage, longDate, periodLabel, type Check, type Payout } from "@/lib/household";
import { formatNaira } from "@/lib/marketplace";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && ref.current?.close()}
      className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-2xl bg-white p-0 text-ink shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="-mr-1.5 -mt-1 rounded-md p-1.5 text-muted hover:bg-mint hover:text-ink">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export const verifySerial = (serial: string) => window.dispatchEvent(new CustomEvent("klimatex:verify", { detail: { serial } }));

export function PayoutDialog({ payout, onClose }: { payout: Payout; onClose: () => void }) {
  return (
    <Modal title="Payout details" onClose={onClose}>
      <p className="mt-1 text-[32px] font-semibold tracking-tight text-forest">{formatNaira(payout.amountNaira)}</p>
      <dl className="mt-3">
        <Row label="Paid into" value={destinationLabel(payout.destination)} />
        <Row label="Paid on" value={longDate(payout.paidOn)} />
        <Row label="Audit period" value={periodLabel(payout.period)} />
        <Row label="Your share of the credits" value={<Co2Text text={`${payout.tonnes.toFixed(2)} tCO₂e`} />} />
        <Row label="Credits sold" value={payout.serials.length} />
        <Row label="Reference" value={<span className="font-mono text-[12px]">{payout.reference}</span>} />
      </dl>
      <p className="mt-3 text-xs text-muted">Each credit sold carries a slice of your home&apos;s savings. See them all under Payouts › Credits &amp; serials.</p>
    </Modal>
  );
}

export function HeldDialog({ siteId, checks, lang, onClose }: { siteId: number; checks: Check[]; lang: string; onClose: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const failed = checks.filter((c) => c.result !== "pass");

  useEffect(() => {
    fetchMessage(siteId, lang)
      .then(setMessage)
      .catch((e) => setError(e instanceof ApiError ? e.message : "The explanation couldn't be loaded."));
  }, [siteId, lang]);

  return (
    <Modal title="Why this period is on hold" onClose={onClose}>
      <div className="mt-3 rounded-xl bg-mint p-4 text-sm leading-relaxed text-ink">
        {message ?? (error ? <span className="text-red-800">{error}</span> : <span className="inline-flex items-center gap-2 text-body"><LoaderCircle size={15} className="animate-spin" /> Writing your explanation</span>)}
      </div>
      <p className="mt-4 text-sm font-medium">Checks that need attention</p>
      <ul className="mt-2 space-y-2">
        {failed.map((check) => (
          <li key={check.name} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm">
            <span className="font-medium">{checkLabel(check.name)}</span>
            <span className="rounded bg-[#faeeda] px-1.5 py-0.5 text-[11px] font-medium text-[#633806]">{check.result}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">An auditor reviews every held home. Nothing is paid for this period until it is cleared.</p>
    </Modal>
  );
}
