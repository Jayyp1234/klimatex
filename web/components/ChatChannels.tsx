"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Check, CheckCheck, ChevronLeft, FileText, Mic, Paperclip, Phone, Play, Plus, Smile, Video } from "lucide-react";

/**
 * "Ask in the chat apps families already use": a Telegram chat with @KlimateXBot (live) and a WhatsApp chat (coming soon).
 * The bubbles copy what the bot really sends: the same menu, the same home card and the same Pidgin wording
 * as backend-php/src/Services/Telegram/BotText.php and BotCards.php. The household is the synthetic demo data.
 */

export const TELEGRAM_BOT = "KlimateXBot";
const TELEGRAM_URL = `https://t.me/${TELEGRAM_BOT}`;

type Msg = { id: string; side: "in" | "out"; time: string; body: ReactNode; bare?: boolean };

/* ── Telegram ─────────────────────────────────────────────── */

const tgMessages: Msg[] = [
  { id: "t3", side: "out", time: "19:02", body: <VoiceNote seconds={6} tone="tg" />, bare: true },
  { id: "t4", side: "in", time: "19:02", body: <>🎙 Wetin I hear: “When my next money go land?”</> },
  {
    id: "t5",
    side: "in",
    time: "19:02",
    body: <>Your next money fit be like <b>₦4,200</b>, after the audit wey go close 30 Nov. E go enter your Access Bank solar loan straight. Na estimate, no be promise 🙏🏾</>,
  },
  { id: "t1", side: "out", time: "19:03", body: "🏠 My house" },
  {
    id: "t2",
    side: "in",
    time: "19:03",
    body: (
      <>
        🏠 <b>Home 15</b> · Ikorodu, Lagos
        <br />
        <br />⚡ Energy grade: <b>D</b> before solar → <b>A</b> now
        <br />🌍 CO₂ wey you cut this period: <b>0.150 t</b>
        <br />⛽ Fuel wey you no burn: <b>62 L</b>
        <br />💸 Money wey don reach you: <b>₦3,661</b>
        <br />🛡 Trust score: <b>96/100</b>
        <br />
        <br />☀️ Solar wey you make, month by month:
        <br />
        <code className="font-mono text-[12px] tracking-[0.18em] text-[#3a6e1f]">▃▅▆█▇▅</code>
        {"  "}
        <b>128.7 kWh</b>
        <br />
        <code className="font-mono text-[11px] tracking-[0.18em] text-[#8a8f8c]">JJASON</code>
      </>
    ),
  },
];

const tgKeyboard = ["🏠 My house", "💸 My money", "🌱 Make more money", "🔍 Audit", "📜 Certificate", "🌍 Language"];

function PdfFile() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#40a7e3] text-white">
        <FileText size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-[#111]">KlimateX-Certificate-Home-15.pdf</span>
        <span className="block text-[11.5px] text-[#8a8f8c]">184 KB · PDF</span>
      </span>
    </div>
  );
}

