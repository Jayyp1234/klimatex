import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Coins, Download, Layers, MessageCircle, PlayCircle, ShieldCheck, Smartphone } from "lucide-react";
import { Audience } from "@/components/Audience";
import { HeroCertificate } from "@/components/HeroCertificate";
import { ChatChannels } from "@/components/ChatChannels";
import { DashboardShowcase } from "@/components/DashboardShowcase";
import { PhoneShowcase } from "@/components/PhoneShowcase";
import { Co2Text } from "@/components/Co2Text";
import { SiteHeader } from "@/components/SiteHeader";
import { VerifyButton, VerifyDialog } from "@/components/VerifyCredit";
import { androidApp, links } from "@/lib/links";

const standards = [
  { name: "Gold Standard JUST", note: "Fossil Fuel Generators v1.0" },
  { name: "NASA POWER", note: "Daily irradiance data" },
  { name: "Article 6 ready", note: "Data kept to authorisation standard" },
  { name: "Access Youth Tech", note: "Forge sandbox" },
];

const lifecycle = [
  { title: "Grade", text: "Assess a home (A–G) from its metered generator share.", icon: BarChart3 },
  { title: "Measure", text: "Read the inverter and apply the methodology: JUST today, ready for ESE.", icon: Layers },
  { title: "Verify", text: "Nine automated checks, then a sample reviewed by a Gold Standard-approved verifier (VVB).", icon: ShieldCheck },
  { title: "Pay", text: "Sell verified credits, retire them, and split the proceeds to families.", icon: Coins },
];

const stats = [
  { value: "2.1 tCO₂e", label: "Typical credits per home per year" },
  { value: "200", label: "Homes planned for the Lagos pilot (6 months)" },
  { value: "~210 tCO₂e", label: "Pilot credit target (audit-ready)" },
  { value: "50 / 15 / 20 / 15", label: "Family / Installer / Audit & Registry / KlimateX (illustrative split)" },
];

