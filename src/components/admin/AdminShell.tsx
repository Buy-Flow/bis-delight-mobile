import { useEffect, useState } from "react";
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
  ChevronsLeft,
  ChevronsRight,
  ChefHat,
  Store,
  UserCheck,
  Wallet,
  Grid3x3,
  Truck,
  Printer,
  Package,
  Tag,
  BookMarked,
  Layers,
  FileDown,
  Ticket,
  Megaphone,
  MessageCircle,
  Gift,
  Cake,
  BarChart3,
  Star,
  Archive,
  ClipboardCheck,
  Calculator,
  PiggyBank,
  ShieldCheck,
  Settings,
  Zap,
  ShoppingCart,
  BellRing,
  Award,
  Plus,
  Volume2,
  Gauge,
  Route,
  Camera,
  HeartHandshake,
  ScanSearch,
  Mic,
  WifiOff,
  Stethoscope,
  History as HistoryIcon,
  Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { markAdminShellMounted } from "@/lib/admin-shell-flag";
import { usePermissions, labelForRole } from "@/lib/permissions";
import { FloatingAssistant, AssistantTrigger } from "@/components/admin/FloatingAssistant";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { useSoundAlertsListener } from "@/hooks/useSoundAlertsListener";
import { useAdminNotificationsListener } from "@/hooks/useAdminNotificationsListener";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { AdminThemeStyle } from "@/components/admin/AdminThemeStyle";

type AdminTab =
  | "products"
  | "categories"
  | "highlights"
  | "extras"
  | "news"
  | "notifications"
  | "promos"
  | "loyalty"
  | "settings"
  | "announcement"
  | "popup"
  | "coupons";

type NavItem = {
  to?: string;
  tab?: AdminTab;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

type NavGroup = { id: string; label: string; items: NavItem[]; defaultOpen?: boolean };

const groups: NavGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    defaultOpen: true,
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/rush", label: "Cozinha", icon: ChefHat },
      { to: "/pdv", label: "PDV", icon: Store },
      { to: "/mesas", label: "Mesas", icon: Grid3x3 },
      { to: "/entregas", label: "Entregas", icon: Truck },
      { to: "/caixa", label: "Caixa", icon: Wallet },
      { to: "/garcons", label: "Garçons", icon: UserCheck },
      { to: "/impressao", label: "Impressão", icon: Printer },
      { to: "/historico-pedidos", label: "Histórico de pedidos", icon: HistoryIcon },
    ],
  },
  {
    id: "cardapio",
    label: "Cardápio & Estoque",
    defaultOpen: true,
    items: [
      { to: "/admin", tab: "products", label: "Produtos", icon: Package },
      { to: "/admin", tab: "categories", label: "Categorias", icon: Tag },
      { to: "/selos", label: "Selos", icon: Tag },
      { to: "/admin", tab: "extras", label: "Complementos", icon: Plus },
      { to: "/admin", tab: "highlights", label: "Destaques", icon: Star },
      { to: "/admin", tab: "news", label: "Novidades", icon: Sparkles },
      { to: "/admin", tab: "promos", label: "Promos & Combos", icon: Ticket },
      { to: "/admin", tab: "coupons", label: "Cupons", icon: Ticket },
      { to: "/estoque", label: "Estoque", icon: Archive },
      { to: "/ficha-tecnica", label: "Ficha técnica", icon: ClipboardCheck },
      { to: "/precificacao", label: "Precificação", icon: Calculator },
      { to: "/biblioteca", label: "Biblioteca de mídia", icon: BookMarked },
    ],
  },
  {
    id: "clientes",
    label: "Clientes & Fidelidade",
    items: [
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/ranking-vip", label: "Ranking VIP", icon: TrendingUp },
      { to: "/admin", tab: "loyalty", label: "Fidelidade", icon: Award },
      { to: "/avaliacoes", label: "Avaliações", icon: Star },
      { to: "/aniversariantes", label: "Aniversariantes", icon: Cake },
      { to: "/carrinhos", label: "Carrinhos abandonados", icon: ShoppingCart },
      { to: "/indicacoes", label: "Indique um amigo", icon: Gift },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      { to: "/admin", tab: "announcement", label: "Comunicação", icon: Megaphone },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/marketing-winback", label: "Reativação de clientes", icon: HeartHandshake },
    ],
  },
  {
    id: "ia",
    label: "IA & Insights",
    items: [
      { to: "/copiloto", label: "Copiloto (IA)", icon: Bot },
      { to: "/insights-diarios", label: "Insights Proativos", icon: Sparkles },
      { to: "/ai-growth", label: "AI Growth Engine", icon: TrendingUp },
      { to: "/previsao", label: "Previsão de demanda", icon: BarChart3 },
      { to: "/pre-preparo", label: "Pré-preparo IA", icon: ChefHat },
      { to: "/analise-concorrentes", label: "Análise concorrentes", icon: ScanSearch },
      { to: "/whatsapp-ia", label: "IA no WhatsApp", icon: Bot },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { to: "/financeiro", label: "Financeiro", icon: LineChart },
      { to: "/lucratividade", label: "Lucratividade", icon: PiggyBank },
      { to: "/caixa-fechamento", label: "Fechamento de Caixa", icon: FileDown },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    items: [
      { to: "/admin", tab: "settings", label: "Loja", icon: Settings },
      { to: "/usuarios", label: "Usuários e permissões", icon: ShieldCheck },
      { to: "/automacoes", label: "Automações", icon: Zap },
      { to: "/alertas-sonoros", label: "Alertas sonoros", icon: Volume2 },
      { to: "/personalizar-painel", label: "Personalizar painel", icon: Palette },
    ],
  },
  {
    id: "avancado",
    label: "Avançado",
    items: [
      { to: "/sla", label: "SLA de pedidos", icon: Gauge },
      { to: "/rotas", label: "Rotas otimizadas", icon: Route },
      { to: "/prova-entrega", label: "Prova de entrega", icon: Camera },
      { to: "/modelos", label: "Modelos de produto", icon: Layers },
      { to: "/importar", label: "Importar cardápio", icon: FileDown },
      { to: "/whatsapp-diagnostico", label: "Diagnóstico WhatsApp", icon: Stethoscope },
      { to: "/voz-copiloto", label: "Voz no Copiloto", icon: Mic },
      { to: "/skeleton-loading", label: "Skeleton loading", icon: Sparkles },
      { to: "/pwa-offline", label: "PWA & Offline", icon: WifiOff },
    ],
  },
];


