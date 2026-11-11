"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, Building2, CheckCircle2, Landmark, LoaderCircle, TriangleAlert, Wallet } from "lucide-react";
import { ApiError } from "@/lib/api";
import { checkAccount, savePayoutDetails, type PayoutDetails } from "@/lib/payout";

type Method = "wallet" | "bank";

function Choice({ selected, onSelect, icon, title, tag, children }: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer gap-3.5 rounded-2xl border p-4 transition ${selected ? "border-forest bg-mint/50 ring-1 ring-forest" : "border-line bg-white hover:border-forest/40"}`}>
      <input type="radio" name="payout-method" aria-label={title} checked={selected} onChange={onSelect} className="sr-only" />
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-forest text-white" : "bg-mint text-forest"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-ink">{title}</span>
          {tag && <span className="rounded-md bg-[#e4f3d5] px-1.5 py-0.5 text-[11px] font-medium text-[#27500a]">{tag}</span>}
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-body">{children}</span>
      </span>
      <span aria-hidden className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-forest" : "border-line"}`}>
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-forest" />}
      </span>
    </label>
  );
}

/**
 * Where a family is paid. The bank account is checked with the bank first, and the family
 * confirms the name on it before anything is saved.
 */
export function PayoutDetailsForm({ details, onSaved, submitLabel = "Save", secondary }: {
  details: PayoutDetails;
  onSaved: (details: PayoutDetails) => void;
  submitLabel?: string;
  secondary?: ReactNode;
}) {
  const [method, setMethod] = useState<Method>(details.method);
  const [changingBank, setChangingBank] = useState(!details.bank);
  const [bankCode, setBankCode] = useState("");
  const [account, setAccount] = useState("");
  // One lookup per bank + account pair. Results carry their key, so a stale answer is never shown for a new number.
  const [lookup, setLookup] = useState<{ key: string; name?: string; error?: string } | null>(null);
  const [confirmedKey, setConfirmedKey] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const digits = account.replace(/\D/g, "");
  const key = `${bankCode}:${digits}`;
  const lookupReady = changingBank && method === "bank" && bankCode !== "" && digits.length === 10;

  useEffect(() => {
    if (!lookupReady || lookup?.key === key) return;
    let current = true;
    checkAccount(bankCode, digits)
      .then((result) => current && setLookup({ key, name: result.account_name }))
      .catch((e) => current && setLookup({ key, error: e instanceof ApiError ? e.message : "We couldn't check that account. Try again." }));
    return () => {
      current = false;
    };
  }, [lookupReady, key, bankCode, digits, lookup?.key]);

  const answered = lookupReady && lookup?.key === key ? lookup : null;
  const checking = lookupReady && !answered;
  const nameShown = answered?.name ?? null;
  const confirmed = nameShown !== null && confirmedKey === key;
  const usingSavedBank = method === "bank" && !changingBank && details.bank;
  const canSave = method === "wallet" ? Boolean(details.wallet) : usingSavedBank ? true : confirmed;
  const shownError = error || answered?.error || "";

  async function save() {
    setError("");
    setSaving(true);
    try {
      const result = method === "wallet" ? await savePayoutDetails("wallet") : usingSavedBank ? await savePayoutDetails("bank") : await savePayoutDetails("bank", bankCode, digits);
      setChangingBank(!result.bank);
      setAccount("");
      setLookup(null);
      setConfirmedKey("");
      onSaved(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {details.has_loan && (
        <p className="flex gap-2.5 rounded-xl border border-line bg-[#f7f9f6] px-4 py-3 text-[13px] leading-relaxed text-body">
          <Landmark size={16} className="mt-0.5 shrink-0 text-forest" />
          <span>You have an Access solar loan, so while it runs your earnings go straight to your loan repayments. The choice below applies once the loan is paid off.</span>
        </p>
      )}

      <div role="radiogroup" aria-label="Where we pay you" className="space-y-3">
        <Choice selected={method === "wallet"} onSelect={() => setMethod("wallet")} icon={<Wallet size={19} />} title="Access wallet" tag={details.wallet ? "Ready now" : undefined}>
          {details.wallet
            ? `Opened for you on ${details.wallet.phone ?? "your phone number"} when your solar was fitted. Nothing to set up.`
            : "Not open yet. Your installer can open one for you."}
        </Choice>
        <Choice selected={method === "bank"} onSelect={() => setMethod("bank")} icon={<Building2 size={19} />} title="My bank account">
          {details.bank
            ? `${details.bank.bank_name} ending ${details.bank.account_ending} · ${details.bank.account_name}`
            : "Any Nigerian bank or mobile money account. We check the name with the bank before saving."}
        </Choice>
      </div>

      {method === "bank" && usingSavedBank && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-ink"><BadgeCheck size={16} className="text-leaf" /> Checked with {details.bank!.bank_name}</span>
          <button type="button" onClick={() => setChangingBank(true)} className="font-medium text-leaf hover:underline">Use a different account</button>
        </div>
      )}

      {method === "bank" && changingBank && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <div>
            <label htmlFor="bank" className="text-sm font-medium text-ink">Bank</label>
            <select
              id="bank"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none focus:border-leaf focus:ring-4 focus:ring-leaf/12"
            >
              <option value="">Choose your bank</option>
              {details.banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="account" className="text-sm font-medium text-ink">Account number</label>
            <input
              id="account"
              inputMode="numeric"
              autoComplete="off"
              maxLength={13}
              value={account}
              onChange={(e) => { setAccount(e.target.value.replace(/[^\d ]/g, "")); setError(""); }}
              placeholder="10 digits"
              className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3.5 font-mono text-[16px] tracking-wider text-ink outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted/80 focus:border-leaf focus:ring-4 focus:ring-leaf/12"
            />
            <p className="mt-1.5 text-xs text-muted">{digits.length}/10 digits</p>
          </div>
          {checking && <p className="flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" /> Checking with the bank</p>}
          {nameShown && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-mint px-4 py-3">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmedKey(e.target.checked ? key : "")} className="mt-1 h-4 w-4 accent-[#14683f]" />
              <span>
                <span className="block text-[13px] text-body">The bank says this account belongs to</span>
                <span className="block text-[15px] font-semibold text-ink">{nameShown}</span>
                <span className="mt-0.5 block text-[13px] text-body">Tick to confirm this is your account.</span>
              </span>
            </label>
          )}
          {details.bank && (
            <button type="button" onClick={() => { setChangingBank(false); setAccount(""); setError(""); }} className="text-sm font-medium text-body hover:text-ink">
              Keep {details.bank.bank_name} ending {details.bank.account_ending}
            </button>
          )}
        </div>
      )}

      {shownError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {shownError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-5 text-[15px] font-medium text-white transition hover:bg-forest-hover disabled:opacity-50"
        >
          {saving ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
          {submitLabel}
        </button>
        {secondary}
      </div>
    </div>
  );
}
