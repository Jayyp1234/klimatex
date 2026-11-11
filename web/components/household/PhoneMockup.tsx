"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BatteryMedium,
  Camera,
  ExternalLink,
  Image as ImageIcon,
  Lock,
  Mic,
  MoreVertical,
  Paperclip,
  Phone as PhoneIcon,
  Plus,
  Reply,
  SendHorizontal,
  Signal,
  Smile,
  Video,
  Wifi,
} from "lucide-react";

export type Channel = "sms" | "whatsapp";

const FONT = { fontFamily: "Roboto, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" };

/** How long the sender "types" before the message lands, so the preview plays like a real chat. */
const TYPING_MS = 1300;

function useClock() {
  const [now] = useState(() => new Date());
  return now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** A light, original doodle pattern (suns, leaves, dots) in the spirit of a chat wallpaper. */
const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120' fill='none' stroke='#d8cfc2' stroke-width='1.1' stroke-linecap='round'>
    <circle cx='20' cy='22' r='6'/><path d='M20 10v-4M20 38v-4M8 22H4M36 22h-4M11.5 13.5l-2.8-2.8M31.3 33.3l-2.8-2.8M11.5 30.5l-2.8 2.8M31.3 10.7l-2.8 2.8'/>
    <path d='M78 18c10 0 16 6 16 16-10 0-16-6-16-16z'/><path d='M78 18c4 6 9 11 16 16'/>
    <rect x='52' y='60' width='16' height='11' rx='2'/><path d='M60 71v5M55 76h10'/>
    <path d='M98 70l6 10h-12z'/><circle cx='30' cy='88' r='2'/><circle cx='88' cy='104' r='2'/><circle cx='12' cy='60' r='1.6'/>
    <path d='M26 104c4-6 10-6 14 0'/><path d='M100 44c3 2 3 6 0 8'/>
  </svg>`,
)}")`;

function Frame({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <div className="relative mx-auto w-[318px] max-w-full select-none" style={FONT}>
      {/* side buttons */}
      <span aria-hidden className="absolute -right-[3px] top-[120px] h-[64px] w-[4px] rounded-r bg-[#2a2a2a]" />
      <span aria-hidden className="absolute -left-[3px] top-[104px] h-[40px] w-[4px] rounded-l bg-[#2a2a2a]" />
      <span aria-hidden className="absolute -left-[3px] top-[154px] h-[40px] w-[4px] rounded-l bg-[#2a2a2a]" />
      <div className="rounded-[46px] bg-[#141414] p-[9px] shadow-[0_40px_80px_-30px_rgb(11_63_42/0.55),inset_0_0_0_1.5px_#3a3a3a]">
        <div className={`relative flex h-[640px] flex-col overflow-hidden rounded-[38px] ${dark ? "bg-[#008069]" : "bg-white"}`}>
          {/* punch-hole camera */}
          <span aria-hidden className="absolute left-1/2 top-[9px] z-20 h-[13px] w-[13px] -translate-x-1/2 rounded-full bg-[#0b0b0b] ring-2 ring-black/30" />
          {children}
          {/* gesture bar */}
          <div className={`flex h-[18px] shrink-0 items-center justify-center ${dark ? "bg-[#f0f2f5]" : "bg-white"}`}>
            <span className="h-[4px] w-[108px] rounded-full bg-black/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ time, light }: { time: string; light: boolean }) {
  return (
    <div className={`flex h-[34px] shrink-0 items-center justify-between px-6 pt-1 text-[12.5px] font-medium ${light ? "text-white" : "text-[#1f1f1f]"}`}>
      <span>{time}</span>
      <span className="flex items-center gap-1.5"><Wifi size={14} strokeWidth={2.4} /><Signal size={14} strokeWidth={2.4} /><BatteryMedium size={17} strokeWidth={2} /></span>
    </div>
  );
}

function Dots({ tone }: { tone: string }) {
  return (
    <span className="flex items-center gap-[5px] py-[3px]">
      {[0, 1, 2].map((d) => <span key={d} className={`kx-dot h-[7px] w-[7px] rounded-full ${tone}`} style={{ animationDelay: `${d * 160}ms` }} />)}
    </span>
  );
}

const KEYFRAMES = `
@keyframes kx-pop { 0% { opacity: 0; transform: translateY(8px) scale(.96); } 100% { opacity: 1; transform: none; } }
@keyframes kx-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-4px); opacity: 1; } }
.kx-pop { animation: kx-pop .28s cubic-bezier(.2,.9,.3,1.2) both; transform-origin: top left; }
.kx-dot { animation: kx-bounce 1.1s infinite ease-in-out; }
@media (prefers-reduced-motion: reduce) { .kx-pop, .kx-dot { animation: none; } }
`;

function WhatsApp({ text, typing, time, lang }: { text: string | null; typing: boolean; time: string; lang: string }) {
  return (
    <>
      <div className="shrink-0 bg-[#008069] text-white">
        <StatusBar time={time} light />
        <div className="flex items-center gap-2 px-2 pb-2.5 pt-1">
          <ArrowLeft size={22} />
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white">
            {/* The leaf from the KlimateX logo, cropped from the wordmark. */}
            <span className="h-[26px] w-[26px] bg-no-repeat" style={{ backgroundImage: "url(/logo.svg)", backgroundSize: "auto 100%", backgroundPosition: "left center" }} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-1 text-[16.5px] font-medium">KlimateX <BadgeCheck size={15} className="fill-[#25d366] text-[#008069]" /></p>
            <p className="truncate text-[12.5px] text-white/85">{typing ? "typing…" : "online"}</p>
          </div>
          <Video size={21} className="mx-1.5" />
          <PhoneIcon size={19} className="mx-1.5" />
          <MoreVertical size={20} />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden bg-[#efeae2] px-2.5 pb-2 pt-3" style={{ backgroundImage: WALLPAPER }}>
        <p className="mx-auto rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-medium uppercase tracking-wide text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">Today</p>
        <p className="mx-4 mb-1 flex items-start gap-1.5 rounded-lg bg-[#ffeecd] px-2.5 py-1.5 text-center text-[11.5px] leading-snug text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
          <Lock size={11} className="mt-[2px] shrink-0" /> Messages are end-to-end encrypted. KlimateX is a verified business account.
        </p>

        {typing || !text ? (
          <div className="relative ml-2 w-fit rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
            <Tail />
            <Dots tone="bg-[#8696a0]" />
          </div>
        ) : (
          <div key={text} className="kx-pop ml-2 max-w-[86%]">
            <div className="relative rounded-lg rounded-tl-none bg-white shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
              <Tail />
              <p lang={lang === "pcm" ? "en-NG" : lang} className="px-2.5 pb-1 pt-1.5 text-[14.2px] leading-[19px] text-[#111b21]">
                {text}
                <span className="float-right ml-2 mt-[6px] text-[11px] leading-none text-[#667781]">{time}</span>
              </p>
            </div>
            <div className="mt-[2px] divide-y divide-[#e9edef] overflow-hidden rounded-lg bg-white shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
              <p className="flex items-center justify-center gap-1.5 py-2 text-[14px] font-medium text-[#027eb5]"><ExternalLink size={15} /> Open KlimateX</p>
              <p className="flex items-center justify-center gap-1.5 py-2 text-[14px] font-medium text-[#027eb5]"><Reply size={15} /> Talk to us</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-end gap-1.5 bg-[#f0f2f5] px-1.5 py-1.5">
        <div className="flex h-[44px] flex-1 items-center gap-2.5 rounded-full bg-white px-3 text-[#8696a0]">
          <Smile size={22} />
          <span className="flex-1 text-[15.5px]">Message</span>
          <Paperclip size={20} className="-rotate-45" />
          <Camera size={21} />
        </div>
        <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#00a884] text-white"><Mic size={21} /></span>
      </div>
    </>
  );
}

function Sms({ text, typing, time, lang }: { text: string | null; typing: boolean; time: string; lang: string }) {
  return (
    <>
      <div className="shrink-0 bg-white">
        <StatusBar time={time} light={false} />
        <div className="flex items-center gap-3 px-3 pb-2.5 pt-1 text-[#1f1f1f]">
          <ArrowLeft size={22} />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c2e7ff] text-[15px] font-medium text-[#001d35]">K</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[17px]">KlimateX</p>
            <p className="truncate text-[12px] text-[#5f6368]">Text message</p>
          </div>
          <PhoneIcon size={20} className="mx-1" />
          <MoreVertical size={20} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden bg-white px-3 pb-3">
        <p className="text-center text-[11.5px] text-[#5f6368]">Today · {time}</p>
        {typing || !text ? (
          <div className="flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c2e7ff] text-[12px] font-medium text-[#001d35]">K</span>
            <div className="w-fit rounded-[20px] rounded-bl-[6px] bg-[#e9eef6] px-3.5 py-2.5"><Dots tone="bg-[#5f6368]" /></div>
          </div>
        ) : (
          <div key={text} className="kx-pop flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c2e7ff] text-[12px] font-medium text-[#001d35]">K</span>
            <div className="max-w-[80%]">
              <p lang={lang === "pcm" ? "en-NG" : lang} className="rounded-[20px] rounded-bl-[6px] bg-[#e9eef6] px-3.5 py-2.5 text-[14.5px] leading-[20px] text-[#1f1f1f]">{text}</p>
              <p className="mt-1 pl-1 text-[11px] text-[#5f6368]">{time} · SMS</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 bg-white px-2 pb-1.5 pt-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9eef6] text-[#1f1f1f]"><Plus size={20} /></span>
        <div className="flex h-[44px] flex-1 items-center gap-2.5 rounded-full bg-[#e9eef6] px-4 text-[#5f6368]">
          <span className="flex-1 text-[15px]">Text message</span>
          <Smile size={20} />
          <ImageIcon size={20} />
        </div>
        <span className="flex h-9 w-9 items-center justify-center text-[#5f6368]"><SendHorizontal size={20} /></span>
      </div>
    </>
  );
}

function Tail() {
  return (
    <svg aria-hidden viewBox="0 0 8 13" className="absolute -left-[8px] top-0 h-[13px] w-[8px]">
      <path d="M8 0H1.5C.6 0 0 .9.6 1.6L8 11z" fill="#fff" />
    </svg>
  );
}

/** A phone showing the family's monthly message as it would arrive, by WhatsApp or SMS. */
export function PhoneMockup({ channel, text, loading, lang }: { channel: Channel; text: string | null; loading: boolean; lang: string }) {
  const time = useClock();
  // The sender "types" for a moment each time a new message (language or channel) comes in.
  const [landed, setLanded] = useState<string | null>(null);
  const current = text ? `${channel}:${text}` : null;
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setLanded(current), TYPING_MS);
    return () => clearTimeout(timer);
  }, [current]);
  const typing = loading || !current || landed !== current;

  return (
    <div aria-label={`Preview of the ${channel === "sms" ? "SMS" : "WhatsApp"} message`} role="img">
      <style>{KEYFRAMES}</style>
      <Frame dark={channel === "whatsapp"}>
        {channel === "whatsapp"
          ? <WhatsApp text={text} typing={typing} time={time} lang={lang} />
          : <Sms text={text} typing={typing} time={time} lang={lang} />}
      </Frame>
      {text && <p className="sr-only">{text}</p>}
    </div>
  );
}