function VoiceNote({ seconds, tone }: { seconds: number; tone: "tg" | "wa" }) {
  const bars = [4, 9, 14, 7, 12, 18, 10, 6, 15, 11, 5, 13, 17, 8, 4, 10, 14, 6, 9, 5];
  const colour = tone === "tg" ? "bg-[#4fae4e]" : "bg-[#8a9b93]";
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${tone === "tg" ? "bg-[#4fae4e]" : "bg-[#53bdeb]"}`}>
        <Play size={15} fill="currentColor" className="ml-0.5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex h-[18px] items-center gap-[2px]" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className={`w-[2.5px] rounded-full ${colour}`} style={{ height: h }} />
          ))}
        </span>
        <span className={`text-[11px] ${tone === "tg" ? "text-[#4fae4e]" : "text-[#667781]"}`}>0:0{seconds}</span>
      </span>
    </div>
  );
}

function TelegramChat({ shown, typing }: { shown: number; typing: boolean }) {
  return (
    <div className="flex h-full flex-col bg-[#c9dcb0] text-[13.5px] leading-[1.38] text-[#111]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-black/5 bg-[#f7f7f7]/95 px-2.5 pb-2 pt-1.5">
        <span className="flex items-center text-[14px] text-[#3390ec]">
          <ChevronLeft size={22} />
          <span className="-ml-0.5">Chats</span>
        </span>
        <div className="flex-1 text-center">
          <p className="text-[14.5px] font-semibold leading-tight">KlimateX</p>
          <p className="text-[11.5px] leading-tight text-[#8a8f8c]">{typing ? <span className="text-[#3390ec]">typing…</span> : "bot"}</p>
        </div>
        <Image src="/images/bot-avatar.svg" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full" />
      </div>

      {/* Messages */}
      <div className="kx-tg-wallpaper relative flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2.5 py-2">
        <p className="mx-auto mb-1 rounded-full bg-black/20 px-2.5 py-0.5 text-[11.5px] font-medium text-white">Today</p>
        {tgMessages.slice(0, shown).map((m) => (
          <div key={m.id} className={`kx-msg-in flex ${m.side === "out" ? "justify-end" : "justify-start"}`}>
            <div
              className={`relative max-w-[86%] px-2.5 pb-1.5 pt-1.5 shadow-[0_1px_1px_rgb(0_0_0/0.12)] ${
                m.side === "out" ? "rounded-[16px] rounded-br-[5px] bg-[#effedd]" : "rounded-[16px] rounded-bl-[5px] bg-white"
              }`}
            >
              <div className={m.bare ? "pr-12" : ""}>{m.body}</div>
              <span className={`float-right -mb-0.5 ml-2 mt-1 inline-flex items-center gap-0.5 text-[10.5px] ${m.side === "out" ? "text-[#4fae4e]" : "text-[#a0a5a2]"}`}>
                {m.time}
                {m.side === "out" && <CheckCheck size={14} />}
              </span>
            </div>
          </div>
        ))}
        {typing && <Typing bubble="bg-white" />}
      </div>

      {/* Input + the bot's reply keyboard */}
      <div className="bg-[#f7f7f7] px-2 pb-2 pt-1.5">
        <div className="flex items-center gap-2 pb-1.5">
          <Paperclip size={20} className="text-[#8a8f8c]" />
          <span className="flex-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[13px] text-[#a0a5a2]">Message</span>
          <Mic size={20} className="text-[#8a8f8c]" />
        </div>
        <div className="grid grid-cols-2 gap-1">
          {tgKeyboard.map((k) => (
            <span key={k} className="truncate rounded-md bg-white px-1 py-1.5 text-center text-[11.5px] font-medium shadow-[0_1px_0_rgb(0_0_0/0.12)]">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── WhatsApp ─────────────────────────────────────────────── */

const waMessages: Msg[] = [
  {
    id: "w1",
    side: "in",
    time: "08:15",
    body: (
      <>
        💸 Better news, Mama Ngozi! <b>₦3,661</b> from your carbon credits don pay part of your solar loan.
        <br />
        <br />
        Somebody buy credits wey your solar make. Press <i>My money</i> to see am.
      </>
    ),
  },
  { id: "w2", side: "out", time: "08:17", body: "Thank you o! How I go take make more money next month?" },
  {
    id: "w3",
    side: "in",
    time: "08:17",
    body: (
      <>
        🌱 2 things wey you fit do:
        <br />
        1. Snap your generator fuel receipt each month. E dey prove say solar dey replace petrol.
        <br />
        2. Keep the inverter on WiFi so every day go count.
      </>
    ),
  },
  { id: "w4", side: "out", time: "08:18", body: <VoiceNote seconds={4} tone="wa" />, bare: true },
  { id: "w5", side: "in", time: "08:18", body: <>🎙 Wetin I hear: “Send me my certificate”</> },
  { id: "w6", side: "in", time: "08:18", body: <PdfFile />, bare: true },
];

function WhatsAppChat({ shown, typing }: { shown: number; typing: boolean }) {
  return (
    <div className="flex h-full flex-col bg-[#efeae2] text-[13.5px] leading-[1.38] text-[#111b21]">
      {/* Header */}
      <div className="flex items-center gap-2 bg-[#008069] px-2 pb-2 pt-1.5 text-white">
        <ChevronLeft size={22} />
        <Image src="/images/bot-avatar.svg" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full bg-white" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[14.5px] font-semibold leading-tight">
            KlimateX
            <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#25d366] text-[#008069]" aria-label="Verified business">
              <Check size={10} strokeWidth={3.5} className="text-white" />
            </span>
          </p>
          <p className="truncate text-[11.5px] leading-tight text-white/80">{typing ? "typing…" : "Business account"}</p>
        </div>
        <Video size={20} />
        <Phone size={18} className="ml-2" />
      </div>

      {/* Messages */}
      <div className="kx-wa-wallpaper relative flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2.5 py-2">
        <p className="mx-auto mb-1 rounded-md bg-white px-2.5 py-0.5 text-[11.5px] text-[#54656f] shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]">TODAY</p>
        <p className="mx-auto mb-1 max-w-[92%] rounded-md bg-[#fff5c4] px-2.5 py-1 text-center text-[11px] leading-snug text-[#54656f]">
          🔒 Messages are end-to-end encrypted. KlimateX can only read your home records; it can&apos;t move money.
        </p>
        {waMessages.slice(0, shown).map((m) => (
          <div key={m.id} className={`kx-msg-in flex ${m.side === "out" ? "justify-end" : "justify-start"}`}>
            <div
              className={`relative max-w-[86%] px-2 pb-1 pt-1.5 shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] ${
                m.side === "out" ? "rounded-[8px] rounded-tr-none bg-[#d9fdd3]" : "rounded-[8px] rounded-tl-none bg-white"
              }`}
            >
              <div className={m.bare ? "pr-12" : ""}>{m.body}</div>
              <span className="float-right -mb-0.5 ml-2 mt-1 inline-flex items-center gap-0.5 text-[10.5px] text-[#667781]">
                {m.time}
                {m.side === "out" && <CheckCheck size={15} className="text-[#53bdeb]" />}
              </span>
            </div>
          </div>
        ))}
        {typing && <Typing bubble="bg-white" />}
      </div>

      {/* Input */}
      <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-1.5">
        <span className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-2 text-[13px] text-[#8696a0] shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]">
          <Smile size={19} />
          <span className="flex-1">Message</span>
          <Paperclip size={18} />
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white">
          <Mic size={19} />
        </span>
      </div>
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────── */

function Typing({ bubble }: { bubble: string }) {
  return (
    <div className="kx-msg-in flex justify-start" aria-hidden>
      <span className={`flex gap-1 rounded-2xl px-3 py-2.5 shadow-[0_1px_1px_rgb(0_0_0/0.12)] ${bubble}`}>
        <span className="kx-dot h-1.5 w-1.5 rounded-full bg-[#9aa09d]" />
        <span className="kx-dot h-1.5 w-1.5 rounded-full bg-[#9aa09d] [animation-delay:150ms]" />
        <span className="kx-dot h-1.5 w-1.5 rounded-full bg-[#9aa09d] [animation-delay:300ms]" />
      </span>
    </div>
  );
}

function Handset({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto aspect-[9/18.5] w-full max-w-[318px] rounded-[2.7rem] bg-[#0d1512] p-[8px] shadow-[0_30px_70px_-24px_rgb(11_63_42/0.5)] ring-1 ring-black/10">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.2rem] bg-white">
        {/* Status bar */}
        <div className="relative flex h-8 shrink-0 items-center justify-between px-6 pt-1 text-[12px] font-semibold text-[#111]">
          <span>9:41</span>
          <span aria-hidden className="absolute left-1/2 top-1.5 h-[22px] w-[82px] -translate-x-1/2 rounded-full bg-[#0d1512]" />
          <span className="flex items-center gap-1" aria-hidden>
            <span className="flex items-end gap-[1.5px]">
              {[4, 6, 8, 10].map((h) => (
                <span key={h} className="w-[3px] rounded-[1px] bg-[#111]" style={{ height: h }} />
              ))}
            </span>
            <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-[#111]/70 p-[1.5px]">
              <span className="block h-full w-[70%] rounded-[1px] bg-[#111]" />
            </span>
          </span>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Plays a chat once when it scrolls into view: a typing indicator before each reply, like the real thing. */
function useChatPlayback(total: number, isReply: (index: number) => boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(total);
  const [typing, setTyping] = useState(false);
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    if (!node) return;
    // Start from the first message only while the chat is still off screen, so nothing disappears in view.
    const box = node.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStart(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    const hide = window.setTimeout(() => setShown(1), 0);
    return () => {
      observer.disconnect();
      window.clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (!start || shown >= total) return;
    const reply = isReply(shown);
    const timers: number[] = [];
    if (reply) {
      timers.push(window.setTimeout(() => setTyping(true), 500));
      timers.push(window.setTimeout(() => { setTyping(false); setShown((n) => n + 1); }, 1700));
    } else {
      timers.push(window.setTimeout(() => setShown((n) => n + 1), 1300));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [start, shown, total, isReply]);

  return { ref, shown, typing };
}

const tgIsReply = (i: number) => tgMessages[i]?.side === "in";
const waIsReply = (i: number) => waMessages[i]?.side === "in";

function TelegramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M9.04 15.28 8.7 19.6c.48 0 .69-.21.94-.46l2.26-2.16 4.68 3.43c.86.47 1.47.22 1.7-.79l3.08-14.43c.28-1.27-.46-1.77-1.3-1.46L1.95 10.7c-1.24.48-1.22 1.17-.21 1.48l4.62 1.44L17.1 6.9c.5-.33.96-.15.58.18" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.25 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export function ChatChannels() {
  const { ref: tgRef, shown: tgShown, typing: tgTyping } = useChatPlayback(tgMessages.length, tgIsReply);
  const { ref: waRef, shown: waShown, typing: waTyping } = useChatPlayback(waMessages.length, waIsReply);

  return (
    <section id="chat" aria-labelledby="chat-title" className="scroll-mt-20 overflow-hidden border-t border-line bg-[#f6f9f5] py-12 lg:py-16">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
        <div className="max-w-[640px]">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-leaf">No app needed</p>
          <h2 id="chat-title" className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
            Ask about your home in <span className="text-forest">the chat apps you already use</span>
          </h2>
          <p className="mt-3 text-[16px] leading-[1.55] text-body">
            Type or send a voice note in English, Pidgin, Yorùbá, Igbo or Hausa. KlimateX answers from your home&apos;s own records, sends your Home Energy Certificate as a PDF, and tells you the moment a payout lands. It can only read; it can&apos;t move money.
          </p>
        </div>

        <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-8 lg:gap-14">
          {/* Telegram */}
          <div className="flex flex-col items-center">
            <div ref={tgRef} className="w-full">
              <Handset label="A Telegram chat with the KlimateX bot: a voice note answered in Pidgin, then the home card">
                <TelegramChat shown={tgShown} typing={tgTyping} />
              </Handset>
            </div>
            <div className="mt-6 w-full max-w-[360px] text-center">
              <p className="flex items-center justify-center gap-2 text-[17px] font-semibold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#229ed9] text-white"><TelegramIcon size={15} /></span>
                Telegram
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e2f4d6] px-2 py-0.5 text-[11px] font-semibold text-leaf">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3dbb3d]" /> Live
                </span>
              </p>
              <p className="mt-1.5 text-[14px] leading-snug text-body">
                Open @{TELEGRAM_BOT}, tap Start, and sign in with your phone number and PIN. Or connect it from your dashboard in one tap.
              </p>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#229ed9] px-5 py-3 text-[14.5px] font-medium text-white shadow-sm transition-colors hover:bg-[#1b8bc0]"
              >
                <TelegramIcon size={17} /> Chat with @{TELEGRAM_BOT} <ArrowRight size={16} />
              </a>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col items-center">
            <div ref={waRef} className="w-full">
              <Handset label="A preview of KlimateX on WhatsApp: a payout alert, tips to earn more in Pidgin, and the certificate PDF">
                <WhatsAppChat shown={waShown} typing={waTyping} />
              </Handset>
            </div>
            <div className="mt-6 w-full max-w-[360px] text-center">
              <p className="flex items-center justify-center gap-2 text-[17px] font-semibold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25d366] text-white"><WhatsAppIcon size={16} /></span>
                WhatsApp
                <span className="rounded-full bg-[#fff1cc] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a00]">Coming soon</span>
              </p>
              <p className="mt-1.5 text-[14px] leading-snug text-body">
                The same assistant, alerts and certificate on WhatsApp, the app most Lagos families already have open. Planned for the pilot.
              </p>
              <span className="mt-4 inline-flex cursor-default items-center gap-2 rounded-lg border border-line bg-white px-5 py-3 text-[14.5px] font-medium text-muted">
                <Plus size={16} /> Arriving with the Lagos pilot
              </span>
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-[12.5px] text-muted">Chats show a demonstration household. Figures are synthetic.</p>
      </div>
    </section>
  );
}
