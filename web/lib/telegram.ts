import { api } from "./api";

export type TelegramStatus = { configured: boolean; bot: string | null; linked_chats: number };
export type TelegramLink = { url: string; bot: string; expires_in: number };

export const fetchTelegram = () => api<TelegramStatus>("/api/telegram");
export const createTelegramLink = () => api<TelegramLink>("/api/telegram/link", { method: "POST" });
export const unlinkTelegram = () => api<{ linked_chats: number }>("/api/telegram/link", { method: "DELETE" });
