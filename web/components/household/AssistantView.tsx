"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUp, Headphones, Lock, Mic, MicOff, Sparkles, Volume2, VolumeX } from "lucide-react";
import { ApiError } from "@/lib/api";
import { askAssistant, SOURCE_LABELS, SPEECH_LANG, SUGGESTIONS, type AssistantReply, type Turn } from "@/lib/assistant";
import { LANGUAGES } from "@/lib/household";
import { useHousehold } from "./HouseholdShell";
import { selectClass } from "./ui";
import { plainText, RichText } from "./RichText";

type Message = Turn & { reply?: AssistantReply; error?: boolean };

/* The Web Speech API isn't in every TypeScript DOM library yet; this is the part we use. */
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SPEAK_KEY = "klimatex.assistant.speak";

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const tag = SPEECH_LANG[lang] ?? "en-NG";
  const voices = window.speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = tag;
  utterance.voice = voices.find((v) => v.lang === tag) ?? voices.find((v) => v.lang.startsWith(tag.slice(0, 2))) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function AssistantView() {
  const { user, lang, setLang } = useHousehold();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // The shell renders this page only in the browser, after sign-in, so these can read browser APIs directly.
  const [canListen] = useState(() => recognitionClass() !== null);
  const [speakAloud, setSpeakAloud] = useState(() => {
    try {
      return localStorage.getItem(SPEAK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [voiceNote, setVoiceNote] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      recognition.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Turn[] = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setDraft("");
    setBusy(true);
    try {
      const reply = await askAssistant(question, lang, history);
      setMessages((m) => [...m, { role: "assistant", content: reply.answer, reply }]);
      if (speakAloud) speak(plainText(reply.answer), reply.lang);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
      setMessages((m) => [...m, { role: "assistant", content: message, error: true }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const toggleListening = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = recognitionClass();
    if (!Speech) return;
    const r = new Speech();
    r.lang = SPEECH_LANG[lang] ?? "en-NG";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      if (heard) send(heard);
    };
    r.onerror = (event) => {
      setVoiceNote(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Allow the microphone for this site to ask by voice."
          : event.error === "language-not-supported"
            ? "This browser can't listen in that language yet. Try English or type your question."
            : event.error === "no-speech"
              ? "We didn't hear anything. Tap the microphone and speak."
              : "Voice isn't working right now. You can type instead.",
      );
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    setVoiceNote("");
    setListening(true);
    r.start();
  };

  const toggleSpeak = () => {
    const next = !speakAloud;
    setSpeakAloud(next);
    if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel();
    try {
      localStorage.setItem(SPEAK_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  };

  const suggestions = SUGGESTIONS[lang] ?? SUGGESTIONS.en;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-[26px] font-semibold tracking-[-0.02em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-lime"><Sparkles size={18} /></span>
            Ask KlimateX
          </h1>
          <p className="mt-1 max-w-[560px] text-[15px] text-body">Ask about your solar, payouts, audit or loan, by typing or by voice. Answers come only from your home&rsquo;s records.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="assistant-lang">Language</label>
          <select id="assistant-lang" value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button type="button" onClick={toggleSpeak} aria-pressed={speakAloud}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium ${speakAloud ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:bg-mint"}`}>
            {speakAloud ? <Volume2 size={15} /> : <VolumeX size={15} />} {speakAloud ? "Reading aloud" : "Read aloud"}
          </button>
        </div>
      </div>

      <section className="flex min-h-[460px] flex-col overflow-hidden rounded-3xl border border-line bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[18px] font-semibold">Hello {firstName}, what would you like to know?</p>
              <p className="mt-1 text-[13.5px] text-body">Try one of these, or tap the microphone and ask.</p>
              <div className="mx-auto mt-5 flex max-w-[620px] flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-white px-3.5 py-2 text-[13.5px] font-medium text-ink hover:border-leaf hover:bg-mint">{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed ${
                m.role === "user" ? "rounded-br-md bg-forest text-white" : m.error ? "rounded-bl-md bg-red-50 text-red-800" : "rounded-bl-md bg-mint text-ink"
              }`}>
                <p className="whitespace-pre-line">{m.role === "assistant" ? <RichText text={m.content} /> : m.content}</p>
                {m.reply && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-forest/10 pt-2 text-[11.5px] text-body">
                    <span className="font-medium">{m.reply.mode === "model" ? "AI answer" : "Quick answer"} from</span>
                    {m.reply.sources.length === 0 && <span className="rounded-md bg-white px-1.5 py-0.5">KlimateX help</span>}
                    {m.reply.sources.map((s) => <span key={s} className="rounded-md bg-white px-1.5 py-0.5">{SOURCE_LABELS[s] ?? s}</span>)}
                    <button type="button" onClick={() => speak(plainText(m.content), m.reply!.lang)} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-leaf hover:bg-white" aria-label="Read this answer aloud">
                      <Volume2 size={13} /> Listen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-mint px-4 py-3.5" aria-label="KlimateX is answering">
                {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-leaf/60" style={{ animationDelay: `${d * 140}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-line bg-[#fafcf9] p-3 sm:p-4">
          {voiceNote && <p className="mb-2 px-1 text-[12.5px] text-[#8a5a00]">{voiceNote}</p>}
          <div className="flex items-end gap-2">
            {canListen && (
              <button type="button" onClick={toggleListening} disabled={busy} aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Ask by voice"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${listening ? "animate-pulse border-red-300 bg-red-50 text-red-700" : "border-line bg-white text-forest hover:bg-mint"} disabled:opacity-50`}>
                {listening ? <MicOff size={19} /> : <Mic size={19} />}
              </button>
            )}
            <label htmlFor="assistant-input" className="sr-only">Your question</label>
            <textarea
              id="assistant-input"
              ref={input}
              rows={1}
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={listening ? "Listening…" : "Ask a question"}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14.5px] outline-none focus:border-leaf"
            />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest text-white hover:bg-forest-hover disabled:opacity-40">
              <ArrowUp size={19} />
            </button>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 px-1 text-[12px] text-muted">
            <Lock size={12} aria-hidden /> It can only read your records: it can&rsquo;t move money or change your details. Never share your PIN here.
            <Link href="/app/household/support/" className="inline-flex items-center gap-1 font-medium text-leaf hover:underline"><Headphones size={12} /> Talk to a person</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
