import { createFileRoute } from "@tanstack/react-router";
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
      { property: "og:url", content: "https://querobis.lovable.app/baixar-app" },
    ],
    links: [{ rel: "canonical", href: "https://querobis.lovable.app/baixar-app" }],
  }),
  component: BaixarAppPage,
});

function BaixarAppPage() {
  return (
    <main className="min-h-screen bg-[#1a0a2e] text-white">
      <AppDownloadSection />
    </main>
  );
}
