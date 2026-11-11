import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { errorMessage, type User } from "./api";
import { useAuth } from "./auth-context";
import { loadDashboard, type Alert, type Dashboard } from "./household";
import { readPref, writePref } from "./prefs";

type State = { data: Dashboard | null; error: string; offline: boolean; loading: boolean; refreshing: boolean };

type Context = State & {
  user: User;
  /** Alerts minus the ones the family dismissed on this phone. */
  alerts: Alert[];
  dismissedCount: number;
  dismiss: (id: string) => void;
  restoreAlerts: () => void;
  reload: (mode?: "refresh" | "quiet") => Promise<void>;
  lang: string;
  setLang: (lang: string) => void;
};

const HouseholdContext = createContext<Context | null>(null);

export function useHousehold(): Context {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error("useHousehold must be used inside HouseholdProvider");
  return context;
}

/** The signed-in family's dashboard, as on the web. Loaded once after sign-in; pull to refresh reloads it. */
export function useDashboard(): Dashboard {
  const { data } = useHousehold();
  if (!data) throw new Error("useDashboard needs a loaded dashboard");
  return data;
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ data: null, error: "", offline: false, loading: true, refreshing: false });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lang, setLangState] = useState("en");
  const loads = useRef(0);

  const reload = useCallback(async (mode: "refresh" | "quiet" = "quiet") => {
    const id = ++loads.current;
    setState((s) => ({ ...s, refreshing: mode === "refresh", loading: s.data === null }));
    try {
      const data = await loadDashboard();
      if (id === loads.current) setState({ data, error: "", offline: false, loading: false, refreshing: false });
    } catch (e) {
      // Keep showing what was loaded before; the screen shows the error over it.
      if (id === loads.current)
        setState((s) => ({
          ...s,
          error: errorMessage(e, "Your home couldn't be loaded. Try again."),
          offline: (e as { status?: number }).status === 0,
          loading: false,
          refreshing: false,
        }));
    }
  }, []);

  useEffect(() => {
    void reload();
    readPref("lang").then((v) => v && setLangState(v));
    readPref("dismissed").then((v) => v && setDismissed(JSON.parse(v) as string[]));
  }, [reload]);

  const value = useMemo<Context | null>(() => {
    if (!session) return null;
    const all = state.data?.alerts ?? [];
    const alerts = all.filter((a) => !dismissed.includes(a.id));
    return {
      ...state,
      user: session.user,
      alerts,
      dismissedCount: all.length - alerts.length,
      dismiss: (id) => {
        const next = [...dismissed, id];
        setDismissed(next);
        writePref("dismissed", JSON.stringify(next));
      },
      restoreAlerts: () => {
        setDismissed([]);
        writePref("dismissed", null);
      },
      reload,
      lang,
      setLang: (next) => {
        setLangState(next);
        writePref("lang", next);
      },
    };
  }, [session, state, dismissed, lang, reload]);

  if (!value) return null;
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
