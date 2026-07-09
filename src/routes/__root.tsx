import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/lib/cart-context";
import { ConfirmDialogHost } from "@/lib/confirm";
import heroBgLeft from "@/assets/hero-bg-left.png.asset.json";
import heroBgRight from "@/assets/hero-bg-right.png.asset.json";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#2a1240" },
      { title: "Quero Bis — Sorveteria & Açaí em Ouro Preto do Oeste" },
      {
        name: "description",
        content:
          "Cardápio digital da Quero Bis Sorveteria e Açaí em Ouro Preto do Oeste (RO). Monte seu açaí, escolha sabores e peça em casa pelo WhatsApp.",
      },
      { property: "og:site_name", content: "Quero Bis Sorveteria & Açaí" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Quero Bis — Sorveteria & Açaí" },
      {
        property: "og:description",
        content: "Monte seu açaí, escolha sabores e peça pelo WhatsApp. Entrega em Ouro Preto do Oeste - RO.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Quero Bis — Sorveteria & Açaí" },
      {
        name: "twitter:description",
        content: "Cardápio digital da Quero Bis. Peça sorvetes, açaí e milk shakes pelo WhatsApp.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=Barlow+Condensed:wght@900&family=Fredoka:wght@600;700&family=Caveat:wght@600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=Barlow+Condensed:wght@900&family=Fredoka:wght@600;700&family=Caveat:wght@600;700&display=swap",
      },
      // LCP: preload hero images so they arrive before hydration
      {
        rel: "preload",
        as: "image",
        href: heroBgLeft.url,
        fetchPriority: "high",
      },
      {
        rel: "preload",
        as: "image",
        href: heroBgRight.url,
        fetchPriority: "high",
      },

      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function findHorizontalScroller(start: EventTarget | null) {
  if (!(start instanceof Element)) return null;

  let current: Element | null = start;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const canScrollX = current.scrollWidth > current.clientWidth + 1;
    const overflowAllowsScroll = style.overflowX === "auto" || style.overflowX === "scroll";
    if (canScrollX && overflowAllowsScroll) {
      return current as HTMLElement;
    }
    current = current.parentElement;
  }

  return null;
}

function useDesktopWheelHorizontalScroll() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey) return;
      if (!window.matchMedia?.("(pointer: fine)").matches) return;

      const scroller = findHorizontalScroller(event.target);
      if (!scroller) return;

      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (delta === 0) return;

      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const atStart = scroller.scrollLeft <= 0 && delta < 0;
      const atEnd = scroller.scrollLeft >= maxScroll - 1 && delta > 0;
      if (maxScroll <= 0 || atStart || atEnd) return;

      event.preventDefault();
      scroller.scrollBy({ left: delta, behavior: "auto" });
    };

    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useDesktopWheelHorizontalScroll();

  useEffect(() => {
    let cancelled = false;
    import("@/lib/register-sw").then(({ registerServiceWorker }) => {
      if (!cancelled) registerServiceWorker();
    });
    return () => {
      cancelled = true;
    };
  }, []);



  useEffect(() => {
    let mounted = true;
    let lastUserId: string | null | undefined = undefined; // undefined = ainda não inicializado
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (!mounted) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        const nextUserId = session?.user?.id ?? null;
        // Primeira notificação (INITIAL_SESSION / SIGNED_IN de restauração): apenas registra,
        // sem invalidar — evita a "piscada" no carregamento.
        if (lastUserId === undefined) {
          lastUserId = nextUserId;
          return;
        }
        // Só invalida quando a identidade REALMENTE mudou (login/logout/troca de conta).
        if (nextUserId === lastUserId && event !== "USER_UPDATED") return;
        lastUserId = nextUserId;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      (window as unknown as { __sbUnsub?: () => void }).__sbUnsub = () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
      (window as unknown as { __sbUnsub?: () => void }).__sbUnsub?.();
    };
  }, [queryClient, router]);


  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <ConfirmDialogHost />
      </CartProvider>
    </QueryClientProvider>


  );
}

