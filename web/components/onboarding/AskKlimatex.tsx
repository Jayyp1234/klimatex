"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Expand, Lock, RotateCcw, Sparkles } from "lucide-react";
import { RichText } from "@/components/household/RichText";
import { selectClass } from "@/components/household/ui";
import { ApiError } from "@/lib/api";
import { askAssistant, SIGNUP_SUGGESTIONS, SOURCE_LABELS, type AssistantReply, type Turn } from "@/lib/assistant";
import { LANGUAGES } from "@/lib/household";

type Message = Turn & { reply?: AssistantReply; error?: boolean };

/** The same key the household app uses, so the language follows the family from sign-up into the full dashboard. */
const LANG_KEY = "klimatex.lang";
const MAX = 500;

function readLang() {
  try {
    return localStorage.getItem(LANG_KEY) ?? "en";
  } catch {
    return "en";
  }
}

/**
 * "Ask KlimateX" for a family that is still signing up. The AI reads their progress, every package and price,
 * the loan pre-check and how KlimateX works. It can only read: it never changes anything.
 */
export function AskKlimatex({ name, full = false }: { name: string; full?: boolean }) {
  const [lang, setLangState] = useState(readLang);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Scroll the conversation, not the page.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, busy]);

  const setLang = (next: string) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  };

  async function send(text: string) {
    const question = text.trim().slice(0, MAX);
    if (!question || busy) return;
    const history: Turn[] = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setDraft("");
    setBusy(true);
    try {
      const reply = await askAssistant(question, lang, history);
      setMessages((m) => [...m, { role: "assistant", content: reply.answer, reply }]);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
      setMessages((m) => [...m, { role: "assistant", content: message, error: true }]);
    } finally {
      setBusy(false);
      input.current?.focus({ preventScroll: true });
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const suggestions = SIGNUP_SUGGESTIONS[lang] ?? SIGNUP_SUGGESTIONS.en;
  const firstName = name.split(" ")[0];

  return (
    <section aria-labelledby="ask-heading" className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-lime"><Sparkles size={18} aria-hidden /></span>
          <div className="min-w-0">
            <h2 id="ask-heading" className="text-[16px] font-semibold tracking-tight">Ask KlimateX</h2>
            <p className="text-[13px] text-body">Prices, the loan, install day, your progress. Answers come from your sign-up and our price list.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="ask-lang">Language</label>
          <select id="ask-lang" value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          {messages.length > 0 && (
            <button type="button" onClick={() => setMessages([])} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[13px] font-medium hover:bg-mint disabled:opacity-50">
              <RotateCcw size={14} aria-hidden /> New chat
            </button>
          )}
          {!full && (
            <Link href="/app/household/assistant/" aria-label="Open Ask KlimateX full screen" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink hover:bg-mint">
              <Expand size={15} aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div ref={log} aria-live="polite" className={`space-y-3 overflow-y-auto bg-[#fbfcfa] p-4 sm:p-5 ${full ? "min-h-[50vh] max-h-[62vh]" : "max-h-[420px] min-h-[220px]"}`}>
        {messages.length === 0 && (
          <div className="py-3 text-center">
            <p className="text-[16px] font-semibold">Hello {firstName}, what would you like to know?</p>
            <p className="mt-1 text-[13px] text-body">Tap a question or type your own.</p>
            <div className="mx-auto mt-4 flex max-w-[600px] flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-white px-3.5 py-2 text-[13.5px] font-medium text-ink transition hover:border-leaf hover:bg-mint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`kx-msg-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              role={m.error ? "alert" : undefined}
              className={`max-w-[88%] break-words rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${
                m.role === "user" ? "rounded-br-md bg-forest text-white" : m.error ? "rounded-bl-md border border-red-200 bg-red-50 text-red-800" : "rounded-bl-md bg-mint text-ink"
              }`}
            >
              <p className="whitespace-pre-line">{m.role === "assistant" && !m.error ? <RichText text={m.content} /> : m.content}</p>
              {m.reply && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-forest/10 pt-2 text-[11.5px] text-body">
                  <span className="font-medium">{m.reply.mode === "model" ? "AI answer" : "Quick answer"} from</span>
                  {m.reply.sources.length === 0 && <span className="rounded-md bg-white px-1.5 py-0.5">KlimateX help</span>}
                  {m.reply.sources.map((s) => <span key={s} className="rounded-md bg-white px-1.5 py-0.5">{SOURCE_LABELS[s] ?? s}</span>)}
                </p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-mint px-4 py-3.5" role="status" aria-label="KlimateX is answering">
              {[0, 1, 2].map((d) => <span key={d} className="kx-dot h-2 w-2 rounded-full bg-leaf/70" style={{ animationDelay: `${d * 150}ms` }} />)}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-line p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <label htmlFor="ask-input" className="sr-only">Your question</label>
          <textarea
            id="ask-input"
            ref={input}
            rows={1}
            maxLength={MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask a question"
            aria-describedby="ask-help"
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14.5px] outline-none transition focus:border-leaf focus:ring-4 focus:ring-leaf/12"
          />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest text-white transition hover:bg-forest-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-leaf/30 disabled:opacity-40">
            <ArrowUp size={19} aria-hidden />
          </button>
        </div>
        <p id="ask-help" className="mt-2 px-1 text-[12px] leading-snug text-muted">
          <Lock size={12} className="-mt-0.5 mr-1 inline" aria-hidden />
          It can only read: it can&rsquo;t change your choices or move money. Never share your PIN here.
          {draft.length > MAX - 80 && <span className="float-right tabular-nums">{draft.length}/{MAX}</span>}
        </p>
      </form>
    </section>
  );
}
