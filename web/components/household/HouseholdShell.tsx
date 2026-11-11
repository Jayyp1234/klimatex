"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileBadge,
  Headphones,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PauseCircle,
  Settings,
  SlidersHorizontal,
  MessageSquare,
  Sparkles,
  TriangleAlert,
  User,
  Wallet,
  WifiOff,
} from "lucide-react";
import { VerifyDialog } from "@/components/VerifyCredit";
import { api, getSession, signOut, type User as SessionUser } from "@/lib/api";
import { formatPhone } from "@/lib/payout";
import { homeCode, loadDashboard, shortDate, type Alert, type Dashboard, type Payout } from "@/lib/household";
import { initialsOf } from "@/lib/marketplace";
import { homeFor } from "@/lib/workspaces";
import { HeldDialog, PayoutDialog } from "./Dialogs";

type Icon = ComponentType<{ size?: number; className?: string }>;

type Context = {
  user: SessionUser;
  data: Dashboard;
  alerts: Alert[];
  lang: string;
  setLang: (lang: string) => void;
  dismiss: (id: string) => void;
  restoreAlerts: () => void;
  dismissedCount: number;
  openPayout: (payout: Payout) => void;
  openHeld: () => void;
};

const HouseholdContext = createContext<Context | null>(null);

export function useHousehold(): Context {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error("useHousehold must be used inside HouseholdShell");
  return context;
}

const BASE = "/app/household/";
type NavItem = { label: string; icon: Icon; href?: string; children?: { label: string; href: string }[] };

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: BASE },
  { label: "Ask KlimateX", icon: Sparkles, href: `${BASE}assistant/` },
  { label: "Monthly message", icon: MessageSquare, href: `${BASE}messages/` },
  {
    label: "Energy",
    icon: BarChart3,
    children: [
      { label: "Overview", href: `${BASE}energy/` },
      { label: "Daily readings", href: `${BASE}energy/readings/` },
      { label: "Monthly summary", href: `${BASE}energy/monthly/` },
      { label: "Fuel receipts", href: `${BASE}receipts/` },
    ],
  },
  {
    label: "Payouts",
    icon: Wallet,
    children: [
      { label: "Payout history", href: `${BASE}payouts/` },
      { label: "Credits & serials", href: `${BASE}payouts/credits/` },
    ],
  },
  { label: "Loan", icon: Landmark, href: `${BASE}loan/` },
  { label: "Certificate", icon: FileBadge, href: `${BASE}certificate/` },
  { label: "Notifications", icon: Bell, href: `${BASE}notifications/` },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { label: "Profile", href: `${BASE}settings/` },
      { label: "Payment details", href: `${BASE}settings/payments/` },
      { label: "Preferences", href: `${BASE}settings/preferences/` },
    ],
  },
];

const ALERT_ICON: Record<Alert["kind"], { icon: Icon; tone: string }> = {
  payout: { icon: CalendarCheck, tone: "bg-[#fdf3d7] text-[#8a5a00]" },
  low_output: { icon: TriangleAlert, tone: "bg-red-50 text-red-700" },
  no_data: { icon: WifiOff, tone: "bg-red-50 text-red-700" },
  held: { icon: PauseCircle, tone: "bg-[#faeeda] text-[#633806]" },
};
export const alertIcon = ALERT_ICON;

const DISMISSED_KEY = "klimatex.dismissed-alerts";
const LANG_KEY = "klimatex.lang";

