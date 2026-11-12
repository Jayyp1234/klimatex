"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Camera, ChevronLeft, FileText, Mic, MoreVertical, Paperclip, Phone, Plus, Smile, Video } from "lucide-react";

/**
 * "Ask in the chat apps families already use": a Telegram chat with @KlimateXBot (live) on an iPhone,
 * and a WhatsApp chat (coming soon) on an Android phone.
 * The bubbles copy what the bot really sends: the same menu, the same home card and the same Pidgin wording
 * as backend-php/src/Services/Telegram/BotText.php and BotCards.php. The household is the synthetic demo data.
 */

export const TELEGRAM_BOT = "KlimateXBot";
const TELEGRAM_URL = `https://t.me/${TELEGRAM_BOT}`;

const IOS_FONT: CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif' };
const ANDROID_FONT: CSSProperties = { fontFamily: 'Roboto, "Google Sans", "Segoe UI", system-ui, sans-serif' };

type Msg = { id: string; side: "in" | "out"; time: string; body: ReactNode; media?: boolean };

/* ── Telegram (iPhone) ─────────────────────────────────────── */

const tgMessages: Msg[] = [
  { id: "t1", side: "out", time: "19:02", body: <VoiceNote seconds={6} app="tg" />, media: true },
  { id: "t2", side: "in", time: "19:02", body: <>🎙 Wetin I hear: “When my next money go land?”</> },
  {
    id: "t3",
    side: "in",
    time: "19:02",
    body: <>Your next money fit be like <b>₦4,200</b>, after the audit wey go close 30 Nov. E go enter your Access Bank solar loan straight. Na estimate, no be promise 🙏🏾</>,
  },
  { id: "t4", side: "out", time: "19:03", body: "🏠 My house" },
  {
    id: "t5",
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
        <code className="font-mono text-[12.5px] tracking-[0.12em] text-[#2f7d32]">▃▅▆█▇▅</code>{" "}
        <b>128.7 kWh</b>
        <br />
        <code className="font-mono text-[11px] tracking-[0.42em] text-[#8e8e93]">JJASON</code>
      </>
    ),
  },
];

const tgKeyboard = ["🏠 My house", "💸 My money", "🌱 Make more money", "🔍 Audit", "📜 Certificate", "🌍 Language"];

/** iOS Telegram's bubble tail, drawn at the bottom corner of the last bubble in a run. */
function TgTail({ side, fill }: { side: "in" | "out"; fill: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 18"
      className={`absolute bottom-0 h-[18px] w-[12px] ${side === "in" ? "-left-[5px]" : "-right-[5px] -scale-x-100"}`}
    >
      <path d="M12 0v18H1.2C.4 18 0 17 .7 16.4 4.6 13 6 9 6.4 0Z" fill={fill} />
    </svg>
  );
}

function TgTicks() {
  return (
    <svg aria-hidden viewBox="0 0 19 11" className="h-[10px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m1 6 3.4 3.4L11.6 1.6M8.6 8.9l.5.5 7.3-7.8" />
    </svg>
  );
}

