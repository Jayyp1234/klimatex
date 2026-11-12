"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/** Real screens from the Android and iOS app (demo data). */
const SCREENS = [
  { src: "/images/screens/phone-home.webp", label: "Your home", alt: "App home screen: grade B, ₦69,000 saved on petrol, payouts and next payment" },
  { src: "/images/screens/phone-earn.webp", label: "Earn more", alt: "Earn more screen: two tips from the home's own readings" },
  { src: "/images/screens/phone-receipts.webp", label: "Fuel receipts", alt: "Fuel receipts screen: 5 of 12 months added" },
  { src: "/images/screens/phone-assistant.webp", label: "Ask in 5 languages", alt: "Ask KlimateX: answers about the home and the solar loan" },
  { src: "/images/screens/phone-payouts.webp", label: "Payouts", alt: "Payouts screen: total paid, wallet and solar loan" },
];
const INTERVAL_MS = 3400;

function Phone({ index, className = "", priority = false }: { index: number; className?: string; priority?: boolean }) {
  return (
    <div className={`relative aspect-[1206/2622] rounded-[2.6rem] bg-[#0d1512] p-[7px] shadow-[0_30px_70px_-20px_rgb(11_63_42/0.55)] ring-1 ring-black/10 ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-[2.15rem] bg-[#f6f8f5]">
        {SCREENS.map((s, i) => (
          <Image
            key={s.src}
            src={s.src}
            alt={i === index ? s.alt : ""}
            aria-hidden={i !== index}
            fill
            sizes="280px"
            priority={priority && i === 0}
            className={`object-cover object-top transition-opacity duration-700 ease-out ${i === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Two phones cycling through real app screens. Pauses on hover, off screen, and for reduced motion. */
export function PhoneShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [calm, setCalm] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || !visible || calm) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SCREENS.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, visible, calm]);

  const back = (index + 2) % SCREENS.length;

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[420px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div aria-hidden className="absolute inset-x-6 top-10 bottom-16 rounded-[3rem] bg-[radial-gradient(circle_at_30%_30%,#cfe9b8,transparent_60%),radial-gradient(circle_at_75%_70%,#a9d98c,transparent_55%)] opacity-80 blur-2xl" />
      <div className="relative h-[470px] sm:h-[520px]">
        <div className="absolute left-0 top-12 w-[46%] [--kx-tilt:-9deg] kx-float-tilt" aria-hidden>
          <Phone index={back} className="opacity-90" />
        </div>
        <div className="absolute right-4 top-0 w-[56%] kx-float">
          <Phone index={index} priority />
          <span className="absolute -left-10 top-[58%] rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-forest shadow-lg ring-1 ring-line" aria-live="polite">
            {SCREENS[index].label}
          </span>
        </div>
      </div>
      <div className="relative mt-3 flex justify-center gap-2" role="tablist" aria-label="App screens">
        {SCREENS.map((s, i) => (
          <button
            key={s.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.label}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-forest" : "w-2 bg-line hover:bg-leaf"}`}
          />
        ))}
      </div>
    </div>
  );
}
