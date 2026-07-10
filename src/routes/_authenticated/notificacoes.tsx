import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { NotificationsTab } from "@/components/admin/NotificationsTab";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { Loader2, BellRing } from "lucide-react";
import { useIsAdmin } from "@/lib/menu-data";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useIsAdmin();

  useEffect(() => {
    if (!isLoading && !isAdmin) void navigate({ to: "/" });
  }, [isAdmin, isLoading, navigate]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.08_300)] text-white">
      <Toaster position="bottom-center" theme="dark" closeButton />

      <header className="sticky top-0 z-30 border-b border-purple-900/50 bg-[oklch(0.10_0.08_300)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/pedidos" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BellRing className="h-5 w-5 text-neon-yellow" />
            <span
              className="text-xl font-black uppercase text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Notificações
            </span>
          </Link>
          <AdminNavMenu />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <NotificationsTab />
      </main>
    </div>
  );
}
