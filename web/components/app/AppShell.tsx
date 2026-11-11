"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { LogOut, Menu, X } from "lucide-react";
import { api, getSession, signOut, type Role, type User } from "@/lib/api";
import { homeFor, workspaces } from "@/lib/workspaces";

/** The layout every signed-in workspace shares. It confirms the session with the server before showing anything. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const workspace = workspaces[role];

  useEffect(() => {
    if (!getSession()) {
      window.location.replace("/app/");
      return;
    }
    if (role === "buyer") {
      window.location.replace(homeFor("buyer"));
      return;
    }
    api<User>("/api/auth/me")
      .then((me) => {
        if (me.role !== role) window.location.replace(homeFor(me.role));
        else setUser(me);
      })
      .catch(() => window.location.replace("/app/"));
  }, [role]);

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your workspace…</div>;
  }

  async function leave() {
    await signOut();
    window.location.replace("/app/");
  }

  const Icon = workspace.icon;
  return (
    <div className="min-h-screen bg-[#f6f8f5] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="bg-forest text-white/75 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between px-4 py-4 lg:px-5 lg:py-5">
          <span className="rounded-lg bg-white px-2.5 py-1.5">
            <Image src="/logo.svg" alt="KlimateX" width={120} height={28} className="h-6 w-auto" />
          </span>
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="rounded-md p-1.5 text-white lg:hidden">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <nav aria-label="Workspace" className={`${menuOpen ? "block" : "hidden"} px-3 pb-3 lg:block lg:flex-1`}>
          {workspace.nav.map((item, index) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              onClick={() => setMenuOpen(false)}
              aria-current={index === 0 ? "page" : undefined}
              className={`mb-0.5 block rounded-lg px-3 py-2 text-sm transition hover:bg-white/10 hover:text-white ${index === 0 ? "bg-white/12 font-medium text-white" : ""}`}
            >
              {item}
            </a>
          ))}
        </nav>
        <div className={`${menuOpen ? "block" : "hidden"} border-t border-white/10 px-5 py-4 lg:block`}>
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs">{user.email}</p>
          <button type="button" onClick={leave} className="mt-3 inline-flex items-center gap-1.5 text-xs hover:text-white">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-7 sm:px-8 sm:py-9">
        <header className="flex items-start gap-3">
          <Icon size={26} strokeWidth={1.8} className="mt-0.5 text-forest" aria-hidden />
          <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{workspace.title}</h1>
            <p className="mt-1 text-sm text-body">{workspace.summary}</p>
          </div>
        </header>
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
