/**
 * Núcleo puro do RBAC — SEM dependências de runtime (React, Supabase, env).
 *
 * A doc abaixo é a fonte de verdade e está espelhada como matriz executável
 * em `src/lib/__tests__/permissions.test.ts`. Qualquer edição aqui que
 * divergir da matriz quebra o `bun test` — divergência silenciosa impossível.
 *
 * Papéis:
 * - admin    → dono; acesso total, inclusive rotas ADMIN_ONLY.
 * - manager  → gerente; acesso amplo EXCETO ADMIN_ONLY_ROUTES.
 * - staff    → operação (rush/pdv/mesas/entregas/whatsapp/garcons/impressao/caixa/avaliacoes).
 * - kitchen  → cozinha; rush + impressão apenas.
 * - delivery → motoboy; portal /motoboy apenas.
 * - user     → cliente comum; só rotas públicas.
 */

export type Role =
  | "admin"
  | "manager"
  | "staff"
  | "kitchen"
  | "delivery"
  | "user";

export const ADMIN_ONLY_ROUTES = [
  "/usuarios",
  "/ai-growth",
  "/copiloto",
  "/automacoes",
  "/modelos",
  "/previsao",
  "/importar",
  "/precificacao",
] as const;

export function isAdminOnlyRoute(pathname: string) {
  return ADMIN_ONLY_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export const ROLE_ROUTES: Record<Exclude<Role, "user">, string[]> = {
  admin: ["*"],
  manager: ["*"], // ADMIN_ONLY_ROUTES é subtraído em canAccessRoute
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
] as const;

export function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function canAccessRoute(pathname: string, roles: Role[]): boolean {
  if (!isAdminRoute(pathname)) return true;
  if (isAdminOnlyRoute(pathname)) return roles.includes("admin");
  for (const r of roles) {
    if (r === "user") continue;
    const allowed = ROLE_ROUTES[r as Exclude<Role, "user">];
    if (!allowed) continue;
    if (allowed.includes("*")) return true;
    if (allowed.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return true;
    }
  }
  return false;
}

export function landingForRoles(roles: Role[]): string {
  if (roles.includes("admin") || roles.includes("manager")) return "/admin";
  if (roles.includes("staff")) return "/rush";
  if (roles.includes("kitchen")) return "/rush";
  if (roles.includes("delivery")) return "/motoboy";
  return "/conta";
}

export function canManage(roles: Role[]): boolean {
  return roles.includes("admin");
}

export function isTeamMember(roles: Role[]): boolean {
  return roles.some((r) =>
    ["admin", "manager", "staff", "kitchen", "delivery"].includes(r),
  );
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
