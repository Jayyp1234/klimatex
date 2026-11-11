"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle, Minus, Plus, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Co2Text } from "@/components/Co2Text";
import { RESERVATION_MINUTES, formatDate, formatNaira, type Credit, type Order, type Project } from "@/lib/marketplace";

const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-hover disabled:opacity-70";
const secondary = "rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-mint disabled:opacity-60";

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Try again.");

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
      className="m-auto w-[calc(100%-32px)] max-w-[460px] rounded-2xl bg-white p-0 text-ink shadow-2xl"
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

const Failure = ({ message }: { message: string }) => (message ? <p role="alert" className="mt-3 text-sm text-red-700">{message}</p> : null);

/** With one serial it reserves exactly that credit; with none it lets the buyer choose a quantity. */
export function ReserveDialog({ serial, available, projectName, price, onClose, onConfirm }: {
  serial: string | null;
  available: Credit[];
  projectName: string;
  price: number;
  onClose: () => void;
  onConfirm: (serials: string[]) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = serial ? 1 : quantity;
  const serials = serial ? [serial] : available.slice(0, quantity).map((credit) => credit.serial);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm(serials);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Reserve credits" onClose={onClose}>
      <p className="mt-1 text-sm text-body">Held for you for {RESERVATION_MINUTES} minutes while you pay.</p>
      <dl className="mt-4">
        <Row label="Project" value={projectName} />
        {serial ? (
          <Row label="Serial" value={<span className="font-mono text-[13px]">{serial}</span>} />
        ) : (
          <div className="flex items-center justify-between gap-6 border-t border-line py-2 text-sm">
            <dt className="text-muted">Quantity</dt>
            <dd className="flex items-center gap-3">
              <button type="button" aria-label="Fewer" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} className="rounded-md border border-line p-1.5 hover:bg-mint disabled:opacity-40">
                <Minus size={14} />
              </button>
              <span className="w-14 text-center font-medium">{quantity} t</span>
              <button type="button" aria-label="More" disabled={quantity >= available.length} onClick={() => setQuantity(quantity + 1)} className="rounded-md border border-line p-1.5 hover:bg-mint disabled:opacity-40">
                <Plus size={14} />
              </button>
            </dd>
          </div>
        )}
        <Row label="Price per tonne" value={formatNaira(price)} />
        <Row label="Total" value={<span className="text-[16px] font-semibold">{formatNaira(price * count)}</span>} />
      </dl>
      <Failure message={error} />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={secondary}>Cancel</button>
        <button type="button" onClick={submit} disabled={busy || serials.length === 0} className={primary}>
          {busy && <LoaderCircle size={16} className="animate-spin" />}
          Reserve
        </button>
      </div>
    </Modal>
  );
}

export function PayDialog({ order, live, onClose, onPay }: { order: Order; live: boolean; onClose: () => void; onPay: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await onPay();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Complete payment" onClose={onClose}>
      <dl className="mt-4">
        <Row label="Order" value={`#${order.id}`} />
        <Row label="Credits" value={<Co2Text text={`${order.serials.length} tCO₂e`} />} />
        <Row label="Amount" value={<span className="text-[16px] font-semibold">{formatNaira(order.amountNaira)}</span>} />
      </dl>
      <p className="mt-3 rounded-lg bg-mint px-3 py-2.5 text-xs leading-relaxed text-body">
        {live
          ? "You'll pay on the Access sandbox checkout. Your credits retire once the payment is verified."
          : "Simulated payment on this laptop: no money moves. The credits retire through the real verification steps."}
      </p>
      <Failure message={error} />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={secondary}>Not now</button>
        <button type="button" onClick={submit} disabled={busy} className={primary}>
          {busy && <LoaderCircle size={16} className="animate-spin" />}
          {live ? "Continue to checkout" : `Pay ${formatNaira(order.amountNaira)}`}
        </button>
      </div>
    </Modal>
  );
}

export function ProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <Modal title={project.name} onClose={onClose}>
      <p className="mt-1 text-sm text-body">{project.location}</p>
      <dl className="mt-4">
        <Row label="Project code" value={project.code} />
        <Row label="Methodology" value={project.methodology} />
        <Row label="Vintage" value={project.vintage} />
        <Row label="Homes earning credits" value={project.homes} />
        <Row label="Credits issued" value={<Co2Text text={`${project.minted} tCO₂e`} />} />
        <Row label="Signed off by" value={project.auditor ?? "Not signed"} />
      </dl>
      <p className="mt-3 text-xs text-muted">Issued in the sandbox. Not yet a Gold Standard issuance.</p>
    </Modal>
  );
}

export function CertificateDialog({ order, buyerName, onClose }: { order: Order; buyerName: string; onClose: () => void }) {
  return (
    <Modal title="Retirement certificate" onClose={onClose}>
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-leaf">
        <CheckCircle2 size={18} /> Retired in {buyerName}&apos;s name
      </p>
      <dl className="mt-4">
        <Row label="Registry retirement" value={<span className="font-mono text-[13px]">{order.certificate ?? "Pending"}</span>} />
        {order.serialRange && <Row label="Registry batch" value={<span className="font-mono text-[12px]">{order.serialRange}</span>} />}
        <Row label="Credits retired" value={<Co2Text text={`${order.serials.length} tCO₂e`} />} />
        <Row label="KlimateX serials" value={<span className="font-mono text-[12px]">{order.serials[0]}{order.serials.length > 1 ? ` to ${order.serials[order.serials.length - 1].slice(-6)}` : ""}</span>} />
        <Row label="Retired on" value={formatDate(order.retiredOn)} />
      </dl>
      <p className="mt-3 text-xs text-muted">Held by the Forge sandbox carbon registry. Look up any KlimateX serial on the public verify page.</p>
    </Modal>
  );
}

export function ProfileDialog({ name, email, live, onClose, onSignOut }: { name: string; email: string; live: boolean; onClose: () => void; onSignOut: () => void }) {
  return (
    <Modal title="Your account" onClose={onClose}>
      <dl className="mt-4">
        <Row label="Organisation" value={name} />
        <Row label="Email" value={email} />
        <Row label="Role" value="Buyer" />
        <Row label="Payments" value={live ? "Access sandbox" : "Simulated"} />
      </dl>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onSignOut} className={secondary}>Sign out</button>
      </div>
    </Modal>
  );
}
