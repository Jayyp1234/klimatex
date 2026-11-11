import { api } from "./api";

/** The buyer marketplace's view of the API. Components read only these types. */
export const RESERVATION_MINUTES = 15;

export type Credit = {
  serial: string;
  vintage: number;
  tonnes: number;
  authorised: boolean;
  project: string;
  location: string;
  priceNaira: number;
};

export type Project = {
  code: string;
  name: string;
  location: string;
  state: string;
  methodology: string;
  vintage: number;
  minted: number;
  listed: number;
  homes: number;
  auditor: string | null;
};

export type Overview = {
  available: number;
  priceNaira: number;
  retiredByYou: number;
  projects: Project[];
  supplyByMonth: { month: string; tonnes: number }[];
  vintages: number[];
  locations: string[];
  payments: "live" | "simulated";
};

export type Order = {
  id: number;
  serials: string[];
  status: string;
  amountNaira: number;
  expiresAt: number | null;
  retiredOn: string | null;
  certificate: string | null;
  serialRange: string | null;
  paymentStatus: string | null;
  paymentUrl: string | null;
};

export type View = "available" | "reserved" | "purchased" | "retired" | "certificates";
export type Filters = { location: string; vintage: string; authorisation: string };

/** Paid orders. "retiring" and "retired" are the short steps before every payout has landed. */
export const isPurchased = (order: Order) => ["retiring", "retired", "settled"].includes(order.status);

type ApiOverview = {
  available: number;
  price_naira: number;
  retired_by_you: number;
  projects: Project[];
  supply_by_month: { month: string; tonnes: number }[];
  vintages: number[];
  locations: string[];
  payments: "live" | "simulated";
};

export async function fetchOverview(): Promise<Overview> {
  const o = await api<ApiOverview>("/api/market/overview");
  return {
    available: o.available,
    priceNaira: o.price_naira,
    retiredByYou: o.retired_by_you,
    projects: o.projects,
    supplyByMonth: o.supply_by_month,
    vintages: o.vintages,
    locations: o.locations,
    payments: o.payments,
  };
}

type ApiCredit = Omit<Credit, "priceNaira"> & { price_naira: number };

export async function fetchCredits(filters: Filters, search: string): Promise<Credit[]> {
  const query = new URLSearchParams({ status: "listed" });
  if (filters.location !== "all") query.set("location", filters.location);
  if (filters.vintage !== "all") query.set("vintage", filters.vintage);
  if (filters.authorisation !== "all") query.set("authorised", filters.authorisation);
  if (search.trim()) query.set("q", search.trim());
  const data = await api<{ items: ApiCredit[] }>(`/api/credits?${query}`);
  return data.items.map(({ price_naira, ...credit }) => ({ ...credit, priceNaira: price_naira }));
}

type ApiOrder = {
  id: number;
  serials: string[];
  status: string;
  amount_naira: number;
  expires_at: string | null;
  retired_on: string | null;
  certificate: string | null;
  serial_range: string | null;
  payment_status: string | null;
  payment_url: string | null;
};

export async function fetchOrders(): Promise<Order[]> {
  const data = await api<{ orders: ApiOrder[] }>("/api/market/orders");
  return data.orders.map((o) => ({
    id: o.id,
    serials: o.serials,
    status: o.status,
    amountNaira: o.amount_naira,
    expiresAt: o.expires_at ? Date.parse(o.expires_at) : null,
    retiredOn: o.retired_on,
    certificate: o.certificate,
    serialRange: o.serial_range,
    paymentStatus: o.payment_status,
    paymentUrl: o.payment_url,
  }));
}

export const reserveCredits = (serials: string[]) => api("/api/orders", { method: "POST", body: { serials } });
export const releaseOrder = (id: number) => api(`/api/orders/${id}/release`, { method: "POST" });
export const simulatePayment = (id: number) => api(`/api/orders/${id}/simulate-payment`, { method: "POST" });

/** Verifies payment and retires the credits. `confirmed` stays false until the full amount has arrived. */
export async function confirmOrder(id: number): Promise<{ confirmed: boolean; payment: string | null }> {
  const result = await api<{ action?: string; payment?: string | null }>(`/api/orders/${id}/confirm`, { method: "POST" });
  return { confirmed: result.action !== "waiting", payment: result.payment ?? null };
}

/** Plain words for the bank's payment state on an open reservation. */
export function paymentLabel(status: string | null): string {
  switch (status) {
    case "partial":
      return "Partly paid";
    case "successful":
      return "Paid, retiring";
    case "failed":
      return "Payment failed";
    default:
      return "Awaiting payment";
  }
}

export const waitingMessage = (payment: string | null) =>
  payment === "partial"
    ? "Only part of the payment has arrived. Your credits stay reserved until the full amount is paid."
    : "The bank hasn't confirmed this payment yet. Try again shortly.";

export const formatNaira = (value: number) => `₦${value.toLocaleString("en-NG")}`;

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Not recorded";

export const formatCountdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");

export const projectForSerial = (projects: Project[], serial: string) => projects.find((p) => serial.includes(`-${p.code}-`)) ?? projects[0];
