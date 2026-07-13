import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import {
  isAdminRoute,
  usePermissions,
  canAccessRoute,
  landingForRoles,
} from "@/lib/permissions";

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { roles, isLoading, isTeam } = usePermissions();

  // Enforcement: se rota é admin e o papel não permite, redireciona.
  useEffect(() => {
    if (isLoading) return;
    if (!isAdminRoute(pathname)) return;
    if (!canAccessRoute(pathname, roles)) {
      const target = landingForRoles(roles);
      navigate({ to: target, replace: true });
    }
  }, [pathname, isLoading, roles, navigate]);

  if (isAdminRoute(pathname)) {
    // Enquanto papéis carregam, evita flash da UI admin para não-times.
    if (isLoading) {
      return (
        <div className="min-h-screen bg-[#0c031f] text-white grid place-items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      );
    }
    if (!canAccessRoute(pathname, roles)) {
      // Fallback visual enquanto o effect redireciona.
      return (
        <div className="min-h-screen bg-[#0c031f] text-white grid place-items-center px-4">
          <div className="max-w-sm text-center">
            <h1 className="font-display text-2xl font-black">Acesso restrito</h1>
            <p className="mt-2 text-sm text-white/60">
              Sua conta não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      );
    }
    return (
      <AdminShell>
        <Outlet />
      </AdminShell>
    );
  }
  return (
    <>
      {!isTeam && <ProfileCompletionBanner />}
      <Outlet />
    </>
  );
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
