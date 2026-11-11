import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StreetBoard } from "@/components/StreetBoard";
import { links } from "@/lib/links";

export const metadata: Metadata = {
  title: "Street grades | KlimateX",
  description: "How clean is your street's power? Metered energy grades for Lagos streets, A to G.",
};

export default function StreetsPage() {
  return (
    <main className="min-h-screen bg-[#f6f8f5]">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[70px] max-w-[1160px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="KlimateX home"><Image src="/logo.svg" alt="KlimateX" width={154} height={36} priority className="h-8 w-auto" /></Link>
          <a href={links.signIn} className="text-sm font-medium text-ink hover:text-leaf">Sign in</a>
        </div>
      </header>
      <div className="mx-auto max-w-[1160px] px-4 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-leaf hover:underline"><ArrowLeft size={14} /> Back to KlimateX</Link>
        <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-[-0.025em] sm:text-[42px]">Street grades</h1>
        <p className="mt-2 max-w-[640px] text-[16px] text-body">
          How clean is your street&rsquo;s power? Every street gets a grade from A to G, measured from inverters, not guessed. Landlords, estates and local government can see where the next solar homes will make the biggest difference.
        </p>
        <div className="mt-8"><StreetBoard /></div>
        <p className="mt-6 text-xs text-muted">Sandbox environment. Streets and homes shown are demonstration data.</p>
      </div>
    </main>
  );
}
