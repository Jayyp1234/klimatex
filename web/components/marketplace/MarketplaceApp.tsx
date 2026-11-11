"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ArrowRight, Calendar, ChevronDown, Leaf, MapPin, Recycle, ShieldCheck, Star, Tag } from "lucide-react";
import { ApiError, api, getSession, signOut, type User } from "@/lib/api";
import { homeFor } from "@/lib/workspaces";
import { Co2Text } from "@/components/Co2Text";
import {
  RESERVATION_MINUTES,
  confirmOrder,
  fetchCredits,
  fetchOrders,
  fetchOverview,
  formatNaira,
  initialsOf,
  isPurchased,
  releaseOrder,
  reserveCredits,
  simulatePayment,
  waitingMessage,
  type Credit,
  type Filters,
  type Order,
  type Overview,
  type Project,
  type View,
} from "@/lib/marketplace";
import { CertificateDialog, PayDialog, ProfileDialog, ProjectDialog, ReserveDialog } from "./Dialogs";
import { AvailableList, AvailableStatMobile, CertificateGrid, ProjectCardMobile, PurchasedList, ReservedList, RetiredList } from "./Lists";
import { BottomNav, Sidebar, Topbar } from "./Navigation";
import { SupplyChart } from "./SupplyChart";

type Dialog =
  | { kind: "reserve"; serial: string | null; project: Project }
  | { kind: "pay"; order: Order }
  | { kind: "certificate"; order: Order }
  | { kind: "project"; project: Project }
  | { kind: "profile" }
  | null;

type Notice = { text: string; error?: boolean } | null;

const NO_FILTERS: Filters = { location: "all", vintage: "all", authorisation: "all" };

const describe = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Try again.");

function Select({ icon: Icon, label, value, options, onChange }: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <Icon size={16} className="pointer-events-none absolute left-3 text-ink" aria-hidden />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 appearance-none rounded-lg border border-line bg-white pl-9 pr-9 text-[13px] font-medium text-ink outline-none hover:bg-[#fbfcfa] focus:border-leaf focus:ring-2 focus:ring-leaf/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {label}: {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 text-body" aria-hidden />
    </label>
  );
}

function Stat({ icon: Icon, label, children }: { icon: ComponentType<{ size?: number; className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-line bg-white p-4">
      <Icon size={26} className="shrink-0 text-forest" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] text-body">{label}</p>
        <p className="mt-0.5 whitespace-nowrap text-[20px] font-semibold tracking-tight">{children}</p>
      </div>
    </div>
  );
}

const TABS: { view: View; label: string }[] = [
  { view: "available", label: "Available Credits" },
  { view: "reserved", label: "Reserved" },
  { view: "purchased", label: "Purchased" },
  { view: "retired", label: "Retired" },
];

