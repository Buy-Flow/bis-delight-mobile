import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Home, LogOut, Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/menu-data";
import { OrdersTab } from "@/components/admin/OrdersTab";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useIsAdmin();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] px-4 text-white">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-black">Acesso negado</h1>
          <p className="mt-2 text-sm text-white/60">
            Sua conta não tem permissão de administrador.
          </p>
          <button
            onClick={signOut}
            className="mt-6 rounded-2xl bg-neon-pink px-4 py-2 text-sm font-bold text-white"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.08_300)] text-white">
      <Toaster position="top-center" theme="dark" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[oklch(0.10_0.08_300)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <ClipboardList className="h-5 w-5 text-neon-yellow" />
            <h1
              className="font-display text-xl font-black uppercase"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              <span className="text-neon-yellow">Pedidos</span>
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              Painel
            </Link>
            <Link
              to="/"
              className="hidden items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white sm:inline-flex"
            >
              <Home className="h-3.5 w-3.5" /> Ver site
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <OrdersTab />
      </main>
    </div>
  );
}
