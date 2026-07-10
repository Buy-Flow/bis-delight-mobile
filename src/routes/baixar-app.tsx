import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppDownloadSection } from "@/components/menu/AppDownloadSection";

export const Route = createFileRoute("/baixar-app")({
  head: () => ({
    meta: [
      { title: "Baixar app — Quero Bis" },
      {
        name: "description",
        content:
          "Instale o app Quero Bis na tela inicial do seu celular. Peça açaí e sorvete mais rápido, com notificações e recompensas.",
      },
      { property: "og:title", content: "Baixar app — Quero Bis" },
      {
        property: "og:description",
        content: "Instale o Quero Bis e peça em 2 toques. Rápido, offline e com Bis Recompensas.",
      },
    ],
  }),
  component: BaixarAppPage,
});

function BaixarAppPage() {
  return (
    <main className="min-h-screen bg-[#1a0a2e] text-white">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-[#1a0a2e]/80 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-fredoka text-lg">Baixar aplicativo</h1>
      </header>

      <AppDownloadSection />
    </main>
  );
}
