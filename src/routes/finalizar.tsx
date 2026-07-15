import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useCart } from "@/lib/cart-context";

const CheckoutSheet = lazy(() =>
  import("@/components/menu/CheckoutSheet").then((m) => ({ default: m.CheckoutSheet })),
);

export const Route = createFileRoute("/finalizar")({
  head: () => ({
    meta: [
      { title: "Finalizar pedido — Quero Bis" },
      { name: "description", content: "Confirme seu pedido, endereço e pagamento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinalizarPage,
});

function FinalizarPage() {
  const { items, hydrated } = useCart();
  const navigate = useNavigate();

  // Só redireciona quando o cart terminou de hidratar do localStorage.
  // Timeouts fixos derrubavam o usuário em rede lenta antes do estado real chegar.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const holdUntil = Number(sessionStorage.getItem("querobis:payment_redirect_until") || 0);
      if (holdUntil > Date.now()) return;
    } catch {}
    if (items.length === 0) navigate({ to: "/" });
  }, [hydrated, items.length, navigate]);

  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <CheckoutSheet pageMode />
    </Suspense>
  );
}