function TelegramChat({ shown, typing }: { shown: number; typing: boolean }) {
  const list = tgMessages.slice(0, shown);
  return (
    <div className="flex h-full flex-col text-[14px] leading-[1.36] text-black" style={IOS_FONT}>
      {/* Header */}
      <div className="relative z-10 flex items-center gap-1.5 border-b border-black/[0.08] bg-[#f6f6f6]/[0.94] px-2 pb-1.5 pt-1 backdrop-blur">
        <span className="flex w-[74px] items-center text-[#007aff]">
          <ChevronLeft size={26} strokeWidth={2.4} className="-ml-1" />
          <span className="-ml-1 rounded-full bg-[#007aff] px-[6px] text-[12.5px] font-semibold leading-[18px] text-white">12</span>
        </span>
        <div className="flex-1 text-center">
          <p className="text-[15.5px] font-semibold leading-tight tracking-[-0.01em]">KlimateX</p>
          <p className="text-[12.5px] leading-tight text-[#8e8e93]">{typing ? <span className="text-[#007aff]">typing…</span> : "bot"}</p>
        </div>
        <span className="flex w-[74px] justify-end">
          <Image src="/images/bot-avatar.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
        </span>
      </div>

      {/* Messages */}
      <div className="kx-tg-wallpaper relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-2 pb-1.5 pt-2">
        <p className="mx-auto mb-2 rounded-full bg-[#5d7a4a]/40 px-2.5 py-[2px] text-[12.5px] font-semibold text-white">Today</p>
        {list.map((m, i) => {
          const last = list[i + 1]?.side !== m.side;
          const out = m.side === "out";
          const fill = out ? "#e1fec6" : "#ffffff";
          return (
            <div key={m.id} className={`kx-msg-in flex ${out ? "justify-end pr-[5px]" : "justify-start pl-[5px]"} ${last ? "mb-2" : "mb-[3px]"}`}>
              <div
                className={`relative max-w-[84%] rounded-[17px] px-[9px] pb-[5px] pt-[5px] ${last ? (out ? "rounded-br-[5px]" : "rounded-bl-[5px]") : ""}`}
                style={{ background: fill }}
              >
                {m.body}
                <span className={`float-right ml-2.5 mt-[5px] inline-flex translate-y-[3px] items-center gap-[3px] text-[11px] ${out ? "text-[#3db84a]" : "text-[#a3a8ad]"}`}>
                  {m.time}
                  {out && <TgTicks />}
                </span>
                {last && <TgTail side={m.side} fill={fill} />}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="kx-msg-in mb-2 flex justify-start pl-[5px]" aria-hidden>
            <span className="relative flex gap-1 rounded-[17px] rounded-bl-[5px] bg-white px-3.5 py-3">
              <Dots />
              <TgTail side="in" fill="#ffffff" />
            </span>
          </div>
        )}
      </div>

      {/* Input bar + the bot's reply keyboard */}
      <div className="border-t border-black/[0.08] bg-[#f6f6f6] px-2 pt-1.5">
        <div className="flex items-center gap-2 pb-1.5">
          <Paperclip size={22} strokeWidth={1.7} className="-rotate-45 text-[#8e8e93]" />
          <span className="flex flex-1 items-center rounded-full border border-black/[0.12] bg-white py-[5px] pl-3 pr-1.5 text-[15px] text-[#c4c4c6]">
            <span className="flex-1">Message</span>
            <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px] text-[#8e8e93]" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
              <path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M7.5 14h9" strokeLinecap="round" />
            </svg>
          </span>
          <Mic size={22} strokeWidth={1.7} className="text-[#8e8e93]" />
        </div>
        <div className="-mx-2 grid grid-cols-2 gap-[5px] bg-[#d1d3d9] px-[5px] pb-1.5 pt-[5px]">
          {tgKeyboard.map((k) => (
            <span key={k} className="truncate rounded-[7px] bg-white px-1 py-[7px] text-center text-[12.5px] shadow-[0_1px_0_rgb(0_0_0/0.3)]">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── WhatsApp (Android) ────────────────────────────────────── */

const waMessages: Msg[] = [
  {
    id: "w1",
    side: "in",
    time: "8:15 am",
    body: (
      <>
        💸 Better news, Mama Ngozi! <b>₦3,661</b> from your carbon credits don pay part of your solar loan.
        <br />
        <br />
        Somebody buy credits wey your solar make. Press <i>My money</i> to see am.
      </>
    ),
  },
  { id: "w2", side: "out", time: "8:17 am", body: "Thank you o! How I go take make more money next month?" },
  {
    id: "w3",
    side: "in",
    time: "8:17 am",
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
  { id: "w4", side: "out", time: "8:18 am", body: <VoiceNote seconds={4} app="wa" />, media: true },
  { id: "w5", side: "in", time: "8:18 am", body: <>🎙 Wetin I hear: “Send me my certificate”</> },
  { id: "w6", side: "in", time: "8:18 am", body: <PdfFile app="wa" />, media: true },
];

/** WhatsApp's bubble tail, at the top corner of the first bubble in a run. */
function WaTail({ side, fill }: { side: "in" | "out"; fill: string }) {
  return (
    <svg aria-hidden viewBox="0 0 8 13" className={`absolute top-0 h-[13px] w-[8px] ${side === "in" ? "-left-[8px]" : "-right-[8px] -scale-x-100"}`}>
      <path d="M8 0v13L.8 3.3C-.3 1.8.3 0 2.2 0Z" fill={fill} />
    </svg>
  );
}

function WaTicks() {
  return (
    <svg aria-hidden viewBox="0 0 16 11" className="h-[11px] w-[16px] text-[#53bdeb]" fill="currentColor">
      <path d="M11.07.65a.46.46 0 0 0-.32-.15.45.45 0 0 0-.34.13L4.63 7.71 2.32 5.52a.46.46 0 0 0-.64.02l-.33.33a.45.45 0 0 0 .01.64l2.98 2.84c.18.17.46.17.64 0L11.4 1.6a.45.45 0 0 0 .03-.63ZM15.07.65a.46.46 0 0 0-.32-.15.45.45 0 0 0-.34.13L8.63 7.71l-.57-.54-.66.81 1.05 1c.18.17.46.17.64 0L15.4 1.6a.45.45 0 0 0 .03-.63Z" />
    </svg>
  );
}

function WhatsAppChat({ shown, typing }: { shown: number; typing: boolean }) {
  const list = waMessages.slice(0, shown);
  return (
    <div className="flex h-full flex-col text-[14px] leading-[1.38] text-[#111b21]" style={ANDROID_FONT}>
      {/* App bar */}
      <div className="flex items-center gap-1.5 bg-[#008069] px-1.5 pb-2 pt-1 text-white">
        <ArrowLeft size={21} />
        <Image src="/images/bot-avatar.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
        <div className="ml-0.5 min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[15.5px] font-medium leading-tight">
            KlimateX
            <svg aria-label="Verified business" viewBox="0 0 18 18" className="h-[15px] w-[15px]">
              <path fill="#25d366" d="M9 0l2.1 1.6 2.6-.2.9 2.5 2.4 1.1-.4 2.6L18 9.7l-1.4 2.2.4 2.6-2.4 1.1-.9 2.5-2.6-.2L9 19.5 6.9 17.9l-2.6.2-.9-2.5L1 14.5l.4-2.6L0 9.7l1.6-2.1-.4-2.6 2.4-1.1.9-2.5 2.6.2Z" transform="scale(.92)" />
              <path d="m5.3 9 2.4 2.4 4.8-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>
          <p className="truncate text-[12.5px] leading-tight text-white/85">{typing ? "typing…" : "online"}</p>
        </div>
        <Video size={21} className="mx-1.5" />
        <Phone size={19} className="mx-1" />
        <MoreVertical size={20} />
      </div>

      {/* Messages */}
      <div className="kx-wa-wallpaper relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-2.5 pb-1.5 pt-2">
        <p className="mx-auto mb-1.5 rounded-[7px] bg-white px-2.5 py-[3px] text-[12px] text-[#54656f] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">Today</p>
        <p className="mx-auto mb-2 max-w-[94%] rounded-[7px] bg-[#ffeecd] px-2.5 py-[5px] text-center text-[11.5px] leading-snug text-[#54656f]">
          🔒 Messages are end-to-end encrypted. KlimateX can only read your home records; it can&apos;t move money.
        </p>
        {list.map((m, i) => {
          const first = list[i - 1]?.side !== m.side;
          const out = m.side === "out";
          const fill = out ? "#d9fdd3" : "#ffffff";
          return (
            <div key={m.id} className={`kx-msg-in flex ${out ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-[2px]"}`}>
              <div
                className={`relative max-w-[84%] rounded-[7.5px] px-[7px] pb-[5px] pt-[5px] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] ${first ? (out ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
                style={{ background: fill }}
              >
                {m.body}
                <span className="float-right ml-2.5 mt-[6px] inline-flex translate-y-[3px] items-center gap-[3px] text-[11px] text-[#667781]">
                  {m.time}
                  {out && <WaTicks />}
                </span>
                {first && <WaTail side={m.side} fill={fill} />}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="kx-msg-in mt-2 flex justify-start" aria-hidden>
            <span className="relative flex gap-1 rounded-[7.5px] rounded-tl-none bg-white px-3.5 py-3 shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">
              <Dots />
              <WaTail side="in" fill="#ffffff" />
            </span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-1.5 bg-[#efeae2] px-1.5 pb-1.5 pt-1">
        <span className="flex flex-1 items-center gap-2.5 rounded-full bg-white py-[9px] pl-3 pr-3.5 text-[15.5px] text-[#8696a0] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">
          <Smile size={22} strokeWidth={1.8} />
          <span className="flex-1">Message</span>
          <Paperclip size={20} strokeWidth={1.8} className="-rotate-45" />
          <Camera size={21} strokeWidth={1.8} />
        </span>
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm">
          <Mic size={21} />
        </span>
      </div>
    </div>
  );
}

/* ── Message parts both apps share ─────────────────────────── */

function PdfFile({ app }: { app: "tg" | "wa" }) {
  if (app === "wa") {
    return (
      <div className="-mx-[3px] -mt-[2px] mb-[1px] flex w-[218px] items-center gap-2.5 rounded-[6px] bg-[#f5f6f6] px-2.5 py-2.5">
        <span className="relative flex h-[34px] w-[27px] shrink-0 items-end justify-center rounded-[3px] bg-[#e5493a] pb-[3px] text-[8px] font-bold text-white">
          PDF
          <span className="absolute right-0 top-0 h-2 w-2 rounded-bl-[2px] bg-white/60" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] text-[#111b21]">KX-HEC-2026-LAG-000015.pdf</span>
          <span className="block text-[11.5px] text-[#667781]">2 pages · 184 kB · PDF</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#40a7e3] text-white">
        <FileText size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">KX-HEC-2026-LAG-000015.pdf</span>
        <span className="block text-[11.5px] text-[#8e8e93]">184 KB</span>
      </span>
    </div>
  );
}

function VoiceNote({ seconds, app }: { seconds: number; app: "tg" | "wa" }) {
  const bars = [3, 7, 12, 6, 10, 16, 9, 5, 13, 10, 4, 12, 15, 7, 3, 9, 13, 5, 8, 4, 6, 10, 5];
  if (app === "wa") {
    return (
      <div className="flex w-[214px] items-center gap-2 pr-1">
        <span className="relative shrink-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfe5e7] text-[#8696a0]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
              <circle cx="12" cy="8.5" r="4" />
              <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5Z" />
            </svg>
          </span>
          <Mic size={13} className="absolute -bottom-0.5 -right-1 text-[#53bdeb]" fill="currentColor" />
        </span>
        <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-[#8696a0]" fill="currentColor" aria-hidden>
          <path d="M8 5.5v13l10.5-6.5Z" />
        </svg>
        <span className="flex flex-1 flex-col">
          <span className="relative flex h-[22px] items-center gap-[2px]" aria-hidden>
            <span className="absolute left-0 h-3 w-3 rounded-full bg-[#53bdeb]" />
            {bars.map((h, i) => (
              <span key={i} className="w-[2.5px] rounded-full bg-[#b0bcc1]" style={{ height: h }} />
            ))}
          </span>
          <span className="text-[11px] text-[#667781]">0:0{seconds}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex w-[196px] items-center gap-2.5">
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#5fc04e] text-white">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M7 4.5v15L19 12Z" />
        </svg>
      </span>
      <span className="flex flex-col gap-[3px]">
        <span className="flex h-[18px] items-end gap-[2px]" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className={`w-[2.5px] rounded-full ${i < 9 ? "bg-[#5fc04e]" : "bg-[#5fc04e]/45"}`} style={{ height: Math.max(3, h) }} />
          ))}
        </span>
        <span className="text-[11.5px] text-[#3db84a]">0:0{seconds}</span>
      </span>
    </div>
  );
}

function Dots() {
  return (
    <>
      <span className="kx-dot h-[7px] w-[7px] rounded-full bg-[#9aa3a8]" />
      <span className="kx-dot h-[7px] w-[7px] rounded-full bg-[#9aa3a8] [animation-delay:150ms]" />
      <span className="kx-dot h-[7px] w-[7px] rounded-full bg-[#9aa3a8] [animation-delay:300ms]" />
    </>
  );
}

/* ── Phones ───────────────────────────────────────────────── */

function SignalBars({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 18 12" className={className} fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="0.8" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
      <rect x="10" y="3" width="3" height="9" rx="0.8" />
      <rect x="15" y="0" width="3" height="12" rx="0.8" />
    </svg>
  );
}

function Wifi({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 12" className={className} fill="currentColor">
      <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4 10.4 10.4 0 0 0 .8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.6.5 3.5 1.4l1.2-1.3A6.8 6.8 0 0 0 8 4 6.8 6.8 0 0 0 3.3 5.9l1.2 1.3c.9-.9 2.2-1.4 3.5-1.4Zm0 3.4c.4 0 .8.2 1.1.4L8 11.8 6.9 9.6c.3-.2.7-.4 1.1-.4Z" />
    </svg>
  );
}

/** An iPhone: titanium edge, Dynamic Island, iOS status bar and home indicator. */
function IPhone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[318px]">
      {/* side buttons */}
      <span aria-hidden className="absolute -left-[3px] top-[96px] h-[26px] w-[3px] rounded-l-sm bg-[#8b8f8e]" />
      <span aria-hidden className="absolute -left-[3px] top-[140px] h-[52px] w-[3px] rounded-l-sm bg-[#8b8f8e]" />
      <span aria-hidden className="absolute -left-[3px] top-[202px] h-[52px] w-[3px] rounded-l-sm bg-[#8b8f8e]" />
      <span aria-hidden className="absolute -right-[3px] top-[160px] h-[80px] w-[3px] rounded-r-sm bg-[#8b8f8e]" />
      <div className="aspect-[9/19.3] rounded-[3rem] bg-gradient-to-br from-[#b9bdbc] via-[#7d8281] to-[#c9cccb] p-[3px] shadow-[0_34px_70px_-26px_rgb(11_63_42/0.55),0_8px_18px_-8px_rgb(0_0_0/0.25)]">
        <div className="h-full rounded-[2.85rem] bg-black p-[9px]">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.3rem] bg-white" style={IOS_FONT}>
            <div className="relative flex h-[38px] shrink-0 items-center justify-between bg-[#f6f6f6]/[0.94] px-7 pt-1.5 text-[14px] font-semibold text-black">
              <span className="tracking-[-0.01em]">9:41</span>
              <span aria-hidden className="absolute left-1/2 top-[9px] h-[24px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
              <span className="flex items-center gap-[5px]">
                <SignalBars className="h-[11px] w-[17px]" />
                <Wifi className="h-[11px] w-[15px]" />
                <span aria-hidden className="relative flex h-[12px] w-[25px] items-center rounded-[4px] border border-black/40 p-[1.5px]">
                  <span className="h-full w-[78%] rounded-[2px] bg-black" />
                  <span className="absolute -right-[3.5px] top-1/2 h-[4px] w-[1.5px] -translate-y-1/2 rounded-r bg-black/40" />
                </span>
              </span>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
            <div className="flex h-[22px] shrink-0 items-center justify-center bg-[#d1d3d9]">
              <span aria-hidden className="h-[5px] w-[118px] rounded-full bg-black" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** An Android phone: flat black frame, punch-hole camera, Android status bar tinted by the app, gesture bar. */
function AndroidPhone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[318px]">
      <span aria-hidden className="absolute -right-[3px] top-[118px] h-[46px] w-[3px] rounded-r-sm bg-[#3a3f42]" />
      <span aria-hidden className="absolute -right-[3px] top-[180px] h-[84px] w-[3px] rounded-r-sm bg-[#3a3f42]" />
      <div className="aspect-[9/19.3] rounded-[2.6rem] bg-gradient-to-b from-[#3d4346] to-[#202426] p-[3px] shadow-[0_34px_70px_-26px_rgb(11_63_42/0.55),0_8px_18px_-8px_rgb(0_0_0/0.25)]">
        <div className="h-full rounded-[2.45rem] bg-black p-[8px]">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.05rem] bg-[#efeae2]" style={ANDROID_FONT}>
            <div className="relative flex h-[32px] shrink-0 items-center justify-between bg-[#008069] px-5 text-[13px] font-medium text-white">
              <span>9:41</span>
              <span aria-hidden className="absolute left-1/2 top-[8px] h-[14px] w-[14px] -translate-x-1/2 rounded-full bg-black ring-[1.5px] ring-[#1d2b33]" />
              <span className="flex items-center gap-[5px]">
                <Wifi className="h-[11px] w-[14px]" />
                <SignalBars className="h-[11px] w-[15px]" />
                <span aria-hidden className="relative h-[12px] w-[7px] rounded-[2px] border border-white/90 p-[1px]">
                  <span className="absolute inset-x-[1px] bottom-[1px] h-[70%] rounded-[1px] bg-white" />
                </span>
                <span className="text-[12px]">78%</span>
              </span>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
            <div className="flex h-[18px] shrink-0 items-center justify-center bg-[#efeae2]">
              <span aria-hidden className="h-[4px] w-[96px] rounded-full bg-[#1f2c34]/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Playback ─────────────────────────────────────────────── */

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
              <IPhone label="A Telegram chat with the KlimateX bot on an iPhone: a voice note answered in Pidgin, then the home card">
                <TelegramChat shown={tgShown} typing={tgTyping} />
              </IPhone>
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
              <AndroidPhone label="A preview of KlimateX on WhatsApp on an Android phone: a payout alert, tips to earn more in Pidgin, and the certificate PDF">
                <WhatsAppChat shown={waShown} typing={waTyping} />
              </AndroidPhone>
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
