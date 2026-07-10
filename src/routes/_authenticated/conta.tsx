import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useSearch, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  User as UserIcon,
  ClipboardList,
  Heart,
  Award,
  ChevronRight,
  RotateCcw,
  Copy,
  Loader2,
  LogOut,
  Sparkles,
  Bell,
  Shield,
  Check,
  CreditCard,
  ChefHat,
  Bike,
  PackageCheck,
  MapPin,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/use-auth";
import { useCart, brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { NotificationsInbox } from "@/components/menu/NotificationsInbox";
import { useIsAdmin, useProducts } from "@/lib/menu-data";
import { ProductModal } from "@/components/menu/ProductModal";
import type { Product } from "@/data/menu";
import { Heart as HeartIcon } from "lucide-react";
import { ProductCard } from "@/components/menu/ProductCard";
import {
  OrdersListSkeleton,
  FavoritesGridSkeleton,
  ProfilePanelSkeleton,
  LoyaltyPanelSkeleton,
} from "@/components/ui/skeletons";



const searchSchema = z.object({
  tab: z.enum(["perfil", "pedidos", "favoritos", "fidelidade", "notificacoes"]).optional(),
});


export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AccountPage,
});

type Tab = "perfil" | "pedidos" | "favoritos" | "fidelidade" | "notificacoes";

