import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  X,
  LayoutDashboard,
  LineChart,
  Users,
  Home,
  LogOut,
  Flame,
  Sparkles,
  TrendingUp,
  Bot,
  ChevronDown,
  ClipboardList,
  ChefHat,
  Store,
  UserCheck,
  Wallet,
  Grid3x3,
  Truck,
  Printer,
  BookOpen,
  Package,
  Tag,
  BookMarked,
  Layers,
  FileDown,
  Ticket,
  Megaphone,
  Handshake,
  MessageCircle,
  Share2,
  BarChart3,
  Star,
  Archive,
  ClipboardCheck,
  Calculator,
  PiggyBank,
  ShieldCheck,
  CreditCard,
  Settings,
  Zap,
  LifeBuoy,
  Search,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = {
  to?: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/rush", label: "Pedidos ao vivo", icon: Flame },
      { to: "/rush", label: "Cozinha", icon: ChefHat },
      { label: "PDV", icon: Store, soon: true },
      { label: "Garçons", icon: UserCheck, soon: true },
      { label: "Caixa", icon: Wallet, soon: true },
      { label: "Mesas", icon: Grid3x3, soon: true },
      { label: "Entregas", icon: Truck, soon: true },
      { label: "Impressão", icon: Printer, soon: true },
    ],
  },
  {
    id: "cardapio",
    label: "Cardápio",
    items: [
      { to: "/admin", label: "Categorias", icon: Tag },
      { to: "/admin", label: "Produtos", icon: Package },
      { label: "Modelos", icon: Layers, soon: true },
      { label: "Biblioteca", icon: BookMarked, soon: true },
      { label: "Importar cardápio", icon: FileDown, soon: true },
    ],
  },
  {
    id: "crescimento",
    label: "Crescimento",
    items: [
      { to: "/admin", label: "Promoções", icon: Ticket },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/notificacoes", label: "Marketing / Push", icon: Megaphone },
      { to: "/ai-growth", label: "AI Growth Engine", icon: TrendingUp },
      { to: "/copiloto", label: "Copiloto (IA)", icon: Bot },
      { label: "Parceiros", icon: Handshake, soon: true },
      { label: "WhatsApp", icon: MessageCircle, soon: true },
      { label: "Afiliados", icon: Share2, soon: true },
      { to: "/carrinhos", label: "Carrinhos abandonados", icon: ShoppingCart },
      { to: "/previsao", label: "Previsão de demanda", icon: Sparkles },
      { to: "/financeiro", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    items: [
      { to: "/financeiro", label: "Financeiro", icon: LineChart },
      { label: "Avaliações", icon: Star, soon: true },
      { label: "Estoque", icon: Archive, soon: true },
      { label: "Ficha técnica", icon: ClipboardCheck, soon: true },
      { label: "Precificação", icon: Calculator, soon: true },
      { label: "Lucratividade", icon: PiggyBank, soon: true },
      { label: "Usuários e permissões", icon: ShieldCheck, soon: true },
    ],
  },
  {
    id: "conta",
    label: "Conta",
    items: [
      { label: "Meu plano", icon: CreditCard, soon: true },
      { to: "/admin", label: "Configurações", icon: Settings },
      { label: "Automações", icon: Zap, soon: true },
      { label: "Suporte", icon: LifeBuoy, soon: true },
      { label: "Diagnóstico upload", icon: ClipboardList, soon: true },
    ],
  },
];

export function AdminNavMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // active label for the trigger
  const activeLabel = (() => {
    for (const g of groups) {
      const found = g.items.find((it) => it.to === pathname);
      if (found) return found.label;
    }
    return "Painel";
  })();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      items: q ? g.items.filter((it) => it.label.toLowerCase().includes(q)) : g.items,
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-purple-800/60"
      >
        <Menu className="h-4 w-4" />
        <span className="max-w-[10rem] truncate">{activeLabel}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]" ref={ref}>
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[320px] max-w-[85vw] flex-col border-r border-purple-500/25 bg-[oklch(0.11_0.08_300)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-neon-yellow to-amber-400 text-black">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
                    Painel
                  </div>
                  <div className="text-sm font-black text-white">Quero Bis</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-white/10 px-3 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar no painel…"
                  className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-white/40 focus:border-neon-yellow/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Groups */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {filtered.map((g) => {
                const isCollapsed = collapsed[g.id];
                return (
                  <div key={g.id} className="mb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                      }
                      className="flex w-full items-center justify-between px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80"
                    >
                      <span>{g.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isCollapsed && "-rotate-90",
                        )}
                      />
                    </button>
                    {!isCollapsed && (
                      <ul className="space-y-0.5">
                        {g.items.map((it, idx) => {
                          const active = it.to === pathname;
                          const Icon = it.icon;
                          const inner = (
                            <>
                              <Icon className="h-4 w-4 shrink-0 text-neon-yellow" />
                              <span className="flex-1 truncate">{it.label}</span>
                              {it.soon && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50">
                                  em breve
                                </span>
                              )}
                              {active && (
                                <span className="h-1.5 w-1.5 rounded-full bg-neon-pink" />
                              )}
                            </>
                          );
                          if (it.soon || !it.to) {
                            return (
                              <li key={`${g.id}-${idx}`}>
                                <div className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40">
                                  {inner}
                                </div>
                              </li>
                            );
                          }
                          return (
                            <li key={`${g.id}-${idx}`}>
                              <Link
                                to={it.to}
                                onClick={() => setOpen(false)}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                                  active
                                    ? "bg-neon-pink/20 text-white"
                                    : "text-white/80 hover:bg-white/5 hover:text-white",
                                )}
                              >
                                {inner}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-white/50">
                  Nenhum item encontrado.
                </div>
              )}
            </nav>

            {/* Footer */}
            <div className="border-t border-white/10 p-2">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
              >
                <Home className="h-4 w-4 text-neon-yellow" />
                <span>Ir para o site</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
