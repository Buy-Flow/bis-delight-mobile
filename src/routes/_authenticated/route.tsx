import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

const ADMIN_PREFIXES = [
  "/admin",
  "/rush",
  "/ai-growth",
  "/avaliacoes",
  "/carrinhos",
  "/clientes",
  "/copiloto",
  "/financeiro",
  "/notificacoes",
  "/precificacao",
  "/lucratividade",
  "/previsao",
  "/modelos",
  "/biblioteca",
  "/pdv",
  "/garcons",
  "/impressao",
  "/mesas",
  "/entregas",
  "/caixa",
  "/importar",
  "/estoque",
  "/ficha-tecnica",
  "/usuarios",
];

function isAdminRoute(pathname: string) {
  return ADMIN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (isAdminRoute(pathname)) {
    return (
      <AdminShell>
        <Outlet />
      </AdminShell>
    );
  }
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.pathname } });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});
