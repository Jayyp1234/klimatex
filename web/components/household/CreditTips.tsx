"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Lightbulb, Wrench } from "lucide-react";
import { fetchHomeTips, type HomeTips, type Tip } from "@/lib/tips";
import { useHousehold } from "./HouseholdShell";
import { Panel, Pill } from "./ui";

const PRIORITY = {
  high: { tone: "red" as const, label: "Do this first" },
  medium: { tone: "amber" as const, label: "Worth doing" },
  low: { tone: "grey" as const, label: "Good to know" },
};

function TipRow({ tip }: { tip: Tip }) {
  const done = tip.status === "done";
  return (
    <li className="flex gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? "bg-[#e4f3d5] text-[#27500a]" : tip.priority === "high" ? "bg-red-50 text-red-700" : "bg-[#fdf3d7] text-[#8a5a00]"}`}>
        {done ? <CheckCircle2 size={16} /> : tip.who === "installer" ? <Wrench size={16} /> : <CircleAlert size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-semibold leading-snug">{tip.title}</p>
          {!done && <Pill tone={PRIORITY[tip.priority].tone}>{PRIORITY[tip.priority].label}</Pill>}
          {!done && tip.who === "installer" && <Pill tone="grey">Your installer</Pill>}
        </div>
        <p className="mt-0.5 text-[13px] text-body">{tip.body}</p>
        {tip.action?.href && (
          <Link href={tip.action.href} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-leaf hover:underline">
            {tip.action.label} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </li>
  );
}

/** What this home can do to earn more credits, from its own checks and evidence. */
export function CreditTips() {
  const { data } = useHousehold();
  const [tips, setTips] = useState<HomeTips | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    fetchHomeTips(data.home.siteId)
      .then((r) => !stale && setTips(r))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [data.home.siteId]);

  if (failed || !tips) return null;
  // Only what this home's own data triggers; a home with nothing to fix gets one line, not an empty card.
  const todo = tips.tips.filter((t) => t.status === "todo");
  if (todo.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-line bg-white px-5 py-3.5 text-[13.5px] text-body">
        <CheckCircle2 size={16} className="text-leaf" /> You&apos;re doing everything right. Nothing is holding back your credits.
      </p>
    );
  }

  return (
    <Panel
      title="Earn more credits"
      description={`${todo.length} ${todo.length === 1 ? "thing" : "things"} to do${tips.credits_cut_pct > 0 ? ` · until your evidence is complete, your credits are about ${tips.credits_cut_pct}% lower (estimate)` : ""}`}
      actions={<Lightbulb size={18} className="text-leaf" />}
      flush
    >
      <ul>{todo.map((t) => <TipRow key={t.id} tip={t} />)}</ul>
    </Panel>
  );
}
