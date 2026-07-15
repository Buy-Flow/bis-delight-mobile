// Realtime listener that feeds the admin notification center.
// Mounted once inside AdminShell.

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shortUid } from "@/lib/uid";
import { pushAdminNotif } from "@/lib/admin-notifications";

type OrderRow = {
  id: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  customer_name: string | null;
  total: number | null;
  payment_method: string | null;
};

function isOnlinePayment(method: string | null | undefined): boolean {
  return ["pix", "cartao", "credit_card", "asaas_checkout"].includes(String(method ?? "").toLowerCase());
}

function money(v: number | null | undefined): string {
  if (typeof v !== "number") return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function shortOrder(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function useAdminNotificationsListener() {
  const suffixRef = useRef(`notif-${shortUid(10)}`);
  const seedRef = useRef(false);

  useEffect(() => {
    const suffix = suffixRef.current;

    const orderChan = supabase
      .channel(`admin-notif-orders-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as OrderRow;
          if (!row?.id) return;
          if (row.status !== "pago" && isOnlinePayment(row.payment_method)) return;
          pushAdminNotif({
            kind: row.status === "pago" ? "order_paid" : "order_new",
            refId: `${row.status === "pago" ? "order_paid" : "order_new"}:${row.id}`,
            title: `${row.status === "pago" ? "Pagamento confirmado" : "Novo pedido"} · ${shortOrder(row.id)}`,
            description: `${row.customer_name ?? "Cliente"} · ${money(row.total)}`,
            href: `/rush?order=${row.id}`,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const oldRow = payload.old as Partial<OrderRow>;
          const row = payload.new as OrderRow;
          if (!row?.id) return;
          if (!oldRow?.paid_at && row.paid_at) {
            pushAdminNotif({
              kind: "order_paid",
              refId: `order_paid:${row.id}`,
              title: `Pagamento confirmado · ${shortOrder(row.id)}`,
              description: `${row.customer_name ?? "Cliente"} · ${money(row.total)}`,
              href: `/rush?order=${row.id}`,
            });
          }
          if (oldRow?.status !== row.status) {
            if (row.status === "cancelado") {
              pushAdminNotif({
                kind: "order_cancelled",
                refId: `order_cancelled:${row.id}`,
                title: `Pedido cancelado · ${shortOrder(row.id)}`,
                description: row.customer_name ?? undefined,
                href: `/rush?order=${row.id}`,
              });
            } else if (row.status === "saiu_para_entrega") {
              pushAdminNotif({
                kind: "order_dispatched",
                refId: `order_dispatched:${row.id}`,
                title: `Saiu para entrega · ${shortOrder(row.id)}`,
                description: row.customer_name ?? undefined,
                href: `/entregas`,
              });
            } else if (row.status === "entregue") {
              pushAdminNotif({
                kind: "order_delivered",
                refId: `order_delivered:${row.id}`,
                title: `Pedido entregue · ${shortOrder(row.id)}`,
                description: row.customer_name ?? undefined,
                href: `/entregas`,
              });
            }
          }
        },
      )
      .subscribe();

    const reviewChan = supabase
      .channel(`admin-notif-reviews-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        (payload) => {
          const row = payload.new as { id?: string; rating?: number; comment?: string | null };
          if (!row?.id) return;
          const stars = "★".repeat(Math.max(1, Math.min(5, row.rating ?? 0)));
          pushAdminNotif({
            kind: "review_new",
            refId: `review_new:${row.id}`,
            title: `Nova avaliação · ${stars}`,
            description: row.comment ?? undefined,
            href: `/avaliacoes`,
          });
        },
      )
      .subscribe();

    // Late orders scan (every 3 minutes)
    const scanLate = async () => {
      const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id,status,created_at,customer_name")
        .in("status", ["novo", "pago", "confirmado", "preparando", "em_preparo", "aceito"])
        .lt("created_at", cutoff)
        .limit(50);
      if (!data) return;
      if (!seedRef.current) {
        seedRef.current = true;
        return;
      }
      for (const o of data) {
        pushAdminNotif({
          kind: "order_late",
          refId: `order_late:${o.id}`,
          title: `Pedido atrasado · ${shortOrder(o.id)}`,
          description: `${o.customer_name ?? "Cliente"} · aguardando há +30min`,
          href: `/rush?order=${o.id}`,
        });
      }
    };
    const lateTimer = window.setInterval(() => void scanLate(), 3 * 60_000);
    void scanLate();

    // Low stock scan (every 10 min)
    const scanLowStock = async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id,name,stock,low_stock_threshold,active")
        .eq("active", true)
        .limit(500);
      if (!data) return;
      for (const r of data as Array<{
        id: string;
        name: string | null;
        stock: number | null;
        low_stock_threshold: number | null;
      }>) {
        if (
          typeof r.stock === "number" &&
          typeof r.low_stock_threshold === "number" &&
          r.low_stock_threshold > 0 &&
          r.stock <= r.low_stock_threshold
        ) {
          const bucket = new Date().toISOString().slice(0, 10);
          pushAdminNotif({
            kind: "stock_low",
            refId: `stock_low:${r.id}:${bucket}`,
            title: `Estoque baixo · ${r.name ?? "Item"}`,
            description: `Restam ${r.stock} · mínimo ${r.low_stock_threshold}`,
            href: `/estoque`,
          });
        }
      }
    };
    const stockTimer = window.setInterval(() => void scanLowStock(), 10 * 60_000);
    void scanLowStock();

    return () => {
      window.clearInterval(lateTimer);
      window.clearInterval(stockTimer);
      supabase.removeChannel(orderChan);
      supabase.removeChannel(reviewChan);
    };
  }, []);
}
