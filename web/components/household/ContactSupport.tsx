"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleHelp,
  Clock,
  FileBadge,
  KeyRound,
  Landmark,
  LoaderCircle,
  MessageSquareText,
  Phone,
  Send,
  Smartphone,
  Wallet,
  WifiOff,
  Wrench,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { homeCode, longDate } from "@/lib/household";
import { useHousehold } from "./HouseholdShell";
import { PageHeader } from "./ui";

type Icon = ComponentType<{ size?: number; className?: string }>;
type TopicId = "system" | "payment" | "loan" | "certificate" | "account" | "other";
type Contact = "app" | "sms" | "call";

type SupportRequest = {
  id: number;
  reference: string;
  topic: TopicId;
  subject: string;
  message: string;
  contact: Contact;
  share_readings: boolean;
  status: string;
  created_at: string;
};

const TOPICS: { id: TopicId; label: string; icon: Icon; hint: string }[] = [
  { id: "system", label: "System not working", icon: WifiOff, hint: "Inverter offline, low output, damage" },
  { id: "payment", label: "Payment question", icon: Wallet, hint: "Missing, late or unexpected amount" },
  { id: "loan", label: "Solar loan", icon: Landmark, hint: "Repayments and balance" },
  { id: "certificate", label: "Certificate or grade", icon: FileBadge, hint: "Something looks wrong" },
  { id: "account", label: "Account and sign-in", icon: KeyRound, hint: "Phone, PIN, payment details" },
  { id: "other", label: "Something else", icon: CircleHelp, hint: "Anything we haven't listed" },
];

const CONTACTS: { id: Contact; label: string; icon: Icon }[] = [
  { id: "app", label: "Reply in the app", icon: MessageSquareText },
  { id: "sms", label: "Text me", icon: Smartphone },
  { id: "call", label: "Call me", icon: Phone },
];

const STEPS = ["Received", "With the team", "Resolved"];
const stepOf = (status: string) => (status === "resolved" ? 2 : status === "in_progress" ? 1 : 0);

