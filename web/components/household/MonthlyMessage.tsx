"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { LANGUAGES } from "@/lib/household";
import { useHousehold } from "./HouseholdShell";
import { PhoneMockup, type Channel } from "./PhoneMockup";
import { PageHeader } from "./ui";

type Message = { text: string; source?: "model" | "template" };

const fetchMonthly = (siteId: number, lang: string) => api<Message>(`/api/homes/${siteId}/message?lang=${lang}`);

/** SMS is billed per 160-character part (70 when the text needs accents outside the basic set). */
function smsParts(text: string) {
  const unicode = /[^\x00-\x7F₦]/.test(text);
  const size = unicode ? 70 : 160;
  return { parts: Math.max(1, Math.ceil(text.length / size)), size };
}

export function MonthlyMessage() {
  const { data, lang, setLang } = useHousehold();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  // Keyed by language, so switching language shows the loader until that language's message arrives.
  const key = `${data.home.siteId}:${lang}`;
  const [result, setResult] = useState<{ key: string; message?: Message; error?: string } | null>(null);
  const loading = result?.key !== key;
  const message = loading ? null : (result?.message ?? null);
  const error = loading ? "" : (result?.error ?? "");

  useEffect(() => {
    let stale = false;
    fetchMonthly(data.home.siteId, lang)
      .then((m) => !stale && setResult({ key: `${data.home.siteId}:${lang}`, message: m }))
      .catch((e) => !stale && setResult({ key: `${data.home.siteId}:${lang}`, error: e instanceof Error ? e.message : "Your message couldn't be loaded." }));
    return () => {
      stale = true;
    };
  }, [data.home.siteId, lang]);

  const sms = message ? smsParts(message.text) : null;

  return (
    <>
      <PageHeader title="Monthly message" description="Each month your family gets a short message about your home: your grade, the petrol you avoided, and what happens next with your payout. Pick your language." />

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5">
            <p className="text-[13px] font-semibold text-body">Language</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Message language">
              {LANGUAGES.map((l) => (
                <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
                  className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition ${lang === l.code ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:bg-mint"}`}>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-5 text-[13px] font-semibold text-body">Sent by</p>
            <div className="mt-2 inline-flex rounded-xl border border-line bg-[#f6f8f5] p-1" role="radiogroup" aria-label="Channel">
              {(["whatsapp", "sms"] as Channel[]).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)}
                  className={`rounded-lg px-4 py-1.5 text-[13.5px] font-medium ${channel === c ? "bg-white text-ink shadow-sm" : "text-body"}`}>
                  {c === "sms" ? "SMS" : "WhatsApp"}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 text-[13.5px] leading-relaxed text-body">
            {error ? (
              <p className="text-red-700">{error}</p>
            ) : message ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-ink">
                  {message.source === "template" ? <MessageSquare size={16} className="text-leaf" /> : <Sparkles size={16} className="text-leaf" />}
                  {message.source === "template" ? "Standard message" : "Written by AI"}
                </p>
                <p className="mt-1">
                  {message.source === "template"
                    ? "A standard message filled in with your home's real figures. The AI writer isn't answering right now; when it is, it writes this message for you."
                    : "The model writes it from your home's audited figures only. It never decides your credits or your payout."}
                </p>
                {sms && channel === "sms" && (
                  <p className="mt-3 text-[12.5px] text-muted">{message.text.length} characters · {sms.parts} SMS {sms.parts === 1 ? "part" : "parts"} of up to {sms.size} characters</p>
                )}
              </>
            ) : (
              <p className="text-muted">Loading your message…</p>
            )}
          </section>
          <p className="text-[12.5px] text-muted">Preview. Messages aren&rsquo;t sent yet: no SMS or WhatsApp provider is connected to the sandbox.</p>
        </div>

        <div className="order-first lg:order-none">
          <PhoneMockup channel={channel} text={error || message?.text || null} loading={loading && !error} lang={lang} />
        </div>
      </div>
    </>
  );
}
