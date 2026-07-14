/**
 * Matriz de permissões — fonte de verdade EXECUTÁVEL do RBAC.
 *
 * Espelha a documentação em `permissions-core.ts`. Se alguém alterar
 * ROLE_ROUTES / ADMIN_ONLY_ROUTES / ADMIN_ROUTES sem atualizar esta matriz,
 * `bun test` quebra — a divergência entre doc e código deixa de ser silenciosa.
 *
 * Cobre:
 *   1. Acesso rota-a-rota por papel (matriz completa role × ADMIN_ROUTES).
 *   2. Combinações multi-papel (união de permissões).
 *   3. Sub-rotas (`/rush/algo`) devem herdar do prefixo.
 *   4. Landing por papel.
 *   5. `canManage`, `isTeamMember`, `isAdminRoute`, `isAdminOnlyRoute`.
 *   6. Invariantes estruturais: ADMIN_ONLY ⊂ ADMIN_ROUTES, rotas de cada
 *      papel operacional ⊂ ADMIN_ROUTES, rótulos definidos para todo papel.
 */
import { describe, it, expect } from "vitest";
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
} from "@/lib/permissions-core";

// Papéis operacionais (exclui "user").
const OP_ROLES: Exclude<Role, "user">[] = [
  "admin",
  "manager",
  "staff",
  "kitchen",
  "delivery",
];

// -----------------------------------------------------------------------------
// 1. Matriz canônica: para cada papel, quais rotas em ADMIN_ROUTES devem ser
//    acessíveis. Fonte declarativa — se alterar aqui, a lógica precisa refletir
//    (e vice-versa).
// -----------------------------------------------------------------------------
const EXPECTED_ACCESS: Record<Exclude<Role, "user">, Set<string>> = {
  admin: new Set(ADMIN_ROUTES), // total
  manager: new Set(ADMIN_ROUTES.filter((r) => !ADMIN_ONLY_ROUTES.includes(r as never))),
  staff: new Set([
    "/rush",
    "/pdv",
    "/mesas",
    "/entregas",
    "/whatsapp",
    "/garcons",
    "/impressao",
    "/caixa",
    "/avaliacoes",
  ]),
  kitchen: new Set(["/rush", "/impressao"]),
  delivery: new Set([]), // /motoboy não está em ADMIN_ROUTES; testado à parte
};

describe("RBAC — matriz papel × rota (ADMIN_ROUTES)", () => {
  for (const role of OP_ROLES) {
    for (const route of ADMIN_ROUTES) {
      const shouldAccess = EXPECTED_ACCESS[role].has(route);
      it(`${role} ${shouldAccess ? "PODE" : "NÃO PODE"} acessar ${route}`, () => {
        expect(canAccessRoute(route, [role])).toBe(shouldAccess);
      });
    }
  }

  it("user (cliente) não acessa nenhuma rota admin", () => {
    for (const route of ADMIN_ROUTES) {
      expect(canAccessRoute(route, ["user"])).toBe(false);
    }
  });

  it("sem papéis: bloqueado em toda rota admin", () => {
    for (const route of ADMIN_ROUTES) {
      expect(canAccessRoute(route, [])).toBe(false);
    }
  });

  it("rotas públicas liberadas para todos os papéis (inclusive vazio)", () => {
    const publicRoutes = ["/", "/menu", "/carrinho", "/produto/x", "/c/abc"];
    for (const r of publicRoutes) {
      expect(canAccessRoute(r, [])).toBe(true);
      expect(canAccessRoute(r, ["user"])).toBe(true);
      expect(canAccessRoute(r, ["admin"])).toBe(true);
    }
  });
});

