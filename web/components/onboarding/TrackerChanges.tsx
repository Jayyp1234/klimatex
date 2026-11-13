"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, Coins, Home, Info, Landmark, LoaderCircle, UserRound } from "lucide-react";
import { ApiError } from "@/lib/api";
import { formatNaira, initialsOf } from "@/lib/marketplace";
import { GENERATOR_LABEL, changeChoices, saveProfile, type Catalogue, type ChangeInput, type OnboardingView } from "@/lib/onboarding";
import { InlineError, InstallerBadge, PackageCard, Sheet, fieldClass, primaryButton, secondaryButton } from "./parts";

type Done = (view: OnboardingView, message: string) => void;

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");

/** What a change will do, said plainly before the family presses Save. */
function Consequences({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div role="note" className="rounded-xl border border-[#e3a600]/40 bg-[#fdf6e3] px-4 py-3 text-[13.5px] text-[#633806]">
      <p className="flex items-center gap-1.5 font-semibold"><Info size={15} aria-hidden /> What happens when you save</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function PaymentToggle({ value, onChange }: { value: "cash" | "loan" | null; onChange: (v: "cash" | "loan") => void }) {
  const options = [
    { key: "cash" as const, icon: Coins, title: "Cash", body: "Pay the installer when you accept the quote." },
    { key: "loan" as const, icon: Landmark, title: "Access loan", body: "A quick pre-check shows how much you could borrow." },
  ];
  return (
    <fieldset>
      <legend className="text-[15px] font-semibold">How you&apos;ll pay</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map(({ key, icon: Icon, title, body }) => (
          <label
            key={key}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-leaf/30 ${
              value === key ? "border-forest bg-mint ring-1 ring-forest" : "border-line bg-white hover:border-forest/40"
            }`}
          >
            <input type="radio" name="payment" value={key} checked={value === key} onChange={() => onChange(key)} className="sr-only" />
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${value === key ? "bg-forest text-white" : "bg-mint text-forest"}`}><Icon size={17} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold">{title}</span>
              <span className="block text-[12.5px] leading-snug text-body">{body}</span>
            </span>
            {value === key && <Check size={17} className="ml-auto shrink-0 text-forest" aria-hidden />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InstallerPicker({ catalogue, value, onChange, current }: { catalogue: Catalogue; value: number | null; onChange: (id: number) => void; current?: number | null }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-3 text-[15px] font-semibold">Installer for your check visit</legend>
      {catalogue.installers.map((i) => (
        <label
          key={i.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-leaf/30 ${
            value === i.id ? "border-forest bg-mint ring-1 ring-forest" : "border-line bg-white hover:border-forest/40"
          }`}
        >
          <input type="radio" name="installer" value={i.id} checked={value === i.id} onChange={() => onChange(i.id)} className="mt-1 h-4 w-4 shrink-0 accent-[#0b3f2a]" />
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest text-[12px] font-semibold text-lime">{initialsOf(i.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14.5px] font-semibold">{i.name}</span>
              {current === i.id && <span className="rounded-md bg-[#fdf3d7] px-1.5 py-0.5 text-[11px] font-semibold text-[#8a5a00]">Current</span>}
              <InstallerBadge installer={i} />
            </span>
            <span className="mt-0.5 block text-[12.5px] text-body">{i.area} · {i.blurb}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function PackageGrid({ catalogue, value, current, onChange }: { catalogue: Catalogue; value: number | null; current?: number | null; onChange: (id: number) => void }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold">Package</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {catalogue.installers.flatMap((i) =>
          i.packages.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              installerName={i.name}
              range={catalogue.price_range_naira}
              selected={value === p.id}
              current={current === p.id}
              estimate={false}
              chooseLabel="Pick this one"
              onChoose={() => onChange(p.id)}
            />
          )),
        )}
      </div>
    </div>
  );
}

function SaveBar({ busy, disabled, label, onCancel, hint }: { busy: boolean; disabled: boolean; label: string; onCancel: () => void; hint?: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      {hint && <p className="mb-2 text-[12.5px] text-muted">{hint}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={`${secondaryButton} h-11`}>Keep things as they are</button>
        <button type="submit" disabled={busy || disabled} className={`${primaryButton} h-11`}>
          {busy && <LoaderCircle size={17} className="animate-spin" aria-hidden />} {label}
        </button>
      </div>
    </div>
  );
}

/** "Change my choices": another package or cash ↔ loan (path A), or installer, inverter and generator (path B). */
export function ChangeSheet({ view, catalogue, onClose, onDone }: { view: OnboardingView; catalogue: Catalogue; onClose: () => void; onDone: Done }) {
  const [packageId, setPackageId] = useState<number | null>(view.package?.id ?? null);
  const [payment, setPayment] = useState<"cash" | "loan" | null>(view.payment);
  const [installerId, setInstallerId] = useState<number | null>(view.installer?.id ?? null);
  const [brand, setBrand] = useState(view.inverter.brand ?? "");
  const [serial, setSerial] = useState(view.inverter.serial ?? "");
  const [generator, setGenerator] = useState(view.generator ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const need = view.path === "need";
  const body: ChangeInput = {};
  if (need) {
    if (packageId && packageId !== view.package?.id) body.package_id = packageId;
    if (payment && payment !== view.payment) body.payment = payment;
  } else {
    if (installerId && installerId !== view.installer?.id) body.installer_id = installerId;
    if (brand && brand !== (view.inverter.brand ?? "")) body.inverter_brand = brand;
    if (serial.trim() && serial.trim() !== (view.inverter.serial ?? "")) body.inverter_serial = serial.trim();
    if (generator && generator !== (view.generator ?? "")) body.generator = generator;
  }
  const changed = Object.keys(body).length > 0;

  const packages = catalogue.installers.flatMap((i) => i.packages.map((p) => ({ ...p, installer: i })));
  const newPackage = packages.find((p) => p.id === packageId);
  const newInstaller = need ? newPackage?.installer ?? null : catalogue.installers.find((i) => i.id === installerId) ?? null;
  const oldInstaller = view.installer;
  const sentAlready = view.status !== "started";

  const consequences: string[] = [];
  if (changed) {
    if (view.status === "requested") {
      consequences.push(`${newInstaller?.name ?? "The installer"} gets your updated request. Nothing else changes.`);
      if (oldInstaller && newInstaller && oldInstaller.id !== newInstaller.id) consequences.push(`${oldInstaller.name} stops seeing your request.`);
    } else if (sentAlready) {
      consequences.push(`Your request goes to ${newInstaller?.name ?? "the installer"} again, as a new request.`);
      consequences.push(
        view.quote_naira !== null
          ? `Your quote of ${formatNaira(view.quote_naira)}${view.survey_on ? " and your survey date are" : " is"} dropped. The installer quotes again.`
          : view.survey_on
            ? `Your ${need ? "survey" : "visit"} date is dropped. The installer books a new one.`
            : "Any quote or visit date is dropped.",
      );
      if (oldInstaller && newInstaller && oldInstaller.id !== newInstaller.id) consequences.push(`${oldInstaller.name} stops seeing your request.`);
    } else {
      consequences.push("Your choices are saved straight away. Nothing has gone to an installer yet.");
    }
    if (need && payment === "loan" && view.payment !== "loan" && !view.loan?.income_band) {
      consequences.push("You'll do the quick Access loan pre-check first. Then you send your request.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed) return;
    setBusy(true);
    setError("");
    try {
      const next = await changeChoices(body);
      onDone(next, next.next.by === "family" && next.next.action !== "accept_quote" ? "Changes saved. Finish the next step to send your request." : `Changes saved. Your request went to ${next.installer?.name ?? "your installer"} again.`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title="Change my choices" description="You can change these until you accept a quote." onClose={onClose} wide={need}>
      <form onSubmit={submit} className="space-y-6">
        {need ? (
          <>
            <PackageGrid catalogue={catalogue} value={packageId} current={view.package?.id} onChange={setPackageId} />
            <PaymentToggle value={payment} onChange={setPayment} />
          </>
        ) : (
          <>
            <InstallerPicker catalogue={catalogue} value={installerId} current={view.installer?.id} onChange={setInstallerId} />
            <fieldset className="space-y-4">
              <legend className="mb-3 text-[15px] font-semibold">Your inverter</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="change-brand" className="text-sm font-medium text-ink">Brand</label>
                  <select id="change-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={`${fieldClass} mt-1.5`}>
                    <option value="" disabled>Choose a brand</option>
                    {catalogue.options.inverter_brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="change-serial" className="text-sm font-medium text-ink">Serial number</label>
                  <input
                    id="change-serial"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                    aria-describedby="change-serial-help"
                    className={`${fieldClass} mt-1.5 font-mono tracking-wide`}
                  />
                </div>
              </div>
              <p id="change-serial-help" className="text-[12.5px] text-muted">6 to 40 letters and numbers, from the sticker on the side of the inverter.</p>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-[15px] font-semibold">Your generator</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {catalogue.options.generator.map((g) => (
                  <label
                    key={g.key}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-[14px] transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-leaf/30 ${
                      generator === g.key ? "border-forest bg-mint font-semibold text-forest ring-1 ring-forest" : "border-line bg-white hover:border-forest/40"
                    }`}
                  >
                    <input type="radio" name="generator" value={g.key} checked={generator === g.key} onChange={() => setGenerator(g.key)} className="sr-only" />
                    {GENERATOR_LABEL[g.key] ?? g.label}
                    {generator === g.key && <Check size={16} aria-hidden />}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <Consequences items={consequences} />
        <InlineError message={error} />
        <SaveBar busy={busy} disabled={!changed} label="Save my changes" onCancel={onClose} hint={changed ? undefined : "Pick something different to save a change."} />
      </form>
    </Sheet>
  );
}

/** Name and area, editable at any time. */
export function DetailsSheet({ name, area, onClose, onDone }: { name: string; area: string; onClose: () => void; onDone: (view: OnboardingView, name: string) => void }) {
  const [newName, setNewName] = useState(name);
  const [newArea, setNewArea] = useState(area);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const body: { name?: string; area?: string } = {};
  if (newName.trim() && newName.trim() !== name) body.name = newName.trim();
  if (newArea.trim() && newArea.trim() !== area) body.area = newArea.trim();
  const changed = Object.keys(body).length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed) return;
    setBusy(true);
    setError("");
    try {
      onDone(await saveProfile(body), body.name ?? name);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title="Edit my details" description="Your installer sees the new details straight away. This doesn't change your request." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="edit-name" className="text-sm font-medium text-ink">Your name</label>
          <div className="relative mt-1.5">
            <UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input id="edit-name" required minLength={2} maxLength={60} autoComplete="name" value={newName} onChange={(e) => setNewName(e.target.value)} className={`${fieldClass} pl-11`} />
          </div>
        </div>
        <div>
          <label htmlFor="edit-area" className="text-sm font-medium text-ink">Area the home is in</label>
          <div className="relative mt-1.5">
            <Home size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input id="edit-area" required minLength={2} maxLength={60} autoComplete="address-level2" value={newArea} onChange={(e) => setNewArea(e.target.value)} className={`${fieldClass} pl-11`} />
          </div>
        </div>
        <InlineError message={error} />
        <SaveBar busy={busy} disabled={!changed} label="Save details" onCancel={onClose} />
      </form>
    </Sheet>
  );
}

/** After cancelling: pick a package (path A) or an installer (path B) and send the request again. */
export function RestartPanel({ view, catalogue, onDone }: { view: OnboardingView; catalogue: Catalogue; onDone: Done }) {
  const need = view.path === "need";
  const [packageId, setPackageId] = useState<number | null>(view.package?.id ?? null);
  const [payment, setPayment] = useState<"cash" | "loan" | null>(view.payment ?? "cash");
  const [installerId, setInstallerId] = useState<number | null>(view.installer?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = need ? Boolean(packageId && payment) : Boolean(installerId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const next = await changeChoices(need ? { package_id: packageId!, payment: payment! } : { installer_id: installerId! });
      onDone(next, next.next.by === "family" ? "You're back on. Finish the next step to send your request." : `You're back on. Your request went to ${next.installer?.name ?? "your installer"}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="restart-heading" className="kx-step-in space-y-5 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 id="restart-heading" className="text-[17px] font-semibold tracking-tight">Start again</h2>
        <p className="mt-0.5 text-[13.5px] text-body">
          {need ? "Your last choice is picked. Keep it or choose another package, then send your request." : "Pick the installer for your check visit. Your inverter and generator details are kept."}
        </p>
      </div>
      {need ? (
        <>
          <PackageGrid catalogue={catalogue} value={packageId} current={view.package?.id} onChange={setPackageId} />
          <PaymentToggle value={payment} onChange={setPayment} />
        </>
      ) : (
        <InstallerPicker catalogue={catalogue} value={installerId} current={view.installer?.id} onChange={setInstallerId} />
      )}
      <InlineError message={error} />
      <button type="submit" disabled={busy || !ready} className={`${primaryButton} w-full sm:w-auto`}>
        {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden /> : null} Start again <ArrowRight size={17} aria-hidden />
      </button>
    </form>
  );
}
