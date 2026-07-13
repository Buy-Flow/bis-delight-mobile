import { Link, useRouterState } from "@tanstack/react-router";
import { Award, Home, Heart, User as UserIcon, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import { useIsInsideAdminShell } from "@/lib/admin-shell-flag";

type LinkItem = {
  kind: "link";
  label: string;
  icon: typeof Home;
  to: string;
  search?: Record<string, string>;
  match: (path: string, search: URLSearchParams) => boolean;
};

const leftItems: LinkItem[] = [
  {
    kind: "link",
    label: "Recompensas",
    icon: Award,
    to: "/recompensas",
    match: (p) => p.startsWith("/recompensas"),
  },
  {
    kind: "link",
    label: "Favoritos",
    icon: Heart,
    to: "/conta",
    search: { tab: "favoritos" },
    match: (p, s) => p === "/conta" && s.get("tab") === "favoritos",
  },
];

const rightPerfil: LinkItem = {
  kind: "link",
  label: "Perfil",
  icon: UserIcon,
  to: "/conta",
  search: { tab: "perfil" },
  match: (p, s) => p === "/conta" && s.get("tab") === "perfil",
};

function LinkNavItem({ item, path, search }: { item: LinkItem; path: string; search: URLSearchParams }) {
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
  const { count } = useCart();
  const search = new URLSearchParams(searchStr ?? "");

  const insideAdmin = useIsInsideAdminShell();

  // Hide on admin / auth-only routes
  const hiddenPrefixes = ["/rush", "/carrinhos", "/clientes", "/financeiro", "/notificacoes", "/admin", "/auth", "/previsao", "/copiloto", "/ai-growth", "/rastrear", "/avaliacoes", "/precificacao", "/lucratividade", "/modelos", "/entregas", "/pdv", "/garcons", "/impressao", "/biblioteca", "/motoboy"];
  if (insideAdmin || hiddenPrefixes.some((p) => pathname.startsWith(p))) return null;

  const isHome = pathname === "/";
  const isCart = pathname === "/carrinho";

  return (
    <>
      {/* Spacer so content isn't hidden behind the fixed nav */}
      <div aria-hidden className="h-20" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Solid backdrop strip — blocks page content from showing behind the pill */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[calc(100%+2rem)] bg-gradient-to-t from-[oklch(0.10_0.08_300)] via-[oklch(0.10_0.08_300)]/95 to-transparent"
        />
        <div className="relative mx-auto max-w-md px-3 pb-2">
          <div className="relative flex items-end gap-1 rounded-2xl border border-white/10 bg-[#1a0324]/90 px-2 py-1.5 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {leftItems.map((it) => (
              <LinkNavItem key={it.label} item={it} path={pathname} search={search} />
            ))}

            {/* Center highlighted button — Cardápio */}
            <div className="flex flex-1 items-start justify-center">
              <Link to="/" className="-mt-6 flex flex-col items-center gap-0.5">
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

            {/* Carrinho */}
            <Link
              to="/carrinho"
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition",
                isCart ? "text-neon-pink" : "text-white/60 hover:text-white",
              )}
            >
              <span className="relative">
                <ShoppingBag className={cn("h-5 w-5", isCart && "drop-shadow-[0_0_6px_rgba(236,72,153,0.7)]")} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-neon-pink px-1 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(236,72,153,0.7)]">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="leading-tight">Carrinho</span>
            </Link>

            <LinkNavItem item={rightPerfil} path={pathname} search={search} />
          </div>
        </div>
      </nav>
    </>
  );
}
