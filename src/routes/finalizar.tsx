import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef } from "react";
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
  const opened = useRef(false);

  useEffect(() => {
    openCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (items.length === 0) navigate({ to: "/" });
  }, [items.length, navigate]);

  useEffect(() => {
    if (isCheckoutOpen) {
      opened.current = true;
      return;
    }
    if (opened.current) navigate({ to: "/" });
  }, [isCheckoutOpen, navigate]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0118]" />}>
      <CheckoutSheet />
    </Suspense>
  );
}