// -----------------------------------------------------------------------------
// 2. Rotas ADMIN_ONLY: manager NUNCA entra; admin sempre entra.
// -----------------------------------------------------------------------------
describe("RBAC — ADMIN_ONLY_ROUTES", () => {
  for (const route of ADMIN_ONLY_ROUTES) {
    it(`admin acessa ${route}`, () => {
      expect(canAccessRoute(route, ["admin"])).toBe(true);
    });
    it(`manager NÃO acessa ${route}`, () => {
      expect(canAccessRoute(route, ["manager"])).toBe(false);
    });
    it(`staff/kitchen/delivery NÃO acessam ${route}`, () => {
      expect(canAccessRoute(route, ["staff"])).toBe(false);
      expect(canAccessRoute(route, ["kitchen"])).toBe(false);
      expect(canAccessRoute(route, ["delivery"])).toBe(false);
    });
    it(`${route} está classificada como admin-only`, () => {
      expect(isAdminOnlyRoute(route)).toBe(true);
    });
  }

  it("sub-rota de ADMIN_ONLY também é bloqueada para manager", () => {
    expect(canAccessRoute("/usuarios/123", ["manager"])).toBe(false);
    expect(canAccessRoute("/ai-growth/campanha/1", ["manager"])).toBe(false);
    expect(canAccessRoute("/usuarios/123", ["admin"])).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 3. Combinações multi-papel — união de permissões, sem downgrade.
// -----------------------------------------------------------------------------
describe("RBAC — combinações multi-papel", () => {
  it("admin+staff mantém acesso admin-only", () => {
    expect(canAccessRoute("/usuarios", ["admin", "staff"])).toBe(true);
    expect(canAccessRoute("/ai-growth", ["staff", "admin"])).toBe(true);
  });

  it("manager+kitchen: entra em /rush (kitchen), continua bloqueado em /usuarios (nem admin)", () => {
    expect(canAccessRoute("/rush", ["manager", "kitchen"])).toBe(true);
    expect(canAccessRoute("/usuarios", ["manager", "kitchen"])).toBe(false);
  });

  it("staff+delivery unem escopos", () => {
    expect(canAccessRoute("/pdv", ["staff", "delivery"])).toBe(true);
    // /motoboy não está em ADMIN_ROUTES → pública para qualquer papel.
    expect(canAccessRoute("/motoboy", ["staff", "delivery"])).toBe(true);
  });

  it("user + qualquer papel operacional: papel operacional prevalece", () => {
    expect(canAccessRoute("/rush", ["user", "staff"])).toBe(true);
    expect(canAccessRoute("/usuarios", ["user", "admin"])).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 4. Sub-rotas herdam do prefixo.
// -----------------------------------------------------------------------------
describe("RBAC — matching por prefixo", () => {
  it("/pdv/venda/123 herda /pdv para staff", () => {
    expect(canAccessRoute("/pdv/venda/123", ["staff"])).toBe(true);
  });
  it("/rush/detalhe/1 acessível a kitchen", () => {
    expect(canAccessRoute("/rush/detalhe/1", ["kitchen"])).toBe(true);
  });
  it("/whatsapp/conversa/x NÃO acessível a kitchen", () => {
    expect(canAccessRoute("/whatsapp/conversa/x", ["kitchen"])).toBe(false);
  });
  it("prefixo NÃO casa por substring falsa: /rushmore não é /rush", () => {
    // ADMIN_ROUTES não contém "/rushmore" → cai como rota pública, todos podem.
    expect(isAdminRoute("/rushmore")).toBe(false);
    // Mas garantimos que o matching é `=== p || startsWith(p + "/")`.
    expect(isAdminRoute("/rush/x")).toBe(true);
    expect(isAdminRoute("/rush")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 5. Landing, canManage, isTeamMember.
// -----------------------------------------------------------------------------
describe("RBAC — helpers auxiliares", () => {
  const cases: Array<[Role[], string]> = [
    [["admin"], "/admin"],
    [["manager"], "/admin"],
    [["admin", "delivery"], "/admin"],
    [["staff"], "/rush"],
    [["kitchen"], "/rush"],
    [["delivery"], "/motoboy"],
    [["user"], "/conta"],
    [[], "/conta"],
  ];
  for (const [roles, expected] of cases) {
    it(`landingForRoles(${JSON.stringify(roles)}) === ${expected}`, () => {
      expect(landingForRoles(roles)).toBe(expected);
    });
  }

  it("canManage: só admin", () => {
    expect(canManage(["admin"])).toBe(true);
    expect(canManage(["admin", "staff"])).toBe(true);
    expect(canManage(["manager"])).toBe(false);
    expect(canManage(["staff"])).toBe(false);
    expect(canManage(["kitchen"])).toBe(false);
    expect(canManage(["delivery"])).toBe(false);
    expect(canManage(["user"])).toBe(false);
    expect(canManage([])).toBe(false);
  });

  it("isTeamMember: todo papel operacional, exceto user/vazio", () => {
    for (const r of OP_ROLES) expect(isTeamMember([r])).toBe(true);
    expect(isTeamMember(["user"])).toBe(false);
    expect(isTeamMember([])).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// 6. Invariantes estruturais — pegam erros de manutenção em ADMIN_ROUTES.
// -----------------------------------------------------------------------------
describe("RBAC — invariantes estruturais", () => {
  it("todo ADMIN_ONLY_ROUTES está em ADMIN_ROUTES", () => {
    for (const r of ADMIN_ONLY_ROUTES) {
      expect(ADMIN_ROUTES).toContain(r);
    }
  });

  it("toda rota concreta de staff/kitchen que aparece em ADMIN_ROUTES está declarada em ADMIN_ROUTES", () => {
    for (const role of ["staff", "kitchen"] as const) {
      for (const route of ROLE_ROUTES[role]) {
        if (route === "*" || route === "/conta") continue;
        expect(ADMIN_ROUTES).toContain(route);
      }
    }
  });

  it("labelForRole cobre todos os papéis (sem 'undefined')", () => {
    const all: Role[] = ["admin", "manager", "staff", "kitchen", "delivery", "user"];
    for (const r of all) {
      expect(labelForRole(r)).toMatch(/\S+/);
    }
  });

  it("ADMIN_ROUTES não contém duplicatas", () => {
    expect(new Set(ADMIN_ROUTES).size).toBe(ADMIN_ROUTES.length);
  });

  it("ADMIN_ONLY_ROUTES não contém duplicatas", () => {
    expect(new Set(ADMIN_ONLY_ROUTES).size).toBe(ADMIN_ONLY_ROUTES.length);
  });
});
