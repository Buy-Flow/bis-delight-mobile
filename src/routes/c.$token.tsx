import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getSharedCart,
  removeSharedItem,
  closeSharedCart,
  shareUrlFor,
  groupByParticipant,
  totalOfShared,
  writeShareMode,
  type SharedCart,
} from "@/lib/shared-cart";
import { useCart, brl } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Share2,
  Copy,
  Trash2,
  Plus,
  Timer,
  Crown,
  MessageCircle,
  ShoppingBag,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { title: "Carrinho compartilhado — Quero Bis" },
      {
        name: "description",
        content: "Entre no carrinho compartilhado e adicione seus itens antes do pedido fechar.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Ops!</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center">Carrinho não encontrado.</div>
  ),
  component: SharedCartPage,
});

function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return "";
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "expirado";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function SharedCartPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const [cartData, setCartData] = useState<SharedCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("querobis:share_name") || "";
  });
  const [joined, setJoined] = useState(false);

  async function refresh() {
    try {
      const data = await getSharedCart(token);
      setCartData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`shared_cart:${token}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shared_carts", filter: `token=eq.${token}` },
        () => refresh(),
      )
      .subscribe();
    const iv = setInterval(refresh, 12_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const grouped = useMemo(() => groupByParticipant(cartData?.items ?? []), [cartData]);
  const total = totalOfShared(cartData?.items ?? []);
  const countdown = useCountdown(cartData?.expires_at);
  const status = cartData?.status ?? "open";
  const isOwner = !!cartData?.is_owner;

  function handleJoin() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Digite seu nome (mínimo 2 letras).");
      return;
    }
    localStorage.setItem("querobis:share_name", trimmed);
    writeShareMode({ token, name: trimmed, ownerName: cartData?.owner_name });
    setJoined(true);
    toast.success(`Bora, ${trimmed}! Adicione seus itens no cardápio.`);
    navigate({ to: "/" });
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrlFor(token));
    toast.success("Link copiado!");
  }

  function handleWhats() {
    const msg = `Bora dividir esse pedido? ${cartData?.owner_name ?? ""} tá montando um carrinho 🍨\n${shareUrlFor(token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function handleRemove(uid: string, participant: string) {
    try {
      await removeSharedItem(token, uid, participant);
      toast.success("Item removido");
      refresh();
    } catch {
      toast.error("Só o dono ou quem adicionou pode remover");
    }
  }

  async function handleClose() {
    if (!confirm("Fechar o carrinho? Ninguém mais poderá adicionar itens.")) return;
    try {
      await closeSharedCart(token);
      toast.success("Carrinho fechado");
      refresh();
    } catch {
      toast.error("Falha ao fechar");
    }
  }

  async function handleFinalize() {
    if (!cartData) return;
    // carrega os itens compartilhados no carrinho local do dono e vai pro checkout
    cart.clear();
    for (const it of cartData.items) {
      cart.add({
        productId: it.productId,
        name: it.name,
        image: it.image,
        size: it.size,
        flavor: it.flavor,
        extras: it.extras,
        removed: it.removed,
        note: it.note ? `[${it.participant}] ${it.note}` : `[${it.participant}]`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      });
    }
    writeShareMode(null);
    sessionStorage.setItem("querobis:merge_share_token", token);
    navigate({ to: "/finalizar" });
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center">Carregando…</div>;
  }
  if (!cartData) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Carrinho não encontrado</h1>
          <p className="text-muted-foreground">O link pode ter expirado ou está inválido.</p>
        </div>
      </div>
    );
  }

  const closed = status !== "open";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/70 pb-24">
      <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Carrinho compartilhado
              </div>
              <div className="font-bold text-lg truncate">
                {cartData.title || `${cartData.owner_name} tá montando um pedido`}
              </div>
            </div>
            {status === "open" ? (
              <Badge variant="secondary" className="gap-1">
                <Timer className="h-3 w-3" /> {countdown}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" /> {status}
              </Badge>
            )}
          </div>
          {cartData.message && (
            <p className="text-sm text-muted-foreground mt-2 italic">"{cartData.message}"</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={handleCopy} className="gap-1.5">
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <Button size="sm" variant="secondary" onClick={handleWhats} className="gap-1.5">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </div>
        </div>

        {/* Join box */}
        {!closed && !isOwner && (
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Entrar e adicionar meus itens
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Seu nome (aparece pra galera)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
              />
              <Button onClick={handleJoin} disabled={joined}>
                {joined ? "Entrando…" : "Entrar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao entrar, tudo que você adicionar no cardápio cai automaticamente aqui.
            </p>
          </div>
        )}

        {/* Grupos */}
        <div className="space-y-3">
          {grouped.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-muted-foreground">
              Ninguém adicionou nada ainda. Seja o primeiro!
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.name} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {g.name === cartData.owner_name && <Crown className="h-4 w-4 text-primary" />}
                  {g.name}
                  <Badge variant="outline" className="text-[10px]">
                    {g.items.length} {g.items.length === 1 ? "item" : "itens"}
                  </Badge>
                </div>
                <div className="font-bold text-sm">{brl(g.subtotal)}</div>
              </div>
              <ul className="divide-y divide-border/60">
                {g.items.map((it) => (
                  <li key={it.uid} className="flex items-center gap-3 p-3">
                    {it.image && (
                      <img
                        src={it.image}
                        alt={it.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {it.quantity}× {it.name}
                      </div>
                      {(it.size || it.flavor) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[it.size, it.flavor].filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold">{brl(it.unitPrice * it.quantity)}</div>
                    {!closed && (
                      <button
                        onClick={() => handleRemove(it.uid, g.name)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Split preview */}
        {grouped.length > 1 && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-sm font-semibold mb-2">Divisão da conta</div>
            <div className="space-y-1 text-sm">
              {grouped.map((g) => (
                <div key={g.name} className="flex justify-between">
                  <span>{g.name}</span>
                  <span className="font-medium">{brl(g.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-border/60 my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cada um paga em média</span>
                <span>{brl(total / Math.max(grouped.length, 1))}</span>
              </div>
            </div>
          </div>
        )}

        {/* Owner actions */}
        {isOwner && !closed && (
          <div className="sticky bottom-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Fechar carrinho
            </Button>
            <Button className="flex-1 gap-1.5" onClick={handleFinalize} disabled={total <= 0}>
              <ShoppingBag className="h-4 w-4" />
              Finalizar ({brl(total)})
            </Button>
          </div>
        )}
        {isOwner && status === "merged" && cartData.merged_order_id && (
          <Button
            className="w-full gap-1.5"
            variant="secondary"
            onClick={() =>
              navigate({ to: "/rastrear/$token", params: { token: cartData.merged_order_id! } })
            }
          >
            <ShoppingBag className="h-4 w-4" />
            Ver pedido
          </Button>
        )}
      </div>

      <div className="fixed bottom-4 right-4">
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 shadow-lg"
          onClick={() => navigate({ to: "/" })}
        >
          <Share2 className="h-4 w-4" /> Ir pro cardápio
        </Button>
      </div>
    </div>
  );
}
