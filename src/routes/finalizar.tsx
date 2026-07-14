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
  const { items } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (items.length === 0) navigate({ to: "/" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [items.length, navigate]);

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0a0118]" />}>
      <CheckoutSheet pageMode />
    </Suspense>
  );
}
