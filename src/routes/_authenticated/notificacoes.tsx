import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { NotificationsTab } from "@/components/admin/NotificationsTab";

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


      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <NotificationsTab />
      </main>
    </div>
  );
}
