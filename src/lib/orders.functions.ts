import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cancelSchema = z.object({ orderId: z.string().uuid() });

export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => cancelSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership and cancellable state
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, user_id, status, paid_at")
      .eq("id", data.orderId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!order) throw new Error("Pedido não encontrado");
    if (order.user_id !== userId) throw new Error("Sem permissão");
    if (order.paid_at) throw new Error("Pedido já foi pago e não pode ser cancelado");
    if (!["novo", "aguardando_pagamento", "pendente"].includes(order.status)) {
      throw new Error("Este pedido não pode mais ser cancelado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelado", canceled_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .is("paid_at", null);

    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
