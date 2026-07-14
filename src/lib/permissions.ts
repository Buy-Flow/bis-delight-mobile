/**
 * Role-based access control for the admin/staff area.
 *
 * Roles:
 * - admin   → dono; acesso total (inclui gestão de usuários, IA, configurações).
 * - manager → gerente; acesso a tudo exceto gestão de usuários e IA sensível.
 *             (Escrita em produtos/config continua bloqueada por RLS admin-only.)
 * - staff   → funcionário/garçom; opera cozinha, PDV, mesas, entregas,
 *             WhatsApp, garçons, impressão, caixa e avaliações. NÃO edita
 *             cardápio, configurações, financeiro ou usuários.
 * - kitchen → cozinha; apenas painel de pedidos ao vivo e impressão.
 * - delivery→ motoboy; apenas portal /motoboy.
 * - user    → cliente comum; apenas rotas públicas / conta.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role =
  | "admin"
  | "manager"
  | "staff"
  | "kitchen"
  | "delivery"
  | "user";

/**
 * Rotas administrativas EXCLUSIVAS de admin (gestão de usuários, IA sensível,
 * automações com custo/envio de mensagens e configuração global de preços).
 * Manager herda `*` MENOS estas rotas.
 */
export const ADMIN_ONLY_ROUTES = [
  "/usuarios",
  "/ai-growth",
  "/copiloto",
  "/automacoes",
  "/modelos",
  "/previsao",
  "/importar",
  "/precificacao",
];

export function isAdminOnlyRoute(pathname: string) {
  return ADMIN_ONLY_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Rotas permitidas por papel. `*` = acesso total à área administrativa.
 * Ordem importa: a primeira rota da lista é usada como "landing" quando o
 * usuário tenta acessar algo fora do seu escopo.
 */
export const ROLE_ROUTES: Record<Exclude<Role, "user">, string[]> = {
  admin: ["*"],
  manager: ["*"], // com exclusão automática de ADMIN_ONLY_ROUTES em canAccessRoute
  staff: [
    "/rush",
    "/pdv",
    "/mesas",
    "/entregas",
    "/whatsapp",
    "/garcons",
    "/impressao",
    "/caixa",
    "/avaliacoes",
    "/conta",
  ],
  kitchen: ["/rush", "/impressao", "/conta"],
  delivery: ["/motoboy", "/conta"],
};

/** Rotas administrativas (área com AdminShell). Precisa estar sincronizado com
 *  ADMIN_PREFIXES em `_authenticated/route.tsx`. */
export const ADMIN_ROUTES = [
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
  "/whatsapp",
  "/automacoes",
];

export function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/** Verifica se um conjunto de papéis pode acessar uma rota. */
export function canAccessRoute(pathname: string, roles: Role[]): boolean {
  // Cliente pode navegar por rotas não-admin livremente.
  if (!isAdminRoute(pathname)) return true;
  for (const r of roles) {
    if (r === "user") continue;
    const allowed = ROLE_ROUTES[r as Exclude<Role, "user">];
    if (!allowed) continue;
    if (allowed.includes("*")) return true;
    if (
      allowed.some(
        (p) => pathname === p || pathname.startsWith(p + "/"),
      )
    )
      return true;
  }
  return false;
}

/** Landing page adequada para o papel efetivo. */
export function landingForRoles(roles: Role[]): string {
  if (roles.includes("admin") || roles.includes("manager")) return "/admin";
  if (roles.includes("staff")) return "/rush";
  if (roles.includes("kitchen")) return "/rush";
  if (roles.includes("delivery")) return "/motoboy";
  return "/conta";
}

/** Escrita em cardápio/configuração/usuários é restrita a admin (garantido
 *  também por RLS). Manager tem acesso operacional amplo mas usamos admin
 *  como gate na UI para evitar tentativas que a RLS rejeitaria. */
export function canManage(roles: Role[]): boolean {
  return roles.includes("admin");
}

/** Qualquer papel operacional (staff, kitchen, manager, admin, delivery). */
export function isTeamMember(roles: Role[]): boolean {
  return roles.some((r) =>
    ["admin", "manager", "staff", "kitchen", "delivery"].includes(r),
  );
}

/** Hook: papéis do usuário logado. */
export function usePermissions() {
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
    staleTime: 60_000,
  });
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

export function labelForRole(role: Role): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "manager":
      return "Gerente";
    case "staff":
      return "Atendente";
    case "kitchen":
      return "Cozinha";
    case "delivery":
      return "Motoboy";
    case "user":
      return "Cliente";
  }
}
