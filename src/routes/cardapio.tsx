import { createFileRoute, redirect } from "@tanstack/react-router";

// Compat: o cardápio vive inline em "/". Qualquer link antigo
// (push notifications, banners, popups salvos no banco) que aponte
// para /cardapio é redirecionado para a home sem 404.
export const Route = createFileRoute("/cardapio")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
