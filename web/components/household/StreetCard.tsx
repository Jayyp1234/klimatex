"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { fetchHomeStreet, GRADE_TONE, nextStep, type Street } from "@/lib/streets";
import { useHousehold } from "./HouseholdShell";

/** The family's street grade beside their own: a little friendly competition, and a reason to tell the neighbours. */
export function StreetCard() {
  const { data } = useHousehold();
  const [street, setStreet] = useState<Street | null>(null);
  const [homeGrade, setHomeGrade] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stale = false;
    fetchHomeStreet(data.home.siteId)
      .then((r) => {
        if (stale) return;
        setStreet(r.street);
        setHomeGrade(r.home_grade);
      })
      .catch(() => !stale && setMissing(true));
    return () => {
      stale = true;
    };
  }, [data.home.siteId]);

  if (missing || !street) return null;
  const ahead = homeGrade && homeGrade < street.grade;

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-medium text-body"><MapPin size={15} className="text-leaf" /> Your street</p>
        <Link href="/streets/" className="inline-flex items-center gap-1 text-[13px] font-medium text-leaf hover:underline">All streets <ArrowRight size={14} /></Link>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[26px] font-bold ${GRADE_TONE[street.grade] ?? GRADE_TONE.G}`}>{street.grade}</span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-snug">{street.name} is grade {street.grade}</p>
          <p className="mt-0.5 text-[13px] text-body">
            {ahead ? `Your home is grade ${homeGrade}, ahead of your street. ` : homeGrade ? `Your home is grade ${homeGrade}. ` : ""}
            {nextStep(street)}
          </p>
        </div>
      </div>
    </section>
  );
}
