import {
  createStart,
  createMiddleware,
  createCsrfMiddleware,
} from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// CSRF protection for server functions and state-changing HTTP routes.
// Public webhook / cron endpoints authenticate themselves (Asaas token, HMAC,
// cron secret) and are legitimately called cross-site, so they are exempted.
// GET/HEAD/OPTIONS are safe methods and skipped.
const CSRF_EXEMPT_PREFIXES = [
  "/api/public/",       // webhooks, cron, public read-only endpoints
  "/asaas-webhook",     // legacy alias for Asaas panel
  "/webhooks/",         // legacy alias for Asaas panel
];

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ request }) => {
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return false;
    }
    const path = new URL(request.url).pathname;
    if (CSRF_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p))) {
      return false;
    }
    return true;
  },
  secFetchSite: ["same-origin", "none"],
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));

