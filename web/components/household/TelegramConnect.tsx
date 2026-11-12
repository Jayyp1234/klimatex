"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, LoaderCircle, Send } from "lucide-react";
import { ApiError } from "@/lib/api";
import { createTelegramLink, fetchTelegram, unlinkTelegram, type TelegramStatus } from "@/lib/telegram";

/**
 * Connect this home to the KlimateX bot on Telegram. The button opens Telegram with a one-time code,
 * so the family taps Start and the chat is linked; no phone number is matched or shared.
 */
export function TelegramConnect() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    fetchTelegram().then((s) => !stale && setStatus(s)).catch(() => {});
    return () => {
      stale = true;
    };
  }, []);

  if (!status?.configured) return null;

  async function connect() {
    setError("");
    setBusy(true);
    // Open the tab first, while the click still counts as the user's, then send it to Telegram.
    const tab = window.open("about:blank", "_blank");
    try {
      const link = await createTelegramLink();
      if (tab) tab.location.href = link.url;
      else window.location.href = link.url;
      setOpened(link.url);
    } catch (e) {
      tab?.close();
      setError(e instanceof ApiError ? e.message : "Telegram couldn't be connected. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      setStatus({ ...status!, linked_chats: (await unlinkTelegram()).linked_chats });
      setOpened(null);
    } finally {
      setBusy(false);
    }
  }

  const linked = status.linked_chats > 0;
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f2fb] text-[#229ed9]"><Send size={19} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">
          {linked ? <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={16} className="text-leaf" /> Connected to Telegram</span> : "Ask on Telegram too"}
        </p>
        <p className="text-[13px] text-body">
          {linked
            ? `${status.linked_chats} ${status.linked_chats === 1 ? "chat is" : "chats are"} connected to @${status.bot}. Send /stop there, or disconnect here.`
            : `Chat with @${status.bot} for the same answers about your home. Tap Connect, then Start in Telegram.`}
        </p>
        {opened && !linked && (
          <p className="mt-1 text-[12.5px] text-muted">
            Telegram didn&apos;t open? <a href={opened} className="font-medium text-leaf hover:underline">Open the link</a>. It works once, for 15 minutes.
          </p>
        )}
        {error && <p role="alert" className="mt-1 text-[12.5px] text-red-700">{error}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={connect} disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#229ed9] px-3.5 text-[13px] font-semibold text-white hover:bg-[#1b8bc0] disabled:opacity-60">
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ExternalLink size={15} />} {linked ? "Connect another phone" : "Connect Telegram"}
        </button>
        {linked && (
          <button type="button" onClick={disconnect} disabled={busy} className="h-9 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-mint">
            Disconnect
          </button>
        )}
      </div>
    </section>
  );
}
