import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, RefreshCw, ShoppingCart, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/data/menu";

type CartItem = {
  uid: string;
  name: string;
  quantity: number;
  unitPrice: number;
  size?: string;
  flavor?: string;
  extras?: { label: string; price: number }[];
};

type Row = {
  user_id: string;
  items: CartItem[];
  subtotal: number;
  item_count: number;
  notified_at: string | null;
  updated_at: string;
  profile: { full_name: string | null; phone: string | null } | null;
};

const IDLE_MIN = 30;
const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

function buildMessage(name: string | null, r: Row) {
  const hi = name?.split(" ")[0] ? `Oi, ${name.split(" ")[0]}!` : "Oi!";
  const list = r.items
    .slice(0, 5)
    .map((i) => `• ${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ""}`)
    .join("\n");
  const more = r.items.length > 5 ? `\n…e mais ${r.items.length - 5} item(ns)` : "";
  return (
    `${hi} 🍧 Aqui é da *${BRAND.name}*.\n\n` +
    `Vi que você começou um pedido e não finalizou:\n${list}${more}\n\n` +
    `Total: *${BRL(Number(r.subtotal))}*\n\n` +
    `Se quiser, é só continuar por aqui: https://querobis.lovable.app\n` +
    `Qualquer coisa, tô por aqui! 💜`
  );
}

export function AbandonedCartsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "notified" | "all">("pending");
  const [, setTick] = useState(0);

  const load = async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - IDLE_MIN * 60_000).toISOString();
    const { data, error } = await supabase
      .from("abandoned_carts")
      .select("user_id, items, subtotal, item_count, notified_at, updated_at")
      .is("recovered_at", null)
      .lte("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Não foi possível carregar os carrinhos.");
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Omit<Row, "profile">[];
    const ids = list.map((r) => r.user_id);
    let profiles: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, phone: p.phone }]));
    }
    setRows(list.map((r) => ({ ...r, profile: profiles[r.user_id] ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    const channel = supabase
      .channel("abandoned-carts-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "abandoned_carts" }, load)
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "pending") return rows.filter((r) => !r.notified_at);
    if (filter === "notified") return rows.filter((r) => r.notified_at);
    return rows;
  }, [rows, filter]);

  const markNotified = async (userId: string) => {
    const { error } = await supabase
      .from("abandoned_carts")
      .update({ notified_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) toast.error("Não deu pra marcar como notificado.");
    else toast.success("Marcado como notificado.");
  };

  const openWhatsApp = (r: Row) => {
    const phone = onlyDigits(r.profile?.phone ?? "");
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    const full = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(buildMessage(r.profile?.full_name ?? null, r));
    window.open(`https://wa.me/${full}?text=${msg}`, "_blank", "noopener,noreferrer");
    markNotified(r.user_id);
  };

  const pendingCount = rows.filter((r) => !r.notified_at).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Carrinhos abandonados</h2>
          <p className="text-xs text-white/60">
            Sem atividade há mais de {IDLE_MIN} min. {pendingCount} pendente
            {pendingCount === 1 ? "" : "s"} de contato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
            {(["pending", "notified", "all"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  filter === k ? "bg-neon-yellow text-[oklch(0.15_0.10_305)]" : "text-white/70"
                }`}
              >
                {k === "pending" ? "Pendentes" : k === "notified" ? "Notificados" : "Todos"}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
          <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-white/30" />
          Nenhum carrinho abandonado {filter === "pending" ? "pendente" : ""} no momento.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => {
            const mins = minutesAgo(r.updated_at);
            const hrs = Math.floor(mins / 60);
            const ago = hrs >= 1 ? `${hrs}h${mins % 60 ? ` ${mins % 60}min` : ""}` : `${mins}min`;
            const name = r.profile?.full_name || "Cliente sem nome";
            const phone = r.profile?.phone || "";
            return (
              <div
                key={r.user_id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white">{name}</span>
                      {r.notified_at ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Notificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          <Clock className="h-3 w-3" /> {ago} sem mexer
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {phone || "sem telefone"} · {r.item_count} item{r.item_count === 1 ? "" : "s"} ·{" "}
                      <span className="font-semibold text-neon-yellow">{BRL(Number(r.subtotal))}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-white/70">
                      {r.items.slice(0, 3).map((i) => (
                        <li key={i.uid} className="truncate">
                          • {i.quantity}x {i.name}
                          {i.size ? ` (${i.size})` : ""}
                        </li>
                      ))}
                      {r.items.length > 3 && (
                        <li className="text-white/40">…e mais {r.items.length - 3}</li>
                      )}
                    </ul>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openWhatsApp(r)}
                      disabled={!phone}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                    {r.notified_at ? null : (
                      <button
                        onClick={() => markNotified(r.user_id)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:text-white"
                      >
                        Marcar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
