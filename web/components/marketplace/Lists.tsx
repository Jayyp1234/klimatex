"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Check, Copy, FileBadge, MoreVertical, TrendingUp } from "lucide-react";
import { Co2Text } from "@/components/Co2Text";
import { formatCountdown, formatDate, formatNaira, paymentLabel, projectForSerial, type Credit, type Order, type Project } from "@/lib/marketplace";

export const primaryButton = "inline-flex items-center justify-center rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-forest-hover";
const quietButton = "rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-mint";

function Pill({ tone, children }: { tone: "green" | "amber" | "forest"; children: ReactNode }) {
  const tones = { green: "bg-[#e4f3d5] text-[#27500a]", amber: "bg-[#faeeda] text-[#633806]", forest: "bg-forest text-white" };
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export type Column<T> = { header: ReactNode; cell: (row: T) => ReactNode; align?: "right"; width?: string };

/** A table at tablet width and up; each row becomes a labelled card on phones. */
function DataList<T>({ rows, rowKey, columns, actions, empty }: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  actions: (row: T) => ReactNode;
  empty: ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-body">{empty}</div>;
  }
  return (
    <>
      <table className="hidden w-full table-fixed text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-[13px] font-semibold text-ink">
            {columns.map((column, index) => (
              <th key={index} scope="col" className={`py-3 pr-4 font-semibold ${column.align === "right" ? "text-right" : ""}`} style={{ width: column.width }}>
                {column.header}
              </th>
            ))}
            <th scope="col" className="w-[150px] py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-b-0">
              {columns.map((column, index) => (
                <td key={index} className={`py-3.5 pr-4 align-middle ${column.align === "right" ? "text-right" : ""}`}>
                  {column.cell(row)}
                </td>
              ))}
              <td className="py-3.5">
                <div className="flex items-center gap-1">{actions(row)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border border-line p-4">
            <dl className="space-y-2">
              {columns.map((column, index) => (
                <div key={index} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="shrink-0 text-muted">{column.header}</dt>
                  <dd className="min-w-0 text-right font-medium">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">{actions(row)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

function RowMenu({ serial, onViewProject }: { serial: string; onViewProject: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(serial);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <details
      className="group relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
      }}
    >
      <summary aria-label={`More actions for ${serial}`} className="flex cursor-pointer list-none rounded-md p-1.5 text-ink hover:bg-mint [&::-webkit-details-marker]:hidden">
        <MoreVertical size={18} />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-line bg-white p-1 shadow-xl">
        <button type="button" onClick={copy} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-mint">
          {copied ? <Check size={14} className="text-leaf" /> : <Copy size={14} />} {copied ? "Copied" : "Copy serial"}
        </button>
        <button type="button" onClick={onViewProject} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-mint">
          <FileBadge size={14} /> View project
        </button>
      </div>
    </details>
  );
}

const Serial = ({ value }: { value: string }) => <span className="break-all text-[13px] tabular-nums">{value}</span>;

const ProjectCell = ({ name, location }: { name: string; location: string }) => (
  <>
    <span className="block font-medium">{name}</span>
    <span className="hidden text-[13px] text-muted md:block">{location}</span>
  </>
);

export function AvailableList({ credits, onReserve, onViewProject, onReset }: {
  credits: Credit[];
  onReserve: (credit: Credit) => void;
  onViewProject: (credit: Credit) => void;
  onReset: () => void;
}) {
  const columns: Column<Credit>[] = [
    { header: "Credit Serial", cell: (c) => <Serial value={c.serial} />, width: "25%" },
    { header: "Project / Location", cell: (c) => <ProjectCell name={c.project} location={c.location} />, width: "25%" },
    { header: "Vintage", cell: (c) => c.vintage },
    { header: <Co2Text text="tCO₂e" />, cell: (c) => c.tonnes.toFixed(1) },
    { header: "Price (₦)", cell: (c) => c.priceNaira.toLocaleString("en-NG") },
    { header: "Status", cell: () => <Pill tone="green">Available</Pill> },
  ];
  return (
    <DataList
      rows={credits}
      rowKey={(c) => c.serial}
      columns={columns}
      actions={(c) => (
        <>
          <button type="button" onClick={() => onReserve(c)} className={primaryButton}>Reserve</button>
          <RowMenu serial={c.serial} onViewProject={() => onViewProject(c)} />
        </>
      )}
      empty={
        <>
          No credits match these filters.{" "}
          <button type="button" onClick={onReset} className="font-medium text-leaf underline">Reset filters</button>
        </>
      }
    />
  );
}

/** The phone's project card from the design. Buyers pick a quantity instead of a serial. */
export function ProjectCardMobile({ project, available, price, onReserve }: { project: Project; available: number; price: number; onReserve: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line p-3 md:hidden">
      <Image src="/images/home-thumb.webp" alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{project.name}</p>
        <p className="text-xs text-muted">
          Vintage {project.vintage} · <Co2Text text={`${available} tCO₂e`} />
        </p>
        <p className="mt-1 text-sm font-semibold">
          {formatNaira(price)} <span className="text-xs font-normal text-muted"><Co2Text text="/ tCO₂e" /></span>
        </p>
      </div>
      <button type="button" disabled={available === 0} onClick={onReserve} className="rounded-full border border-forest px-3.5 py-1.5 text-xs font-medium text-forest hover:bg-mint disabled:opacity-40">
        Reserve
      </button>
    </div>
  );
}

export function AvailableStatMobile({ available }: { available: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-[#fbfcfa] p-4 md:hidden">
      <div>
        <p className="text-xs text-muted">Available credits</p>
        <p className="text-xl font-semibold tracking-tight"><Co2Text text={`${available} tCO₂e`} /></p>
      </div>
      <TrendingUp size={20} className="text-leaf" aria-hidden />
    </div>
  );
}

export function ReservedList({ orders, now, onPay, onRelease, onBrowse }: {
  orders: Order[];
  now: number;
  onPay: (order: Order) => void;
  onRelease: (order: Order) => void;
  onBrowse: () => void;
}) {
  const columns: Column<Order>[] = [
    { header: "Order", cell: (o) => `#${o.id}`, width: "12%" },
    { header: "First serial", cell: (o) => <Serial value={o.serials[0]} />, width: "28%" },
    { header: <Co2Text text="tCO₂e" />, cell: (o) => o.serials.length.toFixed(1) },
    { header: "Amount", cell: (o) => formatNaira(o.amountNaira) },
    { header: "Payment", cell: (o) => <span className="text-[13px] text-body">{paymentLabel(o.paymentStatus)}</span> },
    { header: "Time left", cell: (o) => <Pill tone="amber">{formatCountdown((o.expiresAt ?? 0) - now)}</Pill> },
  ];
  return (
    <DataList
      rows={orders}
      rowKey={(o) => String(o.id)}
      columns={columns}
      actions={(o) => (
        <>
          <button type="button" onClick={() => onPay(o)} className={primaryButton}>Pay</button>
          <button type="button" onClick={() => onRelease(o)} className={quietButton}>Release</button>
        </>
      )}
      empty={
        <>
          You have no active reservations.{" "}
          <button type="button" onClick={onBrowse} className="font-medium text-leaf underline">Browse credits</button>
        </>
      }
    />
  );
}

export function PurchasedList({ orders, onCertificate }: { orders: Order[]; onCertificate: (order: Order) => void }) {
  const columns: Column<Order>[] = [
    { header: "Order", cell: (o) => `#${o.id}`, width: "12%" },
    { header: <Co2Text text="tCO₂e" />, cell: (o) => o.serials.length.toFixed(1) },
    { header: "Amount", cell: (o) => formatNaira(o.amountNaira) },
    { header: "Paid on", cell: (o) => formatDate(o.retiredOn) },
    { header: "Status", cell: (o) => (o.status === "settled" ? <Pill tone="green">Settled</Pill> : <Pill tone="amber">Paying out</Pill>) },
  ];
  return (
    <DataList
      rows={orders}
      rowKey={(o) => String(o.id)}
      columns={columns}
      actions={(o) => <button type="button" onClick={() => onCertificate(o)} className={quietButton}>Certificate</button>}
      empty="You haven't bought any credits yet."
    />
  );
}

type RetiredRow = { serial: string; order: Order };

export function RetiredList({ orders, buyerName, projects, onCertificate }: { orders: Order[]; buyerName: string; projects: Project[]; onCertificate: (order: Order) => void }) {
  const rows: RetiredRow[] = orders.flatMap((order) => order.serials.map((serial) => ({ serial, order })));
  const columns: Column<RetiredRow>[] = [
    { header: "Credit Serial", cell: (r) => <Serial value={r.serial} />, width: "28%" },
    {
      header: "Project / Location",
      cell: (r) => {
        const item = projectForSerial(projects, r.serial);
        return <ProjectCell name={item?.name ?? ""} location={item?.location ?? ""} />;
      },
      width: "26%",
    },
    { header: "Retired for", cell: () => buyerName },
    { header: "Retired on", cell: (r) => formatDate(r.order.retiredOn) },
  ];
  return (
    <DataList
      rows={rows}
      rowKey={(r) => r.serial}
      columns={columns}
      actions={(r) => <button type="button" disabled={!r.order.certificate} onClick={() => onCertificate(r.order)} className={quietButton}>Certificate</button>}
      empty="Credits you retire will appear here."
    />
  );
}

export function CertificateGrid({ orders, onOpen }: { orders: Order[]; onOpen: (order: Order) => void }) {
  if (orders.length === 0) {
    return <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-body">Certificates appear here after you retire credits.</div>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <li key={order.id} className="rounded-xl border border-line p-5">
          <FileBadge size={24} className="text-forest" aria-hidden />
          <p className="mt-3 font-mono text-[13px] font-medium">{order.certificate}</p>
          <p className="mt-1 text-sm text-body">
            <Co2Text text={`${order.serials.length} tCO₂e`} /> retired on {formatDate(order.retiredOn)}
          </p>
          {order.serialRange && <p className="mt-1 text-[12px] text-muted">Registry batch <span className="font-mono">{order.serialRange}</span></p>}
          <button type="button" onClick={() => onOpen(order)} className={`${quietButton} mt-4`}>View certificate</button>
        </li>
      ))}
    </ul>
  );
}
