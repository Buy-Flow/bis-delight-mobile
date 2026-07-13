import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  Search,
  Package,
  Users,
  ShoppingCart,
  Truck,
  ChefHat,
  Store,
  Wallet,
  Grid3x3,
  Star,
  Archive,
  BarChart3,
  Bot,
  Settings,
  MessageCircle,
  BellRing,
  Tag,
  LineChart,
  Home,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type NavCommand = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
};

type SearchResult = {
  id: string;
  kind: "order" | "customer" | "product";
  label: string;
  hint: string;
  action: () => void;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  const navCommands: NavCommand[] = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard", icon: Home, action: () => navigate({ to: "/admin" }) },
      { id: "rush", label: "Cozinha (Rush)", icon: ChefHat, action: () => navigate({ to: "/rush" }) },
      { id: "pdv", label: "PDV", icon: Store, action: () => navigate({ to: "/pdv" }) },
      { id: "caixa", label: "Caixa", icon: Wallet, action: () => navigate({ to: "/caixa" }) },
      { id: "mesas", label: "Mesas", icon: Grid3x3, action: () => navigate({ to: "/mesas" }) },
      { id: "entregas", label: "Entregas", icon: Truck, action: () => navigate({ to: "/entregas" }) },
      { id: "clientes", label: "Clientes", icon: Users, action: () => navigate({ to: "/clientes" }) },
      { id: "produtos", label: "Produtos", icon: Package, action: () => navigate({ to: "/admin", search: { tab: "products" } as never }) },
      { id: "categorias", label: "Categorias", icon: Tag, action: () => navigate({ to: "/admin", search: { tab: "categories" } as never }) },
      { id: "estoque", label: "Estoque", icon: Archive, action: () => navigate({ to: "/estoque" }) },
      { id: "carrinhos", label: "Carrinhos abandonados", icon: ShoppingCart, action: () => navigate({ to: "/carrinhos" }) },
      { id: "avaliacoes", label: "Avaliações", icon: Star, action: () => navigate({ to: "/avaliacoes" }) },
      { id: "notif", label: "Notificações push", icon: BellRing, action: () => navigate({ to: "/admin", search: { tab: "notifications" } as never }) },
      { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, action: () => navigate({ to: "/whatsapp" }) },
      { id: "financeiro", label: "Financeiro", icon: LineChart, action: () => navigate({ to: "/financeiro" }) },
      { id: "previsao", label: "Previsão de demanda", icon: BarChart3, action: () => navigate({ to: "/previsao" }) },
      { id: "copiloto", label: "Copiloto (IA)", icon: Bot, action: () => navigate({ to: "/copiloto" }) },
      { id: "usuarios", label: "Usuários e permissões", icon: ShieldCheck, action: () => navigate({ to: "/usuarios" }) },
      { id: "config", label: "Configurações da loja", icon: Settings, action: () => navigate({ to: "/admin", search: { tab: "settings" } as never }) },
    ],
    [navigate],
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const digits = term.replace(/\D/g, "");
        const isNumeric = digits.length >= 4;
        const [ordersRes, profilesRes, productsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, customer_name, phone, total, status, created_at")
            .or(
              [
                `customer_name.ilike.%${term}%`,
                isNumeric ? `phone.ilike.%${digits}%` : "",
              ]
                .filter(Boolean)
                .join(","),
            )
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("profiles")
            .select("id, full_name, phone, cpf")
            .or(
              [
                `full_name.ilike.%${term}%`,
                isNumeric ? `phone.ilike.%${digits}%` : "",
                isNumeric ? `cpf.ilike.%${digits}%` : "",
              ]
                .filter(Boolean)
                .join(","),
            )
            .limit(6),
          supabase
            .from("products")
            .select("id, name, price, active")
            .ilike("name", `%${term}%`)
            .limit(6),
        ]);

        const out: SearchResult[] = [];
        (ordersRes.data ?? []).forEach((o: Record<string, unknown>) => {
          out.push({
            id: `order-${o.id}`,
            kind: "order",
            label: `#${String(o.id).slice(0, 6)} · ${(o.customer_name as string) ?? "sem nome"}`,
            hint: `R$ ${Number(o.total ?? 0).toFixed(2)} · ${String(o.status ?? "")}`,
            action: () => navigate({ to: "/rush" }),
          });
        });
        (profilesRes.data ?? []).forEach((p: Record<string, unknown>) => {
          out.push({
            id: `customer-${p.id}`,
            kind: "customer",
            label: (p.full_name as string) || "Sem nome",
            hint: (p.phone as string) || (p.cpf as string) || "cliente",
            action: () => navigate({ to: "/clientes" }),
          });
        });
        (productsRes.data ?? []).forEach((p: Record<string, unknown>) => {
          out.push({
            id: `product-${p.id}`,
            kind: "product",
            label: p.name as string,
            hint: `R$ ${Number(p.price ?? 0).toFixed(2)}${p.active ? "" : " · inativo"}`,
            action: () => navigate({ to: "/admin", search: { tab: "products" } as never }),
          });
        });
        setResults(out);
      } catch (err) {
        console.error("[cmdk] search failed", err);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, navigate]);

  if (!open) return null;

  const filteredNav =
    q.trim().length < 2
      ? navCommands
      : navCommands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-4 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#170a2e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Busca global" shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-white/10 px-4">
            <Search className="h-4 w-4 text-white/50" />
            <Command.Input
              value={q}
              onValueChange={setQ}
              autoFocus
              placeholder="Buscar pedido, cliente, produto ou seção..."
              className="flex-1 border-0 bg-transparent py-4 text-sm text-white outline-none placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
            <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-white/50 sm:inline-block">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-xs text-white/40">
              {loading ? "Buscando..." : q.length < 2 ? "Digite pelo menos 2 caracteres" : "Nenhum resultado"}
            </Command.Empty>

            {results.length > 0 && (
              <Command.Group heading="Resultados" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-white/40">
                {results.map((r) => {
                  const Icon = r.kind === "order" ? ShoppingCart : r.kind === "customer" ? Users : Package;
                  return (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => {
                        r.action();
                        setOpen(false);
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 aria-selected:bg-white/10 aria-selected:text-white"
                    >
                      <Icon className="h-4 w-4 text-neon-yellow" />
                      <div className="flex-1 truncate">
                        <div className="truncate font-semibold">{r.label}</div>
                        <div className="truncate text-[11px] text-white/50">{r.hint}</div>
                      </div>
                      <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/50">
                        {r.kind === "order" ? "Pedido" : r.kind === "customer" ? "Cliente" : "Produto"}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            <Command.Group heading="Navegar" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-white/40">
              {filteredNav.map((c) => {
                const Icon = c.icon;
                return (
                  <Command.Item
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      c.action();
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 aria-selected:bg-white/10 aria-selected:text-white"
                  >
                    <Icon className="h-4 w-4 text-white/70" />
                    <span className="flex-1">{c.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-2 text-[10px] text-white/40">
            <span>
              <kbd className="rounded border border-white/10 bg-white/10 px-1 py-0.5 text-white/70">↑↓</kbd> navegar ·{" "}
              <kbd className="rounded border border-white/10 bg-white/10 px-1 py-0.5 text-white/70">↵</kbd> abrir
            </span>
            <span>
              <kbd className="rounded border border-white/10 bg-white/10 px-1 py-0.5 text-white/70">⌘K</kbd> atalho
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
