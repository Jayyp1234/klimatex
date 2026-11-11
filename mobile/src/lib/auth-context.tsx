import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, loadSession, onSessionChange, type Session } from "./api";

type AuthState = { ready: boolean; session: Session | null };

const AuthContext = createContext<AuthState>({ ready: false, session: null });

/** Restores the saved session at launch and follows sign-in, refresh and sign-out from then on. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, session: getSession() });

  useEffect(() => {
    const stop = onSessionChange((session) => setState({ ready: true, session }));
    loadSession().then((session) => setState({ ready: true, session }));
    return stop;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