function isItemActive(
  it: NavItem,
  pathname: string,
  currentTab: string | undefined,
) {
  if (!it.to) return false;
  if (it.to !== pathname) return false;
  if (it.tab) return currentTab === it.tab;
  // Items on /admin without a tab match only when no tab is set
  if (it.to === "/admin") return !currentTab;
  return true;
}

function SidebarBody({
  collapsed,
  pathname,
  currentTab,
  onNavigate,
  openGroups,
  toggleGroup,
  groups: visibleGroups,
}: {
  collapsed: boolean;
  pathname: string;
  currentTab: string | undefined;
  onNavigate?: () => void;
  openGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  groups: NavGroup[];
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {visibleGroups.map((g) => {
        const isOpen = openGroups[g.id] ?? g.defaultOpen ?? false;
        return (
          <div key={g.id} className="mb-1.5">
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className="flex w-full items-center justify-between px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white/80"
              >
                <span>{g.label}</span>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")}
                />
              </button>
            )}
            {collapsed && <div className="my-2 h-px bg-white/5" />}
            {(collapsed || isOpen) && (
              <ul className="space-y-0.5">
                {g.items.map((it, idx) => {
                  const active = isItemActive(it, pathname, currentTab);
                  const Icon = it.icon;
                  const label = (
                    <>
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-neon-yellow" : "text-white/70",
                        )}
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate">{it.label}</span>
                      )}
                      {!collapsed && it.soon && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/45">
                          em breve
                        </span>
                      )}
                    </>
                  );
                  const base = cn(
                    "flex items-center gap-2.5 rounded-lg text-sm transition",
                    collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                    active
                      ? "bg-gradient-to-r from-neon-pink/25 to-neon-pink/5 text-white shadow-inner"
                      : "text-white/80 hover:bg-white/5 hover:text-white",
                  );
                  if (it.soon || !it.to) {
                    return (
                      <li key={`${g.id}-${idx}`}>
                        <div
                          title={collapsed ? it.label : undefined}
                          className={cn(base, "cursor-not-allowed opacity-50")}
                        >
                          {label}
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={`${g.id}-${idx}`}>
                      <Link
                        to={it.to}
                        search={it.tab ? ({ tab: it.tab } as never) : undefined}
                        onClick={onNavigate}
                        title={collapsed ? it.label : undefined}
                        className={base}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const searchTab = useRouterState({
    select: (r) => {
      const s = r.location.search as Record<string, unknown> | undefined;
      const v = s?.tab;
      return typeof v === "string" ? v : undefined;
    },
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("qb-admin-sidebar-collapsed") === "1";
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? false])),
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "qb-admin-sidebar-collapsed",
        collapsed ? "1" : "0",
      );
    }
  }, [collapsed]);

  // Auto-open groups containing the active route/tab
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.items.some((it) => isItemActive(it, pathname, searchTab))) {
          next[g.id] = true;
        }
      }
      return next;
    });
  }, [pathname, searchTab]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Signal to global BottomNav to hide while any AdminShell is mounted.
  useEffect(() => {
    return markAdminShellMounted();
  }, []);

  // Mount the global sound-alerts listener (differentiated per event).
  useSoundAlertsListener();
  useAdminNotificationsListener();

  const toggleGroup = (id: string) =>
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  // Filtra grupos/itens conforme papel do usuário.
  const { canAccess, isAdmin: _isAdminRole, roles: _roles } = usePermissions();
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (!it.to) return _isAdminRole; // itens sem rota são só de admin
        // Itens que apontam a /admin com tab: só admin pode (edição real).
        if (it.to === "/admin") return _isAdminRole;
        return canAccess(it.to);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const sidebarWidth = collapsed ? "md:w-[68px]" : "md:w-[248px]";

  return (
    <div data-scope="admin" className="min-h-screen bg-background text-white">
      <AdminThemeStyle />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/10 bg-card md:flex",
          sidebarWidth,
          "transition-[width] duration-200",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b border-white/10",
            collapsed ? "justify-center" : "gap-2 px-4",
          )}
        >
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-neon-yellow to-amber-400 text-black">
            <Flame className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
                Painel
              </div>
              <div className="text-sm font-black">Quero Bis</div>
            </div>
          )}
        </div>
        <SidebarBody
          collapsed={collapsed}
          pathname={pathname}
          currentTab={searchTab}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
          groups={visibleGroups}
        />
        <div className="border-t border-white/10 p-2">
          <Link
            to="/"
            title={collapsed ? "Ir para o site" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg text-sm text-white/80 transition hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
            )}
          >
            <Home className="h-4 w-4 text-neon-yellow" />
            {!collapsed && <span>Ir para o site</span>}
          </Link>
          <button
            type="button"
            onClick={signOut}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg text-sm text-red-300 transition hover:bg-red-500/10",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
          <div className="mt-2 border-t border-white/5 pt-2">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white/50 hover:bg-white/5 hover:text-white/80",
                collapsed && "justify-center px-2",
              )}
            >
              {collapsed ? (
                <ChevronsRight className="h-3.5 w-3.5" />
              ) : (
                <>
                  <ChevronsLeft className="h-3.5 w-3.5" />
                  <span>Recolher</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col border-r border-white/10 bg-card shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-neon-yellow to-amber-400 text-black">
                  <Flame className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
                    Painel
                  </div>
                  <div className="text-sm font-black">Quero Bis</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarBody
              collapsed={false}
              pathname={pathname}
              currentTab={searchTab}
              onNavigate={() => setMobileOpen(false)}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              groups={visibleGroups}
            />
            <div className="border-t border-white/10 p-2">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
              >
                <Home className="h-4 w-4 text-neon-yellow" />
                <span>Ir para o site</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "md:pl-[68px]" : "md:pl-[248px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/10 bg-background/80 px-3 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-neon-yellow" />
            <span className="text-sm font-bold">Quero Bis</span>
            <span className="hidden text-xs text-white/40 sm:inline">
              · {_isAdminRole ? "Painel administrativo" : "Painel da equipe"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AssistantTrigger />
            <NotificationCenter />

            {(() => {
              const primary =
                (["admin", "manager", "staff", "kitchen"] as const).find((r) =>
                  _roles.includes(r),
                ) ?? null;
              if (!primary) return null;
              return (
                <span
                  className={cn(
                    "hidden rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex",
                    primary === "admin"
                      ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
                      : primary === "manager"
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                      : primary === "staff"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-white/20 bg-white/5 text-white/70",
                  )}
                >
                  {labelForRole(primary)}
                </span>
              );
            })()}
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] 2xl:max-w-[1760px]">
            {children}
          </div>
        </main>
      </div>
      <FloatingAssistant />
      <CommandPalette />
    </div>
  );
}