export function MarketplaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<View>("available");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [now, setNow] = useState(0);
  const handledReturn = useRef(false);
  const expiredSeen = useRef(new Set<number>());

  const reload = () => setVersion((current) => current + 1);

  // The server confirms who is signed in before anything is shown.
  useEffect(() => {
    if (!getSession()) {
      window.location.replace("/app/");
      return;
    }
    api<User>("/api/auth/me")
      .then((me) => {
        if (me.role !== "buyer") window.location.replace(homeFor(me.role));
        else setUser(me);
      })
      .catch(() => window.location.replace("/app/"));
  }, []);

  useEffect(() => {
    if (!user) return;
    let stale = false;
    Promise.all([fetchOverview(), fetchOrders()])
      .then(([nextOverview, nextOrders]) => {
        if (stale) return;
        setOverview(nextOverview);
        setOrders(nextOrders);
        setNow(Date.now());
        setLoadError("");
      })
      .catch((error) => {
        if (!stale) setLoadError(describe(error));
      });
    return () => {
      stale = true;
    };
  }, [user, version]);

  useEffect(() => {
    if (!user) return;
    let stale = false;
    const timer = window.setTimeout(
      () => {
        fetchCredits(filters, search)
          .then((list) => {
            if (!stale) setCredits(list);
          })
          .catch((error) => {
            if (!stale) setNotice({ text: describe(error), error: true });
          });
      },
      search ? 250 : 0,
    );
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [user, filters, search, version]);

  // Coming back from the hosted checkout: verify the payment and retire the credits.
  useEffect(() => {
    if (!user || handledReturn.current) return;
    handledReturn.current = true;
    const id = Number(new URLSearchParams(window.location.search).get("order"));
    if (!id) return;
    window.history.replaceState(null, "", window.location.pathname);
    confirmOrder(id)
      .then(({ confirmed, payment }) => {
        setView(confirmed ? "retired" : "reserved");
        setNotice({ text: confirmed ? "Payment verified. Your credits are retired." : waitingMessage(payment) });
        reload();
      })
      .catch((error) => setNotice({ text: describe(error), error: true }));
  }, [user]);

  const reserved = orders.filter((order) => order.status === "reserved");
  const purchased = orders.filter(isPurchased);
  const hasReserved = reserved.length > 0;

  // Keeps countdowns live. When one runs out, the server is asked for the truth.
  useEffect(() => {
    if (!hasReserved) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      const lapsed = reserved.filter((o) => (o.expiresAt ?? 0) <= current && !expiredSeen.current.has(o.id));
      if (lapsed.length > 0) {
        lapsed.forEach((o) => expiredSeen.current.add(o.id));
        setNotice({ text: "A reservation expired and its credits went back on sale." });
        reload();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasReserved, reserved]);

  if (!user || (!overview && !loadError)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading the marketplace…</div>;
  }

  if (!overview) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-body">{loadError}</p>
        <button type="button" onClick={reload} className="rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-white">Try again</button>
      </div>
    );
  }

  const live = overview.payments === "live";
  const price = overview.priceNaira;
  const project = overview.projects[0] ?? null;
  const states = overview.locations.join(", ");

  const navigate = (target: View) => {
    setView(target);
    setNotice(null);
  };

  const reserve = async (serials: string[]) => {
    try {
      await reserveCredits(serials);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) reload();
      throw error;
    }
    setDialog(null);
    setView("reserved");
    setNotice({ text: `${serials.length === 1 ? "Credit" : `${serials.length} credits`} reserved. Pay within ${RESERVATION_MINUTES} minutes to keep ${serials.length === 1 ? "it" : "them"}.` });
    reload();
  };

  const release = async (order: Order) => {
    try {
      await releaseOrder(order.id);
      setNotice({ text: "Reservation released. Those credits are back on sale." });
    } catch (error) {
      setNotice({ text: describe(error), error: true });
    }
    reload();
  };

  const pay = async (order: Order) => {
    if (live) {
      if (!order.paymentUrl) throw new ApiError(0, "This order has no checkout link yet. Reload and try again.");
      window.location.assign(order.paymentUrl);
      return;
    }
    await simulatePayment(order.id);
    const result = await confirmOrder(order.id);
    if (!result.confirmed) throw new ApiError(0, waitingMessage(result.payment));
    setDialog(null);
    setView("retired");
    setNotice({ text: `Payment verified. ${order.serials.length === 1 ? "1 credit" : `${order.serials.length} credits`} retired in your name.` });
    reload();
  };

  const leave = async () => {
    await signOut();
    window.location.replace("/app/");
  };

  const setFilter = (key: keyof Filters) => (value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => {
    setFilters(NO_FILTERS);
    setSearch("");
  };

  const vintageOptions = [{ value: "all", label: "All" }, ...overview.vintages.map((v) => ({ value: String(v), label: String(v) }))];
  const locationOptions = [{ value: "all", label: "All" }, ...overview.locations.map((l) => ({ value: l, label: l }))];
  const ordersView = view === "reserved" || view === "purchased" || view === "retired";
  const pill = (active: boolean) => `shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium ${active ? "bg-forest text-white" : "border border-line text-ink"}`;
  const heading = view === "certificates" ? "Certificates" : "Marketplace";

  return (
    <div className="flex min-h-screen bg-white text-ink">
      <Sidebar view={view} reservedCount={reserved.length} live={live} onNavigate={navigate} />

      <div className="min-w-0 flex-1 pb-24 lg:pb-10">
        <Topbar name={user.name} initials={initialsOf(user.name)} search={search} onSearch={setSearch} hasAlert={hasReserved} onBell={() => navigate("reserved")} onProfile={() => setDialog({ kind: "profile" })} />

        <main className="mx-auto max-w-[1180px] px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.02em]">{heading}</h1>
              <p className="mt-0.5 text-[15px] text-body">
                {view === "certificates" ? "Proof of every credit you have retired." : "Browse, reserve and buy verified carbon credits from household solar projects."}
              </p>
            </div>
            {view !== "certificates" && (
              <div className="hidden md:block">
                <Select icon={Calendar} label="Vintage" value={filters.vintage} options={vintageOptions} onChange={setFilter("vintage")} />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none] md:hidden">
            <button type="button" onClick={() => navigate("available")} className={pill(view === "available")}>Buy Credits</button>
            <button type="button" onClick={() => navigate("purchased")} className={pill(ordersView)}>My Orders</button>
            <button type="button" onClick={() => navigate("certificates")} className={pill(view === "certificates")}>Certificates</button>
          </div>

          {view !== "certificates" && (
            <>
              <section aria-label="Summary" className="mt-5 hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
                <Stat icon={Leaf} label="Available credits"><Co2Text text={`${overview.available} tCO₂e`} /></Stat>
                <Stat icon={Tag} label="Avg. price">
                  {formatNaira(price)} <span className="text-[14px] font-normal text-body"><Co2Text text="/ tCO₂e" /></span>
                </Stat>
                <Stat icon={ShieldCheck} label="Projects">
                  {overview.projects.length} {states && <span className="text-[14px] font-normal text-body">({states})</span>}
                </Stat>
                <Stat icon={Recycle} label="Retired (you)"><Co2Text text={`${overview.retiredByYou} tCO₂e`} /></Stat>
              </section>

              <section className="mt-4 hidden gap-4 md:grid xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="rounded-xl border border-line bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[18px] font-semibold tracking-tight">Credit supply</h2>
                    <p className="text-[13px] text-body">
                      Fixed price: {formatNaira(price)} <Co2Text text="/ tCO₂e" />
                    </p>
                  </div>
                  <p className="mb-3 mt-0.5 text-[13px] text-muted">
                    <Co2Text text="Available tCO₂e by the month it was generated" />
                  </p>
                  <SupplyChart data={overview.supplyByMonth} />
                </div>

                {project && (
                  <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_8px_24px_-16px_rgb(11_63_42/0.35)] md:flex-row xl:flex-col">
                    <Image src="/images/hero-roof.webp" alt="Rooftop solar panels on a Lagos home" width={928} height={290} className="h-[116px] w-full object-cover md:h-auto md:w-2/5 xl:h-[150px] xl:w-full" />
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="text-[18px] font-semibold leading-snug tracking-tight">{project.name}</h2>
                      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
                        <span className="inline-flex items-center gap-1"><MapPin size={15} aria-hidden /> {project.state}</span>
                        <span>Vintage {project.vintage}</span>
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm">
                        <Leaf size={15} className="text-leaf" aria-hidden />
                        <span><Co2Text text={`${project.minted} tCO₂e`} /></span>
                        <span aria-hidden className="h-1 w-1 rounded-full bg-leaf" />
                        Auditor signed
                      </p>
                      <button type="button" onClick={() => setDialog({ kind: "project", project })} className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-mint xl:mt-auto">
                        View project <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                )}
              </section>

              <div role="tablist" aria-label="Credits" className={`mt-6 gap-7 overflow-x-auto border-b border-line [scrollbar-width:none] ${ordersView ? "flex" : "hidden md:flex"}`}>
                {TABS.map((tab) => (
                  <button
                    key={tab.view}
                    type="button"
                    role="tab"
                    aria-selected={view === tab.view}
                    onClick={() => navigate(tab.view)}
                    className={`-mb-px shrink-0 border-b-2 pb-3 text-[15px] font-medium transition-colors ${tab.view === "available" ? "hidden md:block" : ""} ${view === tab.view ? "border-forest text-forest" : "border-transparent text-body hover:text-ink"}`}
                  >
                    {tab.label}
                    {tab.view === "reserved" && reserved.length > 0 ? ` (${reserved.length})` : ""}
                  </button>
                ))}
              </div>
            </>
          )}

          {notice && (
            <p role={notice.error ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${notice.error ? "bg-red-50 text-red-800" : "bg-mint text-forest"}`}>
              {notice.text}
            </p>
          )}

          <div className="mt-4">
            {view === "available" && (
              <>
                <AvailableStatMobile available={overview.available} />

                <div className="mt-3 flex flex-wrap items-center gap-2.5 md:mt-1">
                  <Select icon={MapPin} label="Location" value={filters.location} options={locationOptions} onChange={setFilter("location")} />
                  <Select icon={Calendar} label="Vintage" value={filters.vintage} options={vintageOptions} onChange={setFilter("vintage")} />
                  <Select icon={Star} label="Article 6" value={filters.authorisation} options={[{ value: "all", label: "All" }, { value: "yes", label: "Authorised (Article 6)" }, { value: "no", label: "Voluntary only" }]} onChange={setFilter("authorisation")} />
                  <button type="button" onClick={resetFilters} className="ml-auto px-2 text-sm font-medium text-leaf hover:underline">Reset</button>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                  {overview.projects.map((item) => (
                    <ProjectCardMobile
                      key={item.code}
                      project={item}
                      available={credits.filter((credit) => credit.project === item.name).length}
                      price={price}
                      onReserve={() => setDialog({ kind: "reserve", serial: null, project: item })}
                    />
                  ))}
                </div>

                <div className="mt-2 hidden md:block">
                  <AvailableList
                    credits={credits}
                    onReserve={(credit) => {
                      const match = overview.projects.find((p) => p.name === credit.project);
                      if (match) setDialog({ kind: "reserve", serial: credit.serial, project: match });
                    }}
                    onViewProject={(credit) => {
                      const match = overview.projects.find((p) => p.name === credit.project);
                      if (match) setDialog({ kind: "project", project: match });
                    }}
                    onReset={resetFilters}
                  />
                </div>
              </>
            )}
            {view === "reserved" && (
              <ReservedList orders={reserved} now={now} onPay={(order) => setDialog({ kind: "pay", order })} onRelease={release} onBrowse={() => navigate("available")} />
            )}
            {view === "purchased" && <PurchasedList orders={purchased} onCertificate={(order) => setDialog({ kind: "certificate", order })} />}
            {view === "retired" && <RetiredList orders={purchased} buyerName={user.name} projects={overview.projects} onCertificate={(order) => setDialog({ kind: "certificate", order })} />}
            {view === "certificates" && <CertificateGrid orders={purchased.filter((order) => order.certificate)} onOpen={(order) => setDialog({ kind: "certificate", order })} />}
          </div>
        </main>
      </div>

      <BottomNav view={view} onNavigate={navigate} onProfile={() => setDialog({ kind: "profile" })} />

      {dialog?.kind === "reserve" && (
        <ReserveDialog
          serial={dialog.serial}
          available={credits.filter((credit) => credit.project === dialog.project.name)}
          projectName={dialog.project.name}
          price={price}
          onClose={() => setDialog(null)}
          onConfirm={reserve}
        />
      )}
      {dialog?.kind === "pay" && <PayDialog order={dialog.order} live={live} onClose={() => setDialog(null)} onPay={() => pay(dialog.order)} />}
      {dialog?.kind === "certificate" && <CertificateDialog order={dialog.order} buyerName={user.name} onClose={() => setDialog(null)} />}
      {dialog?.kind === "project" && <ProjectDialog project={dialog.project} onClose={() => setDialog(null)} />}
      {dialog?.kind === "profile" && <ProfileDialog name={user.name} email={user.email} live={live} onClose={() => setDialog(null)} onSignOut={leave} />}
    </div>
  );
}
