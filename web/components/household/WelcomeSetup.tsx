"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { api, getSession, type User } from "@/lib/api";
import { fetchPayoutDetails, type PayoutDetails } from "@/lib/payout";
import { homeFor } from "@/lib/workspaces";
import { PayoutDetailsForm } from "./PayoutDetailsForm";

const HOME = "/app/household/";

function Steps({ current }: { current: number }) {
  const steps = ["Phone confirmed", "PIN set", "Where we pay you"];
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
      {steps.map((label, i) => {
        const done = i < current;
        return (
          <li key={label} className={`flex items-center gap-2 ${done || i === current ? "text-ink" : "text-muted"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${done ? "bg-forest text-white" : i === current ? "bg-mint text-forest ring-1 ring-forest" : "bg-[#eef2ee] text-muted"}`}>
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function paidInto(details: PayoutDetails): string {
  if (details.method === "bank" && details.bank) return `${details.bank.bank_name} ending ${details.bank.account_ending}`;
  return "Your Access wallet";
}

export function WelcomeSetup() {
  const [user, setUser] = useState<User | null>(null);
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [saved, setSaved] = useState<PayoutDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) return window.location.replace("/app/");
    if (session.user.role !== "household") return window.location.replace(homeFor(session.user.role));
    Promise.all([api<User>("/api/auth/me"), fetchPayoutDetails()])
      .then(([me, payout]) => {
        setUser(me);
        setDetails(payout);
      })
      .catch(() => {
        setUser(session.user);
        setError("We couldn't load your account. You can finish this later in Settings.");
      });
  }, []);

  const displayName = user?.name ?? "";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#eff5ee,transparent_55%)]">
      <header className="mx-auto flex max-w-[640px] items-center justify-between px-5 pt-6">
        <Image src="/logo.svg" alt="KlimateX" width={130} height={32} priority className="h-7 w-auto" />
        {!saved && <Link href={HOME} className="text-sm font-medium text-body hover:text-ink">Skip for now</Link>}
      </header>

      <main className="mx-auto max-w-[640px] px-5 pb-16 pt-10">
        {!user || (!details && !error) ? (
          <p className="flex items-center gap-2 text-sm text-body"><LoaderCircle size={16} className="animate-spin" /> Loading</p>
        ) : saved ? (
          <section>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-white"><Check size={28} strokeWidth={2.5} /></span>
            <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.03em] text-ink">You&apos;re all set{displayName ? `, ${displayName}` : ""}</h1>
            <p className="mt-2 max-w-[480px] text-[15px] leading-relaxed text-body">
              Each month we measure your solar. When your home&apos;s carbon savings are sold, your share is paid automatically. You&apos;ll get a message each time.
            </p>
            <dl className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
              {[
                ["Sign in with", `${user.phone ? `0${user.phone.slice(4, 7)} ${user.phone.slice(7, 10)} ${user.phone.slice(10)}` : "Your phone"} and your PIN`],
                ["You're paid into", paidInto(saved)],
                ["Change these any time", "Settings › Payment details"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 text-sm">
                  <dt className="text-body">{label}</dt>
                  <dd className="font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <Link href={HOME} className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-forest px-6 text-[15px] font-medium text-white hover:bg-forest-hover">
              Go to my home <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
            </Link>
          </section>
        ) : (
          <section>
            <Steps current={2} />
            <h1 className="mt-8 text-[30px] font-semibold tracking-[-0.03em] text-ink">Welcome{displayName ? `, ${displayName}` : ""}. Where should we pay you?</h1>
            <p className="mt-2 max-w-[520px] text-[15px] leading-relaxed text-body">
              Your solar earns money every time your home&apos;s carbon savings are sold. Choose where it goes. You can change this later.
            </p>
            <div className="mt-8">
              {details ? (
                <PayoutDetailsForm details={details} onSaved={setSaved} submitLabel="Save and continue" />
              ) : (
                <p className="text-sm text-red-800">{error}</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
