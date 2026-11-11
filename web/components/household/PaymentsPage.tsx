"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { fetchPayoutDetails, type PayoutDetails } from "@/lib/payout";
import { longDate } from "@/lib/household";
import { PayoutDetailsForm } from "./PayoutDetailsForm";
import { PageHeader, Panel } from "./ui";

export function PaymentsPage() {
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchPayoutDetails().then(setDetails).catch(() => setError("Your payment details couldn't be loaded. Refresh to try again."));
  }, []);

  return (
    <>
      <PageHeader title="Payment details" description="Where your share of each carbon sale is paid." />
      <Panel
        title="Where we pay you"
        description={details?.updated_at ? `Last changed ${longDate(details.updated_at.slice(0, 10))}` : "You're paid into your Access wallet unless you choose a bank account."}
      >
        {details ? (
          <div className="max-w-[560px]">
            <PayoutDetailsForm
              key={details.updated_at ?? "initial"}
              details={details}
              onSaved={(next) => {
                setDetails(next);
                setSavedAt(new Date().toISOString());
              }}
              secondary={savedAt && (
                <span role="status" className="inline-flex items-center gap-1.5 text-sm text-leaf"><CheckCircle2 size={16} /> Saved</span>
              )}
            />
          </div>
        ) : error ? (
          <p className="text-sm text-red-800">{error}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" /> Loading</p>
        )}
      </Panel>
      <p className="text-xs text-muted">We never ask for your PIN, card details or BVN by phone or SMS. Payments only come from KlimateX through Access Bank.</p>
    </>
  );
}
