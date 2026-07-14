import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaSettings } from "@/lib/pwa-settings";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
  head: () => ({
    meta: [
      { title: "Sem conexão · Quero Bis" },
      { name: "description", content: "Página exibida quando o navegador está offline." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OfflinePage() {
  const { settings } = usePwaSettings();
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 bg-gradient-to-b from-background to-muted/40">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <WifiOff className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{settings.offline_fallback_title}</h1>
        <p className="text-muted-foreground leading-relaxed">{settings.offline_fallback_message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link to="/">{settings.offline_fallback_cta}</Link>
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    </main>
  );
}