function readStorage(store: "session" | "local", key: string): string | null {
  try {
    return (store === "session" ? sessionStorage : localStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(store: "session" | "local", key: string, value: string) {
  try {
    (store === "session" ? sessionStorage : localStorage).setItem(key, value);
  } catch {
    // Storage can be blocked; the preference then lasts for this page only.
  }
}

/** Closes a drop-down when the user clicks elsewhere or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function SidebarNav({ path, alerts, onNavigate }: { path: string; alerts: number; onNavigate: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV.filter((n) => n.children).map((n) => [n.label, n.children!.some((c) => c.href === path)])),
  );
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition";

  return (
    <nav aria-label="Household" className="space-y-0.5">
      {NAV.map((n) => {
        const NavIcon = n.icon;
        if (!n.children) {
          const active = path === n.href;
          return (
            <Link key={n.label} href={n.href!} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={`${item} ${active ? "bg-forest text-white" : "text-ink hover:bg-mint"}`}>
              <NavIcon size={18} /> {n.label}
              {n.label === "Notifications" && alerts > 0 && (
                <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-white text-forest" : "bg-lime text-forest"}`}>{alerts}</span>
              )}
            </Link>
          );
        }
        const expanded = open[n.label];
        const childActive = n.children.some((c) => c.href === path);
        return (
          <div key={n.label}>
            <button type="button" aria-expanded={expanded} onClick={() => setOpen((s) => ({ ...s, [n.label]: !s[n.label] }))}
              className={`${item} ${childActive ? "text-forest" : "text-ink"} hover:bg-mint`}>
              <NavIcon size={18} /> {n.label}
              <ChevronDown size={16} className={`ml-auto text-muted transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {expanded && (
              <div className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-line pl-3">
                {n.children.map((c) => {
                  const active = path === c.href;
                  return (
                    <Link key={c.href} href={c.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${active ? "bg-mint-strong text-forest" : "text-body hover:bg-mint hover:text-ink"}`}>
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBody({ path, alerts, home, onNavigate }: { path: string; alerts: number; home: Dashboard["home"]; onNavigate: () => void }) {
  return (
    <>
      <Link href="/" className="px-2" onClick={onNavigate}>
        <Image src="/logo.svg" alt="KlimateX" width={140} height={35} priority className="h-7 w-auto" />
      </Link>
      <p className="mt-1 px-2 text-xs text-muted">Household app</p>
      <div className="mt-7 flex-1 overflow-y-auto">
        <SidebarNav path={path} alerts={alerts} onNavigate={onNavigate} />
        <div className="mt-5 border-t border-line pt-4">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Support</p>
          {[
            { label: "Help Center", icon: CircleHelp, href: `${BASE}help/` },
            { label: "Contact Support", icon: Headphones, href: `${BASE}support/` },
          ].map(({ label, icon: SupportIcon, href }) => {
            const active = path === href;
            return (
              <Link key={label} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                className={`mt-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition ${active ? "bg-forest text-white" : "text-ink hover:bg-mint"}`}>
                <SupportIcon size={18} /> {label}
              </Link>
            );
          })}
        </div>
      </div>
      <Link href={`${BASE}certificate/`} onClick={onNavigate} className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-white p-3 hover:bg-mint">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint text-forest"><Home size={19} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{homeCode(home.siteId)}</span>
          <span className="block truncate text-xs text-muted">{home.area}, Lagos</span>
        </span>
      </Link>
    </>
  );
}

function Breadcrumbs({ path }: { path: string }) {
  const trail: string[] = [];
  for (const n of NAV) {
    if (n.href === path) trail.push(n.label);
    const child = n.children?.find((c) => c.href === path);
    if (child) trail.push(n.label, child.label);
  }
  if (path === `${BASE}help/`) trail.push("Support", "Help Center");
  if (path === `${BASE}support/`) trail.push("Support", "Contact Support");
  return (
    <ol className="flex items-center gap-1.5 text-[13px] text-muted">
      <li><Link href={BASE} className="hover:text-ink">Home</Link></li>
      {trail.map((t, i) => (
        <li key={t} className="flex items-center gap-1.5">
          <ChevronRight size={14} aria-hidden />
          <span className={i === trail.length - 1 ? "font-medium text-ink" : ""}>{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function HouseholdShell({ children }: { children: ReactNode }) {
  const path = (usePathname() ?? BASE).replace(/\/?$/, "/");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lang, setLangState] = useState("en");
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<"bell" | "profile" | null>(null);
  const [payout, setPayout] = useState<Payout | null>(null);
  const [held, setHeld] = useState(false);
  const closeMenu = () => setMenu(null);
  const bellRef = useDismiss(menu === "bell", closeMenu);
  const profileRef = useDismiss(menu === "profile", closeMenu);

  useEffect(() => {
    if (!getSession()) {
      window.location.replace("/app/");
      return;
    }
    api<SessionUser>("/api/auth/me")
      .then((me) => {
        if (me.role !== "household") {
          window.location.replace(homeFor(me.role));
          return;
        }
        setUser(me);
        setDismissed(JSON.parse(readStorage("session", DISMISSED_KEY) ?? "[]"));
        setLangState(readStorage("local", LANG_KEY) ?? "en");
      })
      .catch(() => window.location.replace("/app/"));
  }, []);

  useEffect(() => {
    if (!user) return;
    let stale = false;
    loadDashboard()
      .then((next) => {
        if (!stale) {
          setData(next);
          setError("");
        }
      })
      .catch((e) => !stale && setError(e instanceof Error ? e.message : "Your home couldn't be loaded."));
    return () => {
      stale = true;
    };
  }, [user, version]);

  if (!user || (!data && !error)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your home…</div>;
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-body">{error}</p>
        <button type="button" onClick={() => setVersion((v) => v + 1)} className="rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-white">Try again</button>
      </div>
    );
  }

  const alerts = data.alerts.filter((a) => !dismissed.includes(a.id));
  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writeStorage("session", DISMISSED_KEY, JSON.stringify(next));
  };
  const restoreAlerts = () => {
    setDismissed([]);
    writeStorage("session", DISMISSED_KEY, "[]");
  };
  const setLang = (next: string) => {
    setLangState(next);
    writeStorage("local", LANG_KEY, next);
  };
  const leave = async () => {
    await signOut();
    window.location.replace("/app/");
  };

  const context: Context = {
    user,
    data,
    alerts,
    lang,
    setLang,
    dismiss,
    restoreAlerts,
    dismissedCount: data.alerts.length - alerts.length,
    openPayout: setPayout,
    openHeld: () => setHeld(true),
  };

  return (
    <HouseholdContext.Provider value={context}>
      <div className="min-h-screen bg-[#f6f8f5] text-ink lg:grid lg:grid-cols-[256px_minmax(0,1fr)] print:block print:bg-white">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-[#fbfcfa] px-4 pb-4 pt-6 lg:flex print:hidden">
          <SidebarBody path={path} alerts={alerts.length} home={data.home} onNavigate={() => undefined} />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/40" />
            <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[#fbfcfa] px-4 pb-4 pt-6 shadow-2xl">
              <SidebarBody path={path} alerts={alerts.length} home={data.home} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-line bg-[#f6f8f5]/95 backdrop-blur print:hidden">
            <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
              <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-lg p-2 text-ink hover:bg-mint lg:hidden">
                <Menu size={20} />
              </button>
              <Link href={BASE} aria-label="Dashboard" className="sm:hidden">
                <Image src="/logo.svg" alt="KlimateX" width={112} height={28} className="h-6 w-auto" />
              </Link>
              <div className="hidden sm:block"><Breadcrumbs path={path} /></div>

              <div className="ml-auto flex items-center gap-2.5">
                <div ref={bellRef} className="relative">
                  <button type="button" onClick={() => setMenu(menu === "bell" ? null : "bell")} aria-expanded={menu === "bell"} aria-haspopup="true" aria-label={`Notifications: ${alerts.length}`}
                    className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white hover:bg-mint">
                    <Bell size={18} />
                    {alerts.length > 0 && <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-forest px-1 text-[10px] font-semibold text-white">{alerts.length}</span>}
                  </button>
                  {menu === "bell" && (
                    <div className="absolute right-0 top-12 w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-white shadow-2xl">
                      <div className="flex items-center justify-between border-b border-line px-4 py-3">
                        <p className="text-sm font-semibold">Notifications</p>
                        <span className="text-xs text-muted">{alerts.length} active</span>
                      </div>
                      {alerts.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-body">All clear. Nothing needs your attention.</p>
                      ) : (
                        <ul className="max-h-[320px] overflow-y-auto p-2">
                          {alerts.slice(0, 4).map((a) => {
                            const { icon: AlertIcon, tone } = ALERT_ICON[a.kind];
                            return (
                              <li key={a.id} className="flex gap-3 rounded-xl p-2.5 hover:bg-[#fafbf9]">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}><AlertIcon size={16} /></span>
                                <div className="min-w-0">
                                  <p className="text-[13.5px] font-semibold">{a.title}</p>
                                  <p className="text-[12.5px] leading-snug text-body">{a.body}</p>
                                  <p className="mt-0.5 text-[11px] text-muted">{shortDate(a.at)}</p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <Link href={`${BASE}notifications/`} onClick={closeMenu} className="block border-t border-line px-4 py-3 text-center text-[13px] font-medium text-leaf hover:bg-[#fafbf9]">
                        View all notifications
                      </Link>
                    </div>
                  )}
                </div>

                <div ref={profileRef} className="relative">
                  <button type="button" onClick={() => setMenu(menu === "profile" ? null : "profile")} aria-expanded={menu === "profile"} aria-haspopup="true"
                    className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white pl-1.5 pr-2.5 hover:bg-mint">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-[11px] font-semibold text-white">{initialsOf(user.name)}</span>
                    <span className="hidden text-[13.5px] font-medium sm:block">{user.name}</span>
                    <ChevronDown size={15} className={`text-body transition-transform ${menu === "profile" ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {menu === "profile" && (
                    <div role="menu" className="absolute right-0 top-12 w-[240px] rounded-2xl border border-line bg-white p-1.5 shadow-2xl">
                      <div className="border-b border-line px-3 py-2.5">
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="truncate text-xs text-muted">{user.phone ? formatPhone(user.phone) : user.email}</p>
                        <p className="mt-1 text-xs text-muted">{homeCode(data.home.siteId)} · {data.home.area}</p>
                      </div>
                      {[
                        { label: "Profile", icon: User, href: `${BASE}settings/` },
                        { label: "Payment details", icon: Wallet, href: `${BASE}settings/payments/` },
                        { label: "Preferences", icon: SlidersHorizontal, href: `${BASE}settings/preferences/` },
                        { label: "Certificate", icon: FileBadge, href: `${BASE}certificate/` },
                        { label: "Help Center", icon: CircleHelp, href: `${BASE}help/` },
                      ].map(({ label, icon: ItemIcon, href }) => (
                        <Link key={label} role="menuitem" href={href} onClick={closeMenu} className="mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] hover:bg-mint">
                          <ItemIcon size={16} className="text-body" /> {label}
                        </Link>
                      ))}
                      <button type="button" role="menuitem" onClick={leave} className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg border-t border-line px-3 py-2 text-[13.5px] text-red-700 hover:bg-red-50">
                        <LogOut size={16} /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1240px] space-y-5 px-4 pb-16 pt-6 sm:px-6">{children}</main>
        </div>
      </div>

      {payout && <PayoutDialog payout={payout} onClose={() => setPayout(null)} />}
      {held && <HeldDialog siteId={data.home.siteId} checks={data.home.checks} lang={lang} onClose={() => setHeld(false)} />}
      <VerifyDialog />
      {drawer && <EscapeListener onEscape={() => setDrawer(false)} />}
    </HouseholdContext.Provider>
  );
}

function EscapeListener({ onEscape }: { onEscape: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onEscape();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onEscape]);
  return null;
}
