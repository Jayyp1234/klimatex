"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Menu, X } from "lucide-react";
import { links, solutions } from "@/lib/links";
import { VerifyButton } from "./VerifyCredit";

const platform = ["Grade", "Measure", "Verify", "Pay"];
const navItem = "text-sm font-medium text-ink transition-colors hover:text-leaf";

function Dropdown({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  return (
    <div className="group relative">
      <button type="button" className={`${navItem} inline-flex items-center gap-1 py-2`} aria-haspopup="true">
        {label}
        <ChevronDown size={15} className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
      </button>
      <div className="invisible absolute left-1/2 top-full z-30 w-48 -translate-x-1/2 rounded-xl border border-line bg-white p-1.5 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-body hover:bg-mint hover:text-ink">
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const platformItems = platform.map((label) => ({ label, href: "#platform" }));
  const solutionItems = solutions.map((s) => ({ label: s.label, href: `#for-${s.id}` }));
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[70px] max-w-[1160px] items-center justify-between gap-6 px-4 sm:px-6">
        <a href="#top" aria-label="KlimateX home" className="shrink-0">
          <Image src="/logo.svg" alt="KlimateX" width={154} height={36} priority className="h-8 w-auto" />
        </a>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          <Dropdown label="Platform" items={platformItems} />
          <Dropdown label="Solutions" items={solutionItems} />
          <a href="#platform" className={navItem}>Methodology</a>
          <VerifyButton className={navItem}>Registry</VerifyButton>
          <a href="#resources" className={navItem}>Resources</a>
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <a href={links.signIn} className={navItem}>Sign in</a>
          <a href={links.requestDemo} className="rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-hover">
            Request a demo
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-ink hover:bg-mint lg:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-line bg-white px-4 pb-5 pt-2 lg:hidden">
          {[
            { label: "Platform", href: "#platform" },
            { label: "Solutions", href: "#solutions" },
            { label: "Methodology", href: "#platform" },
            { label: "Resources", href: "#resources" },
            { label: "Sign in", href: links.signIn },
          ].map((item) => (
            <a key={item.label} href={item.href} onClick={close} className="block border-b border-line py-3 text-[15px] font-medium">
              {item.label}
            </a>
          ))}
          <VerifyButton className="block w-full border-b border-line py-3 text-left text-[15px] font-medium">Registry</VerifyButton>
          <a href={links.requestDemo} onClick={close} className="mt-4 block rounded-lg bg-forest px-4 py-3 text-center text-sm font-medium text-white">
            Request a demo
          </a>
        </nav>
      )}
    </header>
  );
}
