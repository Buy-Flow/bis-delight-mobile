import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Award, Home, Heart, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: typeof Home;
  to: string;
  search?: Record<string, string>;
  match: (path: string, search: URLSearchParams) => boolean;
};

const leftItems: Item[] = [
  {
    label: "Pedidos",
    icon: ClipboardList,
    to: "/conta",
    search: { tab: "pedidos" },
    match: (p, s) => p === "/conta" && s.get("tab") === "pedidos",
  },
  {
    label: "Recompensas",
    icon: Award,
    to: "/recompensas",
    match: (p) => p.startsWith("/recompensas"),
  },
];

const rightItems: Item[] = [
  {
    label: "Favoritos",
    icon: Heart,
    to: "/conta",
    search: { tab: "favoritos" },
    match: (p, s) => p === "/conta" && s.get("tab") === "favoritos",
  },
  {
    label: "Perfil",
    icon: UserIcon,
    to: "/conta",
    search: { tab: "perfil" },
    match: (p, s) => p === "/conta" && s.get("tab") === "perfil",
  },
];

function NavItem({ item, path, search }: { item: Item; path: string; search: URLSearchParams }) {
  const active = item.match(path, search);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      search={item.search as never}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition",
        active ? "text-neon-pink" : "text-white/60 hover:text-white",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(236,72,153,0.7)]")} />
      <span className="leading-tight">{item.label}</span>
    </Link>
  );
}

export function BottomNav() {
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  });
  const search = new URLSearchParams(searchStr ?? "");

  // Hide on admin / auth-only routes
  const hiddenPrefixes = ["/pedidos", "/carrinhos", "/clientes", "/financeiro", "/notificacoes", "/admin", "/auth"];
  if (hiddenPrefixes.some((p) => pathname.startsWith(p))) return null;

  const isHome = pathname === "/";

  return (
    <>
      {/* Spacer so content isn't hidden behind the fixed nav */}
      <div aria-hidden className="h-20 md:hidden" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-md px-3 pb-2">
          <div className="relative flex items-end gap-1 rounded-2xl border border-white/10 bg-[#1a0324]/90 px-2 py-1.5 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {leftItems.map((it) => (
              <NavItem key={it.label} item={it} path={pathname} search={search} />
            ))}

            {/* Center highlighted button */}
            <div className="flex flex-1 items-start justify-center">
              <Link
                to="/"
                className={cn(
                  "-mt-6 flex flex-col items-center gap-0.5",
                )}
              >
                <span
                  className={cn(
                    "grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-[0_10px_28px_-6px_rgba(236,72,153,0.75)] ring-4 ring-[#1a0324] transition",
                    isHome && "scale-105",
                  )}
                >
                  <Home className="h-6 w-6" />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    isHome ? "text-neon-pink" : "text-white/70",
                  )}
                >
                  Cardápio
                </span>
              </Link>
            </div>

            {rightItems.map((it) => (
              <NavItem key={it.label} item={it} path={pathname} search={search} />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
