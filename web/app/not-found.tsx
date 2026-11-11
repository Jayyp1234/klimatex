import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Image src="/logo.svg" alt="KlimateX" width={154} height={36} className="h-9 w-auto" />
      <h1 className="mt-10 text-[32px] font-semibold tracking-[-0.025em]">This page isn&apos;t available yet</h1>
      <p className="mt-3 max-w-[420px] text-[16px] leading-[1.5] text-body">
        The address may be wrong, or this part of the KlimateX platform hasn&apos;t opened in this environment.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-2 rounded-lg bg-forest px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-forest-hover"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>
    </main>
  );
}
