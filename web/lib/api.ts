import { API_BASE } from "./links";

export type Role = "household" | "installer" | "auditor" | "buyer" | "lender" | "admin";

export type User = {
  id: number;
  email: string;
  phone: string | null;
  name: string;
  role: Role;
  household_id: number | null;
  installer_id: number | null;
};

export type Session = { access_token: string; refresh_token: string; user: User };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const KEY = "klimatex.session";

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Keeps a session the server issued, so the person is signed in. Also used by sign-up, which returns the same shape. */
export function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; the session then lasts for this page only.
  }
}

async function send<T>(path: string, method: string, body: unknown, token?: string): Promise<{ status: number; data: T; message: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "KlimateX can't be reached right now. Try again shortly.");
  }
  const json = await response.json().catch(() => null);
  return { status: response.status, data: json?.data as T, message: json?.error?.message ?? "Something went wrong. Try again." };
}

let refreshing: Promise<Session | null> | null = null;

/**
 * Refresh tokens are single-use: the server revokes the whole session if one is replayed.
 * Pages fire several requests at once, so when the access token expires they all hit 401 together.
 * They share one refresh instead of each spending the same token.
 */
function refreshSession(session: Session): Promise<Session | null> {
  if (!refreshing) {
    refreshing = (async () => {
      // Another tab or an earlier call may already have rotated the tokens.
      const current = getSession();
      if (current && current.refresh_token !== session.refresh_token) return current;
      const result = await send<Session>("/api/auth/refresh", "POST", { refresh_token: session.refresh_token });
      if (result.status !== 200) {
        saveSession(null);
        return null;
      }
      saveSession(result.data);
      return result.data;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** Calls the API as the signed-in user. An expired access token is refreshed once, transparently. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? "GET";
  let session = getSession();
  let result = await send<T>(path, method, options.body, session?.access_token);
  if (result.status === 401 && session) {
    session = await refreshSession(session);
    if (session) result = await send<T>(path, method, options.body, session.access_token);
  }
  if (result.status >= 400) throw new ApiError(result.status, result.message);
  return result.data;
}

export async function signIn(email: string, password: string): Promise<User> {
  const result = await send<Session>("/api/auth/login", "POST", { email, password });
  if (result.status !== 200) throw new ApiError(result.status, result.message);
  saveSession(result.data);
  return result.data.user;
}

export async function signOut(): Promise<void> {
  const session = getSession();
  saveSession(null);
  if (session) await send("/api/auth/logout", "POST", { refresh_token: session.refresh_token }).catch(() => undefined);
}

/* Households sign in with their phone and a 4-digit PIN. A one-time code proves the phone the first time. */

export type PhoneStart = { next: "pin" | "code"; phone: string; expires_in?: number; demo_code?: string };
export type PhoneVerified = { setup_token: string; name: string; returning: boolean };

/** A public call: no token, and no refresh on a 401 (a wrong code is a 401 too). */
export async function post<T>(path: string, body: unknown): Promise<T> {
  const result = await send<T>(path, "POST", body);
  if (result.status !== 200) throw new ApiError(result.status, result.message);
  return result.data;
}

export const phoneStart = (phone: string, forgotPin = false) => post<PhoneStart>("/api/auth/phone/start", { phone, forgot_pin: forgotPin });

export const phoneVerify = (phone: string, code: string) => post<PhoneVerified>("/api/auth/phone/verify", { phone, code });

export async function phoneComplete(setupToken: string, pin: string, name: string): Promise<User> {
  const session = await post<Session>("/api/auth/phone/complete", { setup_token: setupToken, pin, name });
  saveSession(session);
  return session.user;
}

export async function phoneSignIn(phone: string, pin: string): Promise<User> {
  const session = await post<Session>("/api/auth/phone/login", { phone, pin });
  saveSession(session);
  return session.user;
}