export default function HomePage() {
  return (
    <div id="top">
      <div className="flex items-center justify-center gap-2.5 bg-forest px-4 py-2 text-center text-xs text-white">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide">DEMO</span>
        <span>Built on the Access Youth Tech Forge sandbox · Demo data and households are synthetic.</span>
      </div>

      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-[1160px] px-4 pb-10 pt-11 sm:px-6 lg:min-h-[520px] lg:pb-14 lg:pt-12">
            <div className="max-w-[560px]">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-leaf">Household carbon infrastructure</p>
              <h1 className="mt-4 text-[40px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[52px]">
                Turn household <br className="hidden sm:block" />
                solar savings into <br className="hidden sm:block" />
                <span className="text-forest">verified carbon value.</span>
              </h1>
              <p className="mt-5 max-w-[440px] text-[17px] leading-[1.5] text-body">
                KlimateX measures what solar replaces, verifies the emissions avoided, issues carbon credits, and pays families through Access Bank.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={links.app} className="inline-flex items-center gap-2 rounded-lg bg-forest px-6 py-3.5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-forest-hover">
                  Try the demo <ArrowRight size={17} />
                </a>
                <VerifyButton className="rounded-lg border border-line bg-white px-6 py-3.5 text-[15px] font-medium shadow-sm transition-colors hover:bg-mint">
                  Verify a credit
                </VerifyButton>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-medium">
                <a href="#demo" className="inline-flex items-center gap-1.5 text-forest hover:underline">
                  <PlayCircle size={16} className="text-leaf" /> Watch the 80-second demo
                </a>
                <a href="#get-the-app" className="inline-flex items-center gap-1.5 text-forest hover:underline">
                  <Smartphone size={16} className="text-leaf" /> Get the Android app
                </a>
                <a href="#chat" className="inline-flex items-center gap-1.5 text-forest hover:underline">
                  <MessageCircle size={16} className="text-leaf" /> Ask on Telegram
                </a>
              </div>
              <div className="mt-8 flex items-center gap-5">
                <Image src="/images/people.webp" alt="" width={136} height={51} className="h-[50px] w-auto" />
                <p className="max-w-[190px] text-sm leading-snug text-body">Built for families, installers, buyers and lenders.</p>
              </div>
            </div>
          </div>

          <div className="relative px-4 pb-8 sm:px-6 lg:absolute lg:bottom-0 lg:right-0 lg:top-5 lg:w-[47vw] lg:max-w-[720px] lg:p-0">
            <Image
              src="/images/hero-home.webp"
              alt="Home with rooftop solar panels surrounded by palms"
              width={968}
              height={914}
              priority
              sizes="47vw"
              className="hidden h-full w-full object-cover object-right lg:block"
            />
            <Image
              src="/images/hero-roof.webp"
              alt=""
              width={928}
              height={290}
              sizes="100vw"
              className="w-full rounded-2xl lg:hidden"
            />
            <div aria-hidden className="absolute inset-y-0 left-0 hidden w-2/5 bg-gradient-to-r from-white to-transparent lg:block" />
            <div className="-mt-6 flex justify-center lg:absolute lg:bottom-10 lg:left-[-6%] lg:mt-0">
              <HeroCertificate />
            </div>
          </div>
        </section>

        <section aria-label="Standards and data" className="border-y border-line">
          <div className="mx-auto grid max-w-[1160px] grid-cols-2 items-center gap-x-6 gap-y-5 px-4 py-6 sm:px-6 lg:grid-cols-[190px_repeat(4,minmax(0,1fr))] lg:gap-8">
            <p className="col-span-2 text-sm leading-snug text-body lg:col-span-1 lg:border-r lg:border-line lg:pr-6">Built around recognised standards and data</p>
            {standards.map((s) => (
              <div key={s.name} className="lg:text-center">
                <p className="text-[15px] font-semibold tracking-tight">{s.name}</p>
                <p className="text-xs text-muted">{s.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="platform" className="bg-gradient-to-b from-[#f6f9f5] to-white py-14 lg:py-16">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <div className="mx-auto max-w-[780px] text-center">
              <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.025em] sm:text-[38px]">
                One platform across the <span className="text-forest">credit lifecycle</span>
              </h2>
              <p className="mx-auto mt-3 max-w-[620px] text-[16px] leading-[1.5] text-body">
                From metered solar data to verified credits and payouts, KlimateX brings measurement, verification, trading and settlement together.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {lifecycle.map(({ title, text, icon: Icon }, index) => (
                <li key={title} className="relative rounded-xl bg-mint p-6 lg:min-h-[168px]">
                  <Icon size={32} strokeWidth={1.9} className="text-forest" aria-hidden />
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.4] text-body">{text}</p>
                  {index < lifecycle.length - 1 && (
                    <ArrowRight size={20} aria-hidden className="absolute -right-[30px] top-1/2 hidden -translate-y-1/2 text-forest lg:block" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="dashboards" aria-labelledby="dashboards-title" className="scroll-mt-20 border-t border-line bg-[#f6f9f5] py-12 lg:py-16">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-leaf">The platform</p>
            <h2 id="dashboards-title" className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">A dashboard for everyone in the chain</h2>
            <div className="mt-6">
              <DashboardShowcase />
            </div>
          </div>
        </section>

        <section id="demo" aria-labelledby="demo-title" className="scroll-mt-20 border-t border-line py-12 lg:py-14">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-leaf">Demo</p>
            <h2 id="demo-title" className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Every dashboard in 80 seconds</h2>
            <p className="mt-2 max-w-[620px] text-[16px] leading-[1.55] text-body">
              The family&apos;s phone app, then the installer, auditor, buyer, Access Bank and operations views, and the street grades. Captions are on; the data is synthetic.
            </p>
            <video
              className="mt-6 aspect-video w-full rounded-2xl border border-line bg-forest shadow-[0_18px_50px_-14px_rgb(11_63_42/0.3)]"
              controls
              playsInline
              preload="metadata"
              poster="/demo/klimatex-demo-poster.jpg"
            >
              <source src="/demo/klimatex-demo.mp4" type="video/mp4" />
              <track kind="captions" src="/demo/klimatex-demo.vtt" srcLang="en" label="English" default />
              <a href="/demo/klimatex-demo.mp4">Download the demo video (MP4, 8.5 MB)</a>
            </video>
          </div>
        </section>

        <Audience />

        <section id="get-the-app" aria-labelledby="get-the-app-title" className="scroll-mt-20 overflow-hidden border-t border-line bg-gradient-to-b from-white to-[#f3f8ef]">
          <div className="mx-auto grid max-w-[1160px] items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] lg:py-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-leaf">For families</p>
              <h2 id="get-the-app-title" className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">The KlimateX app for Android</h2>
              <p className="mt-3 max-w-[480px] text-[16px] leading-[1.55] text-body">
                Sign in with your phone number to see your solar, your payouts and your certificate, get tips to earn more, add your fuel receipts, and ask questions in English or Pidgin.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href={links.androidApk} download className="inline-flex items-center gap-2 rounded-lg bg-forest px-6 py-3.5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-forest-hover">
                  <Download size={17} /> Download the APK
                </a>
                <span className="text-[13px] text-body">
                  Version {androidApp.version}{androidApp.sizeMb ? ` · ${androidApp.sizeMb} MB` : ""}{androidApp.builtOn ? ` · built ${androidApp.builtOn}` : ""}
                </span>
              </div>
              <p className="mt-3 text-[13px] text-body">Needs {androidApp.requires}. Android will ask you to allow installs from your browser, because the app comes from this site and not the Play Store.</p>
              {androidApp.sha256 && <p className="mt-2 break-all font-mono text-[11.5px] text-muted">SHA-256 {androidApp.sha256}</p>}
              <ol className="mt-5 space-y-2 rounded-2xl border border-line bg-white p-4 text-[13.5px] text-body">
                <li><strong className="text-ink">1.</strong> Open this page on your Android phone and tap Download the APK.</li>
                <li><strong className="text-ink">2.</strong> Open the file. If Android asks, allow installs from your browser for this one app.</li>
                <li><strong className="text-ink">3.</strong> Sign in with your phone number. This is a sandbox build with demonstration data.</li>
              </ol>
            </div>
            <PhoneShowcase />
          </div>
        </section>

        <ChatChannels />

        <section aria-label="Key figures" className="border-t border-line bg-mint">
          <div className="mx-auto grid max-w-[1160px] gap-x-8 gap-y-7 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1fr_1fr_1fr_1.35fr]">
            {stats.map((stat, index) => (
              <div key={stat.value} className={index ? "lg:border-l lg:border-line lg:pl-8" : ""}>
                <p className="whitespace-nowrap text-[28px] font-semibold tracking-tight text-forest xl:text-[31px]"><Co2Text text={stat.value} /></p>
                <p className="mt-1 text-sm leading-snug text-body">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer id="resources" className="bg-forest text-white/75">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-4 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="font-semibold text-white">KlimateX</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#platform" className="hover:text-white">Platform</a>
            <a href="#solutions" className="hover:text-white">Solutions</a>
            <VerifyButton className="hover:text-white">Registry</VerifyButton>
            <Link href="/streets/" className="hover:text-white">Street grades</Link>
            <a href="#get-the-app" className="hover:text-white">Android app</a>
            <a href="#chat" className="hover:text-white">Telegram &amp; WhatsApp</a>
          </nav>
          <p className="text-xs">Sandbox environment. Records shown are demonstration data.</p>
        </div>
      </footer>

      <VerifyDialog />
    </div>
  );
}
