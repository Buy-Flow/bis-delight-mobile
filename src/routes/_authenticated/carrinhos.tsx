import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { Toaster } from "sonner";
import { Home, LogOut, Loader2, ShoppingCart, Users, LineChart, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/menu-data";
import { AbandonedCartsTab } from "@/components/admin/AbandonedCartsTab";

export const Route = createFileRoute("/_authenticated/carrinhos")({
  head: () => ({
    meta: [
      { title: "Carrinhos abandonados — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CarrinhosPage,
});

function CarrinhosPage() {
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
          <p className="mt-2 text-sm text-white/60">Sua conta não tem permissão de administrador.</p>
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


      <main className="mx-auto max-w-6xl px-4 py-8">
        <AbandonedCartsTab />
      </main>
    </div>
  );
}
