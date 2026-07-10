import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  LineChart,
  Users,
  Home,
  LogOut,
  Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Painel administrador", icon: LayoutDashboard },
  { to: "/rush", label: "Rush (tempo real)", icon: Flame },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/financeiro", label: "Financeiro", icon: LineChart },
  { to: "/clientes", label: "Clientes", icon: Users },

] as const;

export function AdminNavMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = items.find((i) => i.to === pathname);
  const CurrentIcon = current?.icon ?? LayoutDashboard;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-purple-800/60"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        <CurrentIcon className="h-3.5 w-3.5 text-neon-yellow" />
        <span className="max-w-[8rem] truncate">{current?.label ?? "Menu"}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-purple-500/30 bg-[oklch(0.13_0.09_300)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] z-50">
          <ul className="p-1.5">
            {items.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-neon-pink/20 text-white"
                        : "text-white/80 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 text-neon-yellow" />
                    <span className="flex-1">{label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-neon-pink" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-white/10 p-1.5">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
            >
              <Home className="h-4 w-4" /> Ver site
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