function AccountPage() {
  const search = useSearch({ from: "/_authenticated/conta" });
  const navigate = useNavigate();
  const tab: Tab = search.tab ?? "perfil";

  const { user } = useAuth();

  const headers: Record<Tab, { kicker: string; word1: string; word2: string }> = {
    perfil: { kicker: "Conta", word1: "Meu", word2: "perfil" },
    pedidos: { kicker: "Histórico", word1: "Meus", word2: "pedidos" },
    favoritos: { kicker: "Coleção", word1: "Meus", word2: "favoritos" },
    fidelidade: { kicker: "Programa", word1: "Bis", word2: "Recompensa" },
    notificacoes: { kicker: "Central", word1: "Suas", word2: "novidades" },
  };
  const icons: Record<Tab, typeof UserIcon> = {
    fidelidade: Award,
    pedidos: ClipboardList,
    favoritos: Heart,
    perfil: UserIcon,
    notificacoes: Bell,
  };
  const HeaderIcon = icons[tab];
  const H = headers[tab];

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, oklch(0.42 0.22 320) 0%, oklch(0.20 0.16 305) 45%, oklch(0.08 0.06 300) 100%)",
      }}
    >
      {/* Cart-style sticky header */}
      <div className="sticky top-0 z-20 bg-gradient-to-b from-[oklch(0.20_0.16_305)] via-[oklch(0.20_0.16_305)]/80 to-transparent pb-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/25 to-neon-purple/25 ring-1 ring-white/15">
            <HeaderIcon className="h-5 w-5 text-neon-yellow" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-yellow shadow-[0_0_8px_theme(colors.neon-yellow)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-yellow/90">
                {H.kicker}
              </span>
            </div>
            <h1 className="text-[20px] font-black leading-tight text-white">
              {H.word1}{" "}
              <span className="bg-gradient-to-r from-neon-pink to-neon-yellow bg-clip-text text-transparent">
                {H.word2}
              </span>
            </h1>
          </div>
          {tab === "perfil" && (
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              aria-label="Sair"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-white/50 ring-1 ring-white/10 transition hover:bg-red-500/10 hover:text-red-300 active:scale-95"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>

      <div className="mx-auto max-w-md px-4 pb-24 pt-5">
        {tab === "fidelidade" && <LoyaltyPanel />}
        {tab === "pedidos" && <OrdersPanel />}
        {tab === "favoritos" && <FavoritesPanel />}
        {tab === "perfil" && <ProfilePanel />}
        {tab === "notificacoes" && <NotificationsInbox />}
      </div>

    </div>
  );
}




/* ============= FIDELIDADE ============= */

function LoyaltyPanel() {
  const { user } = useAuth();
  const [stamps, setStamps] = useState(0);
  const [totalRedeemed, setTotalRedeemed] = useState(0);
  const [coupons, setCoupons] = useState<Array<{ id: string; code: string; used_at: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("loyalty").select("stamps, total_redeemed").eq("user_id", user.id).maybeSingle(),
      supabase.from("loyalty_coupons").select("id, code, used_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([l, c]) => {
      setStamps(l.data?.stamps ?? 0);
      setTotalRedeemed(l.data?.total_redeemed ?? 0);
      setCoupons(c.data ?? []);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <LoyaltyPanelSkeleton />;

  const active = coupons.filter((c) => !c.used_at);
  const progress = (stamps % 10) / 10;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-neon-yellow/40 bg-gradient-to-br from-neon-pink/30 via-purple-800/30 to-neon-cyan/20 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-neon-yellow" />
          <div className="font-display text-lg font-black uppercase tracking-wide text-white">
            Bis Recompensa
          </div>
        </div>
        <div className="mt-1 text-[11px] text-white/70">
          A cada pedido acima de R$ 20 você ganha 1 selo 🍧. Complete 10 e ganhe R$ 20 de desconto!
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/50">Você tem</div>
            <div className="font-display text-5xl font-black text-neon-yellow glow-yellow-text">{stamps}</div>
            <div className="text-xs text-white/60">/ 10 selos</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Já resgatou</div>
            <div className="font-display text-2xl font-black text-white">{totalRedeemed} 🎁</div>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-yellow to-neon-pink transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "grid aspect-square place-items-center rounded-full text-[10px] font-black transition",
                i < stamps % 10
                  ? "bg-neon-yellow text-[oklch(0.18_0.11_305)] shadow-[0_0_10px_oklch(0.85_0.20_100/0.6)]"
                  : "border border-white/20 bg-white/5 text-white/30",
              )}
            >
              {i < stamps % 10 ? "🍧" : i + 1}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Seus cupons</div>
          <div className="text-[11px] text-white/40">{active.length} disponível{active.length === 1 ? "" : "s"}</div>
        </div>
        {coupons.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Nenhum cupom ainda. Continue pedindo para acumular selos!
          </div>
        )}
        <div className="space-y-2">
          {coupons.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-2xl border p-3",
                c.used_at ? "border-white/10 bg-white/5 opacity-60" : "border-neon-yellow/40 bg-neon-yellow/10",
              )}
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-white/50">
                  {c.used_at ? "Usado" : "R$ 20 de desconto"}
                </div>
                <div className="font-mono text-sm font-bold text-white">{c.code}</div>
              </div>
              {!c.used_at && (
                <button
                  onClick={async () => {
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(c.code);
                      } else {
                        const ta = document.createElement("textarea");
                        ta.value = c.code;
                        ta.style.position = "fixed";
                        ta.style.opacity = "0";
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        document.body.removeChild(ta);
                      }
                      toast.success(`Código ${c.code} copiado!`);
                    } catch {
                      toast.error("Não foi possível copiar. Código: " + c.code);
                    }
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-neon-yellow text-[oklch(0.18_0.11_305)] transition active:scale-90"
                  aria-label="Copiar código"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============= PEDIDOS ============= */

type OrderRow = {
  id: string;
  created_at: string;
  total: number;
  mode: string;
  status: string;
  items: Array<{ name: string; quantity: number; size: string | null; flavor: string | null; extras: unknown; unit_price: number; product_id: string | null }>;
};

function OrdersPanel() {
  const { user } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      supabase
        .from("orders")
        .select("id, created_at, total, mode, status, order_items(name, quantity, size, flavor, extras, unit_price, product_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data }) => {
          setOrders(
            (data ?? []).map((o: any) => ({ ...o, items: o.order_items ?? [] })),
          );
          setLoading(false);
        });
    };
    load();
    const channel = supabase
      .channel(`orders-user-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);


  const reorder = (o: OrderRow) => {
    o.items.forEach((it: any) => {
      add({
        productId: it.product_id ?? "reorder",
        name: it.name,
        image: "",
        size: it.size ?? undefined,
        flavor: it.flavor ?? undefined,
        extras: Array.isArray(it.extras) ? it.extras : [],
        removed: [],
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
      });
    });
    toast.success("Itens adicionados ao carrinho!");
    navigate({ to: "/carrinho" });
  };

  if (loading) return <PanelSpinner />;
  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
        Você ainda não fez pedidos.<br />
        <Link to="/" className="mt-2 inline-block text-neon-cyan hover:underline">
          Ver o cardápio
        </Link>
      </div>
    );

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="text-lg font-black text-neon-yellow">{brl(Number(o.total))}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={o.status} />
              <div className="text-[10px] text-white/50">{o.mode === "entrega" ? "Entrega" : "Retirada"}</div>
            </div>
          </div>
          <OrderTracker status={o.status} mode={o.mode} />
          <div className="mt-3 space-y-0.5 text-xs text-white/70">
            {o.items.slice(0, 3).map((it: any, i: number) => (
              <div key={i} className="truncate">
                {it.quantity}× {it.name}
                {it.size ? ` · ${it.size}` : ""}
              </div>
            ))}
            {o.items.length > 3 && <div className="text-white/40">+ {o.items.length - 3} outros</div>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/rastrear/$orderId"
              params={{ orderId: o.id }}
              className="flex items-center justify-center gap-1 rounded-xl bg-neon-cyan/20 py-2 text-xs font-bold text-neon-cyan"
            >
              <MapPin className="h-3.5 w-3.5" /> Rastrear
            </Link>
            <button
              onClick={() => reorder(o)}
              className="flex items-center justify-center gap-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Pedir de novo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    novo: "bg-neon-cyan/20 text-neon-cyan",
    pendente: "bg-neon-yellow/20 text-neon-yellow",
    pago: "bg-emerald-500/20 text-emerald-300",
    preparando: "bg-neon-yellow/20 text-neon-yellow",
    saiu_para_entrega: "bg-neon-pink/20 text-neon-pink",
    entregue: "bg-green-500/20 text-green-400",
    cancelado: "bg-red-500/20 text-red-400",
  };
  const labels: Record<string, string> = {
    novo: "Novo",
    pendente: "Pendente",
    pago: "Pago",
    preparando: "Preparando",
    saiu_para_entrega: "Saiu para entrega",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", styles[status] || "bg-white/10 text-white/60")}>
      {labels[status] || status}
    </span>
  );
}

function OrderTracker({ status, mode }: { status: string; mode: string }) {
  if (status === "cancelado") {
    return (
      <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-red-300">
        Pedido cancelado
      </div>
    );
  }

  const isDelivery = mode === "entrega";
  const steps = isDelivery
    ? [
        { key: "pago", label: "Confirmado", icon: CreditCard },
        { key: "preparando", label: "Preparando", icon: ChefHat },
        { key: "saiu_para_entrega", label: "A caminho", icon: Bike },
        { key: "entregue", label: "Entregue", icon: PackageCheck },
      ]
    : [
        { key: "pago", label: "Confirmado", icon: CreditCard },
        { key: "preparando", label: "Preparando", icon: ChefHat },
        { key: "entregue", label: "Pronto", icon: PackageCheck },
      ];

  // rank map: any status >= this index is considered done
  const rankMap: Record<string, number> = {
    novo: 0,
    pendente: 0,
    pago: 0,
    preparando: 1,
    saiu_para_entrega: 2,
    entregue: steps.length - 1,
  };
  const currentIdx = rankMap[status] ?? 0;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Acompanhe seu pedido
        </div>
        <div className="flex items-center gap-1 text-[10px] text-neon-cyan">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-cyan opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-cyan" />
          </span>
          Ao vivo
        </div>
      </div>
      <div className="relative flex items-start justify-between">
        {/* progress line */}
        <div className="absolute left-4 right-4 top-3.5 h-0.5 bg-white/10" />
        <div
          className="absolute left-4 top-3.5 h-0.5 bg-gradient-to-r from-neon-pink to-neon-yellow transition-all duration-700"
          style={{
            width: `calc(${(currentIdx / Math.max(1, steps.length - 1)) * 100}% - ${currentIdx === steps.length - 1 ? "0px" : "0px"})`,
            maxWidth: "calc(100% - 2rem)",
          }}
        />
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="relative z-10 flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition-all",
                  done && "border-neon-pink bg-neon-pink text-black",
                  active &&
                    "border-neon-yellow bg-neon-yellow/20 text-neon-yellow shadow-[0_0_12px_rgba(255,214,10,0.6)] animate-pulse",
                  !done && !active && "border-white/15 bg-black/40 text-white/40",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div
                className={cn(
                  "text-center text-[9px] font-bold uppercase leading-tight tracking-wide",
                  (done || active) ? "text-white" : "text-white/40",
                )}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

}

/* ============= FAVORITOS ============= */

function FavoritesPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: allProducts = [] } = useProducts();
  const [favIds, setFavIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    if (!user) {
      setFavIds([]);
      return;
    }
    let cancel = false;
    supabase
      .from("favorites")
      .select("product_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancel) return;
        setFavIds((data ?? []).map((r: any) => r.product_id as string));
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  const productsById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of allProducts) m.set(p.id, p);
    return m;
  }, [allProducts]);

  const favs: Product[] = useMemo(() => {
    if (!favIds) return [];
    return favIds.map((id) => productsById.get(id)).filter(Boolean) as Product[];
  }, [favIds, productsById]);

  // Removal is handled inside ProductCard's FavoriteButton (heart toggle).


  if (favIds === null) return <PanelSpinner />;

  return (
    <div className="relative">
      {favs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-neon-pink/15 text-neon-pink">
            <HeartIcon className="h-6 w-6" />
          </div>
          <div className="text-sm font-bold text-white">Nenhum favorito ainda</div>
          <div className="mt-1 text-xs text-white/50">Toque no coração dos produtos que você ama e eles aparecem aqui.</div>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-4 rounded-full bg-neon-pink px-5 py-2 text-xs font-black text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] active:scale-95"
          >
            Explorar cardápio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favs.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={setSelected} />
          ))}
        </div>
      )}

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}



/* ============= PERFIL ============= */

function ProfilePanel() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [birthday, setBirthday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, phone, address, reference, birthday")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? "");
          setPhone(data.phone ?? "");
          setAddress(data.address ?? "");
          setReference(data.reference ?? "");
          setBirthday(data.birthday ?? "");
        }
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      reference: reference.trim() || null,
      birthday: birthday || null,
    });
    setSaving(false);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Perfil atualizado!");
  };

  if (loading) return <PanelSpinner />;

  const displayName = fullName.trim() || user?.email?.split("@")[0] || "Cliente";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neon-pink/15 via-white/5 to-neon-cyan/10 p-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-neon-pink/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-neon-cyan/15 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink to-neon-yellow text-lg font-black text-black shadow-[0_0_20px_rgba(255,60,172,0.35)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-base font-black text-white">{displayName}</div>
              {isAdmin && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-cyan">
                  <Shield className="h-2.5 w-2.5" /> Admin
                </span>
              )}
            </div>
            <div className="truncate text-xs text-white/60">{user?.email}</div>
            {phone && (
              <div className="mt-0.5 truncate text-[11px] text-white/50">{phone}</div>
            )}
          </div>
        </div>
      </div>


      {isAdmin && (
        <Link
          to="/admin"
          className="group flex items-center gap-3 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 p-3 transition hover:border-neon-cyan/70 hover:bg-neon-cyan/15"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-neon-cyan/20 text-neon-cyan ring-1 ring-neon-cyan/40">
            <Shield className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">Painel administrador</div>
            <div className="text-[11px] text-white/60">Pedidos, cardápio, clientes e mais</div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      )}

      <Link
        to="/conta"
        search={{ tab: "pedidos" } as never}
        className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-neon-pink/40 hover:bg-white/10"
      >
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-neon-pink/15 text-neon-pink ring-1 ring-neon-pink/30">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Meus pedidos</div>
          <div className="text-[11px] text-white/60">Ver histórico e acompanhar entregas</div>
        </div>
        <ChevronRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </Link>

      <DadosPessoaisCard>
        <Input label="Nome completo" value={fullName} onChange={setFullName} autoComplete="name" />
        <Input label="Telefone (WhatsApp)" value={phone} onChange={setPhone} autoComplete="tel" type="tel" />
        <Input label="Endereço padrão" value={address} onChange={setAddress} autoComplete="street-address" />
        <Input label="Ponto de referência" value={reference} onChange={setReference} />
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-white/80">
            Data de aniversário <span className="text-white/40">(ganha 1 selo bônus no mês 🎂)</span>
          </label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-neon-cyan"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink active:scale-[.98] disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar perfil
        </button>
      </DadosPessoaisCard>
    </div>
  );
}


function Input({
  label,
  value,
  onChange,
  autoComplete,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-white/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        type={type}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
      />
    </label>
  );
}

function DadosPessoaisCard({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/[0.06]"
        aria-expanded={open}
      >
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-neon-yellow/15 text-neon-yellow ring-1 ring-neon-yellow/30">
          <UserIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Dados pessoais</div>
          <div className="text-[11px] text-white/60">Nome, contato, endereço e aniversário</div>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-white/40 transition",
            open ? "rotate-90 text-white" : "group-hover:translate-x-0.5 group-hover:text-white",
          )}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/10 bg-black/10 p-3">{children}</div>
      )}
    </div>
  );
}

function PanelSpinner() {
  return (
    <div className="flex items-center justify-center py-12 text-white/50">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
