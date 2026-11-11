import * as SecureStore from "expo-secure-store";

/** Where the API lives. Set EXPO_PUBLIC_API_BASE to point at a local server, e.g. http://localhost:8080. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "https://team20.xtradot.co").replace(/\/+$/, "");

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
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
  /** True when the phone couldn't reach the server at all. */
  get offline() {
    return this.status === 0;
  }
}

export const errorMessage = (e: unknown, fallback = "Something went wrong. Try again.") => (e instanceof ApiError ? e.message : fallback);

/* ───────────── Session storage ─────────────
 * Tokens live in the iOS Keychain / Android Keystore through expo-secure-store.
 * Each value is stored under its own key to stay well under SecureStore's per-item size guidance.
 * An in-memory copy is the source of truth while the app runs; writes are queued so they land in order.
 */

const KEYS = { access: "klimatex.access", refresh: "klimatex.refresh", user: "klimatex.user" } as const;

let current: Session | null = null;
/** False until the saved session has been read, so an early call (or a hot reload in development) waits for it. */
let loaded = false;
/** Bumped on every sign-in and sign-out, so a refresh that finishes after sign-out can't bring the session back. */
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();
const listeners = new Set<(session: Session | null) => void>();

export function getSession(): Session | null {
  return current;
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadSession(): Promise<Session | null> {
  try {
    const [access, refresh, user] = await Promise.all([SecureStore.getItemAsync(KEYS.access), SecureStore.getItemAsync(KEYS.refresh), SecureStore.getItemAsync(KEYS.user)]);
    current = access && refresh && user ? { access_token: access, refresh_token: refresh, user: JSON.parse(user) as User } : null;
  } catch {
    current = null;
  }
  loaded = true;
  return current;
}

function saveSession(session: Session | null) {
  current = session;
  loaded = true;
  listeners.forEach((l) => l(session));
  writes = writes
    .catch(() => undefined)
    .then(() =>
      session
        ? Promise.all([
            SecureStore.setItemAsync(KEYS.access, session.access_token),
            SecureStore.setItemAsync(KEYS.refresh, session.refresh_token),
            SecureStore.setItemAsync(KEYS.user, JSON.stringify(session.user)),
          ])
        : Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k))),
    );
  return writes;
}

/** Updates the stored user (after a name change, for example) without touching the tokens. */
export function updateUser(user: User) {
  if (current) void saveSession({ ...current, user });
}

/* ───────────── Transport ───────────── */

type Result<T> = { status: number; data: T; message: string };

async function send<T>(path: string, method: string, body: unknown, token?: string, timeoutMs = 20_000): Promise<Result<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "KlimateX can't be reached right now. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  const json = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  // A gateway error (502/503/504) comes back as plain text from the proxy, not as {meta, data, error}.
  const fallback = response.status >= 500 ? "KlimateX is having trouble right now. Try again in a minute." : "Something went wrong. Try again.";
  return { status: response.status, data: json?.data as T, message: json?.error?.message ?? fallback };
}

let refreshing: Promise<Session | null> | null = null;
/** Counts refresh calls actually sent, so the refresh behaviour can be checked from the developer tools. */
export const refreshStats = { sent: 0 };

/**
 * Refresh tokens are single-use: the server revokes the whole session if one is replayed.
 * Screens fire several requests at once, so when the access token expires they all get 401 together.
 * They share one refresh instead of each spending the same token.
 */
function refreshSession(stale: Session): Promise<Session | null> {
  if (!refreshing) {
    refreshing = (async () => {
      // An earlier refresh may already have rotated the tokens, or the user signed out meanwhile.
      if (!current) return null;
      if (current.refresh_token !== stale.refresh_token) return current;
      const startedIn = generation;
      refreshStats.sent += 1;
      const result = await send<Session>("/api/auth/refresh", "POST", { refresh_token: stale.refresh_token });
      if (startedIn !== generation) return current;
      if (result.status !== 200) {
        // The refresh token is spent or revoked: the family has to sign in again.
        generation += 1;
        await saveSession(null);
        return null;
      }
      await saveSession({ ...result.data, user: result.data.user ?? stale.user });
      return current;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** Calls the API as the signed-in family. An expired access token is refreshed once, transparently. */
export async function api<T>(path: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const method = options.method ?? "GET";
  if (!loaded) await loadSession();
  let session = current;
  let result = await send<T>(path, method, options.body, session?.access_token, options.timeoutMs);
  if (result.status === 401 && session) {
    session = await refreshSession(session);
    if (!session) throw new ApiError(401, "Your session has ended. Sign in again.");
    result = await send<T>(path, method, options.body, session.access_token, options.timeoutMs);
  }
  if (result.status >= 400) throw new ApiError(result.status, result.message);
  return result.data;
}

/** Developer check: spoils the access token so the next calls must refresh. */
export function spoilAccessToken() {
  if (current) current = { ...current, access_token: `${current.access_token}x` };
}

export async function signOut(): Promise<void> {
  const session = current;
  generation += 1;
  await saveSession(null);
  if (session) await send("/api/auth/logout", "POST", { refresh_token: session.refresh_token }).catch(() => undefined);
}

/* ───────────── Phone sign-in ─────────────
 * Families sign in with their phone and a 4-digit PIN. A one-time code proves the phone the first time.
 */

export type PhoneStart = { next: "pin" | "code"; phone: string; expires_in?: number; demo_code?: string };
export type PhoneVerified = { setup_token: string; name: string; returning: boolean };

async function post<T>(path: string, body: unknown): Promise<T> {
  const result = await send<T>(path, "POST", body);
  if (result.status !== 200) throw new ApiError(result.status, result.message);
  return result.data;
}

export const phoneStart = (phone: string, forgotPin = false) => post<PhoneStart>("/api/auth/phone/start", { phone, forgot_pin: forgotPin });

export const phoneVerify = (phone: string, code: string) => post<PhoneVerified>("/api/auth/phone/verify", { phone, code });

async function begin(session: Session): Promise<User> {
  generation += 1;
  await saveSession(session);
  return session.user;
}

export const phoneComplete = async (setupToken: string, pin: string, name: string) =>
  begin(await post<Session>("/api/auth/phone/complete", { setup_token: setupToken, pin, name }));

export const phoneSignIn = async (phone: string, pin: string) => begin(await post<Session>("/api/auth/phone/login", { phone, pin }));
