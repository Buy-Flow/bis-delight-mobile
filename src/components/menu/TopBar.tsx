import { Menu, Award, Heart, Home, ShoppingBag, User as UserIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BRAND } from "@/data/menu";
import { useSiteSettings } from "@/lib/menu-data";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "./NotificationsBell";

type DeskItem = {
  label: string;
  icon: typeof Home;
  to: string;
  search?: Record<string, string>;
  match: (path: string, search: URLSearchParams) => boolean;
};

const DESK_ITEMS: DeskItem[] = [
  { label: "Cardápio", icon: Home, to: "/", match: (p) => p === "/" },
  { label: "Recompensas", icon: Award, to: "/recompensas", match: (p) => p.startsWith("/recompensas") },
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

export function TopBar({ onOpenCategories }: { onOpenCategories?: () => void }) {
  const { data: settings } = useSiteSettings();
  const logo = settings?.logo || BRAND.logo;
  const name = settings?.name || BRAND.name;
  const { count } = useCart();
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  });
  const search = new URLSearchParams(searchStr ?? "");
  const isCart = pathname === "/carrinho";

  return (
    <header
      className="sticky top-0 z-40 bg-transparent"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className="relative flex items-center justify-between py-3 md:gap-6"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {/* Mobile categories button */}
        <button
          onClick={onOpenCategories}
          aria-label="Categorias"
          className="grid h-11 w-11 place-items-center rounded-2xl bg-neon-pink text-white glow-pink active:scale-95 transition md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 md:shrink-0">
          <img
            src={logo}
            alt={`${name} — Sorveteria e Açaí`}
            width={200}
            height={80}
            decoding="async"
            fetchPriority="high"
            className="h-20 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          />
        </div>

        {/* Desktop nav — hidden on mobile (BottomNav takes over there) */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-1 lg:gap-2">
          {DESK_ITEMS.map((it) => {
            const active = it.match(pathname, search);
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                to={it.to}
                search={it.search as never}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 lg:px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-white/10 text-neon-pink shadow-[0_0_20px_-6px_rgba(236,72,153,0.6)]"
                    : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:shrink-0">
          {/* Cart link — visible on desktop only; mobile users have BottomNav */}
          <Link
            to="/carrinho"
            aria-label="Carrinho"
            className={cn(
              "relative hidden md:inline-flex items-center gap-2 rounded-full px-3 lg:px-4 py-2 text-sm font-semibold transition",
              isCart
                ? "bg-neon-pink text-white shadow-[0_10px_28px_-6px_rgba(236,72,153,0.55)]"
                : "bg-white/10 text-white hover:bg-white/15",
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Carrinho</span>
            {count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-black text-neon-pink">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
