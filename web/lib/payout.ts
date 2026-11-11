import { api } from "./api";

export type Bank = { code: string; name: string };

export type PayoutDetails = {
  method: "wallet" | "bank";
  wallet: { provider: string; phone: string | null } | null;
  bank: { bank_code: string; bank_name: string; account_ending: string; account_name: string } | null;
  has_loan: boolean;
  updated_at: string | null;
  banks: Bank[];
};

export const fetchPayoutDetails = () => api<PayoutDetails>("/api/homes/mine/payout-details");

/** Asks the bank whose name is on the account. Nothing is saved. */
export const checkAccount = (bankCode: string, account: string) =>
  api<{ account_name: string; bank_name: string }>("/api/homes/mine/payout-details/check", { method: "POST", body: { bank_code: bankCode, account } });

export const savePayoutDetails = (method: "wallet" | "bank", bankCode = "", account = "") =>
  api<PayoutDetails>("/api/homes/mine/payout-details", { method: "POST", body: { method, bank_code: bankCode, account } });

/** +2347000010012 → 0700 001 0012 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone || !phone.startsWith("+234") || phone.length !== 14) return phone ?? "";
  const local = "0" + phone.slice(4);
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** Accounts made at a first phone sign-in carry an internal placeholder address, which is never shown. */
export const realEmail = (email: string) => (email.endsWith("@households.klimatex.test") ? null : email);