export function ContactSupport() {
  const { user, data, alerts } = useHousehold();
  const offline = alerts.some((a) => a.kind === "no_data" || a.kind === "low_output");
  const [topic, setTopic] = useState<TopicId | null>(offline ? "system" : null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState<Contact>("app");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<SupportRequest | null>(null);
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);

  useEffect(() => {
    api<{ requests: SupportRequest[] }>("/api/support/requests")
      .then((r) => setRequests(r.requests))
      .catch(() => setRequests([]));
  }, []);

  const problems = {
    topic: !topic ? "Choose what this is about." : "",
    subject: subject.trim().length < 3 ? "Give it a short title." : "",
    message: message.trim().length < 10 ? "Tell us a little more (at least 10 characters)." : "",
  };
  const [touched, setTouched] = useState(false);
  const valid = !problems.topic && !problems.subject && !problems.message;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ request: SupportRequest }>("/api/support/requests", {
        method: "POST",
        body: { topic, subject: subject.trim(), message: message.trim(), contact, share_readings: share },
      });
      setSent(res.request);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setRequests((r) => [res.request, ...(r ?? [])]);
      setSubject("");
      setMessage("");
      setTouched(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Your message couldn't be sent. Try again.");
    }
    setBusy(false);
  };

  const field = "w-full rounded-xl border bg-white px-3.5 text-[14.5px] outline-none transition focus:border-leaf focus:ring-4 focus:ring-leaf/10";
  const bad = (k: keyof typeof problems) => touched && problems[k];

  return (
    <>
      <PageHeader title="Contact Support" description="Tell us what's wrong. Most requests get a reply within one working day." />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {sent && (
            <div className="flex gap-4 rounded-3xl border border-[#cfe5d2] bg-mint p-5">
              <CheckCircle2 size={26} className="shrink-0 text-leaf" />
              <div className="min-w-0">
                <p className="text-[15.5px] font-semibold text-forest">We&rsquo;ve got your message</p>
                <p className="mt-1 text-[13.5px] text-body">
                  Reference <span className="font-mono font-semibold text-ink">{sent.reference}</span>. We&rsquo;ll{" "}
                  {sent.contact === "call" ? "call you" : sent.contact === "sms" ? "text you" : "reply here"} within one working day.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={submit} noValidate className="rounded-3xl border border-line bg-white">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-[16px] font-semibold">What do you need help with?</h2>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {TOPICS.map((t) => {
                  const active = topic === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTopic(t.id)}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${active ? "border-forest bg-mint/60 ring-2 ring-forest/15" : "border-line hover:bg-[#f7faf6]"}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-forest text-white" : "bg-[#f3f6f2] text-forest"}`}><t.icon size={17} /></span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">{t.label}</span>
                        <span className="block text-[12px] text-muted">{t.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {bad("topic") && <p className="mt-2 text-[12.5px] text-red-700">{problems.topic}</p>}
            </div>

            <div className="space-y-4 px-6 py-5">
              <label className="block">
                <span className="text-[13px] font-medium">Title</span>
                <input value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="For example: inverter light is off"
                  className={`${field} mt-1.5 h-11 ${bad("subject") ? "border-red-300" : "border-line"}`} />
                {bad("subject") && <span className="mt-1 block text-[12.5px] text-red-700">{problems.subject}</span>}
              </label>
              <label className="block">
                <span className="flex items-baseline justify-between text-[13px] font-medium">
                  What happened? <span className="text-[12px] font-normal text-muted">{message.length} / 2000</span>
                </span>
                <textarea value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} rows={5}
                  placeholder="When did it start, and what have you noticed? Any detail helps."
                  className={`${field} mt-1.5 resize-y py-3 leading-relaxed ${bad("message") ? "border-red-300" : "border-line"}`} />
                {bad("message") && <span className="mt-1 block text-[12.5px] text-red-700">{problems.message}</span>}
              </label>

              <div>
                <p className="text-[13px] font-medium">How should we reply?</p>
                <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-[#f3f6f2] p-1">
                  {CONTACTS.map((c) => (
                    <button key={c.id} type="button" aria-pressed={contact === c.id} onClick={() => setContact(c.id)}
                      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition ${contact === c.id ? "bg-white text-forest shadow-sm" : "text-body hover:text-ink"}`}>
                      <c.icon size={15} /> {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-4.5 w-4.5 accent-[#0b3f2a]" />
                <span>
                  <span className="block text-[13.5px] font-medium">Attach my home details and recent readings</span>
                  <span className="block text-[12.5px] text-muted">{homeCode(data.home.siteId)} · {data.home.inverter.serial} · last 14 days. Saves you explaining twice.</span>
                </span>
              </label>

              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[12.5px] text-muted">KlimateX will never ask for your PIN or BVN.</p>
                <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-5 text-[14px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60">
                  {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Send message
                </button>
              </div>
            </div>
          </form>

          <section className="rounded-3xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-[16px] font-semibold">Your requests</h2>
              {requests && requests.length > 0 && <span className="text-[12.5px] text-muted">{requests.length} total</span>}
            </div>
            {requests === null ? (
              <div className="flex justify-center py-10"><LoaderCircle size={20} className="animate-spin text-muted" /></div>
            ) : requests.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13.5px] text-body">No requests yet. When you send one, you can follow it here.</p>
            ) : (
              <ul>
                {requests.map((r) => {
                  const step = stepOf(r.status);
                  const T = TOPICS.find((t) => t.id === r.topic) ?? TOPICS[5];
                  return (
                    <li key={r.id} className="border-b border-line px-6 py-4 last:border-0">
                      <div className="flex items-start gap-3.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3f6f2] text-forest"><T.icon size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-[14px] font-semibold">{r.subject}</p>
                            <span className="font-mono text-[11.5px] text-muted">{r.reference}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[13px] text-body">{r.message}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {STEPS.map((s, i) => (
                              <div key={s} className="flex items-center gap-1.5">
                                <span className={`flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium ${i <= step ? "bg-mint text-forest" : "bg-[#f3f6f2] text-muted"}`}>
                                  {i <= step && <BadgeCheck size={12} />} {s}
                                </span>
                                {i < STEPS.length - 1 && <span className={`h-px w-4 ${i < step ? "bg-leaf" : "bg-line"}`} />}
                              </div>
                            ))}
                            <span className="ml-auto text-[12px] text-muted">{longDate(r.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <div className="relative overflow-hidden rounded-3xl bg-forest p-6 text-white">
            <svg aria-hidden viewBox="0 0 300 200" className="absolute inset-0 h-full w-full opacity-[0.12]">
              {Array.from({ length: 7 }, (_, i) => <circle key={i} cx="290" cy="0" r={30 + i * 28} fill="none" stroke="#c7f36b" />)}
            </svg>
            <p className="relative flex items-center gap-2 text-[13px] text-lime"><Clock size={15} /> Reply time</p>
            <p className="relative mt-1 text-[24px] font-semibold tracking-tight">Within 1 working day</p>
            <p className="relative mt-1 text-[13px] text-white/70">Monday to Saturday, 8 am to 6 pm. Offline systems are seen first.</p>
          </div>

          <div className="rounded-3xl border border-line bg-white p-5">
            <p className="text-[14px] font-semibold">Who handles what</p>
            <ul className="mt-3 space-y-3.5">
              {[
                { icon: Wrench, title: "Your installer", body: "Repairs, panel cleaning, inverter faults. We book the visit for you." },
                { icon: Landmark, title: "Access Bank", body: "Loan schedule and wallet questions. Any branch can help." },
                { icon: MessageSquareText, title: "KlimateX", body: "Payouts, readings, certificates and your account." },
              ].map((w) => (
                <li key={w.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint text-forest"><w.icon size={16} /></span>
                  <span>
                    <span className="block text-[13.5px] font-medium">{w.title}</span>
                    <span className="block text-[12.5px] text-body">{w.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/app/household/help/" className="group flex items-center gap-3 rounded-3xl border border-line bg-white p-5 hover:bg-mint/50">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3f7] text-[#35546b]"><CircleHelp size={19} /></span>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold">Try the Help Center</span>
              <span className="block text-[12.5px] text-body">Quick answers, no waiting.</span>
            </span>
            <ArrowRight size={17} className="text-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="px-2 text-[12px] text-muted">Signed in as {user.name} · {homeCode(data.home.siteId)}</p>
        </aside>
      </div>
    </>
  );
}
