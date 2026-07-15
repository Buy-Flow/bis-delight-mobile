/**
 * RBAC — camada React/Supabase. Toda a lógica pura vive em
 * `permissions-core.ts` (testada em `__tests__/permissions.test.ts`).
 * Este arquivo apenas expõe o hook e reexporta os símbolos para consumidores
 * existentes.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_ONLY_ROUTES,
  ADMIN_ROUTES,
  ROLE_ROUTES,
  canAccessRoute,
  canManage,
  isAdminOnlyRoute,
  isAdminRoute,
  isTeamMember,
  labelForRole,
  landingForRoles,
  type Role,
} from "./permissions-core";

export type { Role };
export {
  ADMIN_ONLY_ROUTES,
  ADMIN_ROUTES,
  ROLE_ROUTES,
  canAccessRoute,
  canManage,
  isAdminOnlyRoute,
  isAdminRoute,
  isTeamMember,
  labelForRole,
  landingForRoles,
};

/** Hook: papéis do usuário logado, com Realtime + refetch em auth change. */
export function usePermissions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["user_roles"],
    queryFn: async (): Promise<Role[]> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (error) return [];
      return (data ?? []).map((r) => r.role as Role);
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const attach = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`user_roles:${uid}:${Math.random().toString(36).slice(2)}`)

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_roles",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ["user_roles"] });
          },
        )
        .subscribe();
    };
    attach();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["user_roles"] });
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const roles = q.data ?? [];
  return {
    roles,
    isLoading: q.isLoading,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("manager"),
    isStaff: roles.includes("staff"),
    isKitchen: roles.includes("kitchen"),
    isTeam: isTeamMember(roles),
    canManage: canManage(roles),
    canAccess: (path: string) => canAccessRoute(path, roles),
    landing: landingForRoles(roles),
  };
}
