import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Home, LogOut, Loader2, ClipboardList, Users, LineChart } from "lucide-react";
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
      <Toaster position="bottom-center" theme="dark" closeButton />

      <header className="sticky top-0 z-30 border-b border-purple-900/50 bg-[oklch(0.10_0.08_300)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <ClipboardList className="h-5 w-5 text-neon-yellow" />
            <span
              className="text-xl font-black uppercase text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Pedidos
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              Painel
            </Link>
            <Link
              to="/financeiro"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              <LineChart className="h-3.5 w-3.5" /> Financeiro
            </Link>
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              <Users className="h-3.5 w-3.5" /> Clientes
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

      <main className="mx-auto max-w-6xl px-4 py-8">
        <OrdersTab />
      </main>
    </div>
  );
}

