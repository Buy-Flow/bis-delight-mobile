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
  const { isCheckoutOpen, openCheckout, items } = useCart();
  const navigate = useNavigate();

  // Abre o checkout ao entrar na página
  useEffect(() => {
    if (!isCheckoutOpen) openCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se o carrinho estiver vazio, volta pro cardápio
  useEffect(() => {
    if (items.length === 0) navigate({ to: "/" });
  }, [items.length, navigate]);

  // Quando o checkout fecha (X, backdrop, envio finalizado), sai da página
  useEffect(() => {
    if (!isCheckoutOpen) {
      const t = setTimeout(() => navigate({ to: "/" }), 30);
      return () => clearTimeout(t);
    }
  }, [isCheckoutOpen, navigate]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0118]" />}>
      <CheckoutSheet />
    </Suspense>
  );
}
