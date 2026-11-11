"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ComponentType } from "react";
import {
  Bell,
  CalendarClock,
  BarChart3,
  Building2,
  ChevronDown,
  FileBadge,
  Home,
  Landmark,
  Layers,
  Recycle,
  Search,
  Settings,
  ShoppingCart,
  User,
} from "lucide-react";
import type { View } from "@/lib/marketplace";

type Item = { label: string; view: View; icon: ComponentType<{ size?: number; className?: string }> };

const main: Item[] = [
  { label: "Marketplace", view: "available", icon: ShoppingCart },
  { label: "My Orders", view: "purchased", icon: Layers },
  { label: "Reservations", view: "reserved", icon: CalendarClock },
  { label: "Retirements", view: "retired", icon: Recycle },
  { label: "Certificates", view: "certificates", icon: FileBadge },
];

const upcoming = [
  { label: "Reports", icon: BarChart3 },
  { label: "Organisation", icon: Building2, group: "Manage" },
  { label: "Settings", icon: Settings },
];

function Soon() {
  return <span className="ml-auto rounded bg-mint px-1.5 py-0.5 text-[10px] font-medium text-muted">Soon</span>;
}

export function Sidebar({ view, reservedCount, live, onNavigate }: { view: View; reservedCount: number; live: boolean; onNavigate: (view: View) => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-line bg-[#fbfcfa] px-4 pb-4 pt-6 lg:flex">
      <Link href="/" aria-label="KlimateX home" className="px-2">
        <Image src="/logo.svg" alt="KlimateX" width={150} height={37} priority className="h-8 w-auto" />
      </Link>

      <nav aria-label="Marketplace" className="mt-8 space-y-1">
        {main.map(({ label, view: target, icon: Icon }) => {
          const active = view === target;
          return (
            <button
              key={label}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(target)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${active ? "bg-forest text-white" : "text-ink hover:bg-mint"}`}
            >
              <Icon size={19} />
              {label}
              {target === "reserved" && reservedCount > 0 && (
                <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${active ? "bg-white text-forest" : "bg-lime text-forest"}`}>
                  {reservedCount}
                </span>
              )}
            </button>
          );
        })}
        {upcoming.slice(0, 1).map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium text-muted">
            <Icon size={19} /> {label} <Soon />
          </div>
        ))}
      </nav>

      <div className="mt-5 border-t border-line pt-5">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Manage</p>
        <div className="mt-2 space-y-1">
          {upcoming.slice(1).map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium text-muted">
              <Icon size={19} /> {label} <Soon />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-xl border border-line bg-white p-3">
        <Landmark size={20} className="shrink-0 text-forest" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold">{live ? "Access sandbox" : "Simulated payments"}</p>
          <p className="text-[11px] leading-tight text-muted">{live ? "Connected for test payments" : "On this laptop, no money moves"}</p>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({
  name,
  initials,
  search,
  onSearch,
  hasAlert,
  onBell,
  onProfile,
}: {
  name: string;
  initials: string;
  search: string;
  onSearch: (value: string) => void;
  hasAlert: boolean;
  onBell: () => void;
  onProfile: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="KlimateX home" className="lg:hidden">
          <Image src="/logo.svg" alt="KlimateX" width={130} height={32} className="h-7 w-auto" />
        </Link>

        <label className="relative hidden max-w-[520px] flex-1 md:block">
          <span className="sr-only">Search credits or projects</span>
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={input}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search credits or projects"
            className="h-10 w-full rounded-lg border border-line bg-[#fbfcfa] pl-10 pr-14 text-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 font-sans text-[11px] text-muted">⌘K</kbd>
        </label>

        <div className="ml-auto flex items-center gap-4">
          <button type="button" onClick={onBell} aria-label={hasAlert ? "Notifications: you have an open reservation" : "Notifications"} className="relative rounded-md p-1.5 text-ink hover:bg-mint">
            <Bell size={20} />
            {hasAlert && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#3f9f12] ring-2 ring-white" />}
          </button>
          <button type="button" onClick={onProfile} className="hidden items-center gap-3 border-l border-line pl-4 text-left md:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{initials}</span>
            <span>
              <span className="block text-sm font-semibold leading-tight">{name}</span>
              <span className="block text-xs text-muted">Buyer</span>
            </span>
            <ChevronDown size={16} className="text-body" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

export function BottomNav({ view, onNavigate, onProfile }: { view: View; onNavigate: (view: View) => void; onProfile: () => void }) {
  const tab = "flex flex-col items-center gap-0.5 py-1 text-[10.5px] font-medium";
  const tone = (active: boolean) => (active ? "text-forest" : "text-muted");
  const orders = view === "purchased" || view === "reserved" || view === "retired";
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 lg:hidden">
      <Link href="/" className={`${tab} ${tone(false)}`}>
        <Home size={20} /> Home
      </Link>
      <button type="button" onClick={() => onNavigate("available")} className={`${tab} ${tone(view === "available")}`}>
        <ShoppingCart size={20} /> Marketplace
      </button>
      <button type="button" onClick={() => onNavigate("purchased")} className={`${tab} ${tone(orders)}`}>
        <Layers size={20} /> Orders
      </button>
      <button type="button" onClick={() => onNavigate("certificates")} className={`${tab} ${tone(view === "certificates")}`}>
        <FileBadge size={20} /> Certificates
      </button>
      <button type="button" onClick={onProfile} className={`${tab} ${tone(false)}`}>
        <User size={20} /> Profile
      </button>
    </nav>
  );
}
