import { createFileRoute, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL = "https://querobis.lovable.app";

function toAbsolute(url: string | null | undefined) {
  if (!url) return `${SITE_URL}/pwa-512.png`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return `${SITE_URL}/${url}`;
}

type ProductMeta = {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  category: string;
};

export const Route = createFileRoute("/produto/$id")({
  loader: async ({ params }): Promise<ProductMeta> => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,description,image_url,hero_image_url,base_price,category")
      .eq("id", params.id)
      .maybeSingle();

    if (error || !data) {
      // Fallback: ainda renderiza head genérico + redireciona no cliente
      return {
        id: params.id,
        name: "Quero Bis — Cardápio",
        description: "Sorvetes, açaí e milk shakes. Peça pelo WhatsApp.",
        image: `${SITE_URL}/pwa-512.png`,
        price: 0,
        category: "",
      };
    }

    const rawImg = (data.hero_image_url as string) || (data.image_url as string) || "";
    return {
      id: String(data.id),
      name: String(data.name ?? "Quero Bis"),
      description: String(data.description ?? "Peça pelo WhatsApp da Quero Bis."),
      image: toAbsolute(rawImg),
      price: Number(data.base_price ?? 0),
      category: String(data.category ?? ""),
    };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData;
    const url = `${SITE_URL}/produto/${params.id}`;
    const priceLabel =
      p && p.price > 0
        ? ` — a partir de R$ ${p.price.toFixed(2).replace(".", ",")}`
        : "";
    const title = p ? `${p.name} · Quero Bis${priceLabel}` : "Quero Bis";
    const description = p?.description || "Peça pelo WhatsApp da Quero Bis.";
    const image = p?.image ?? `${SITE_URL}/pwa-512.png`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:image:secure_url", content: image },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "1200" },
        { property: "og:image:alt", content: p?.name ?? "Quero Bis" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
        ...(p && p.price > 0
          ? [
              { property: "product:price:amount", content: p.price.toFixed(2) },
              { property: "product:price:currency", content: "BRL" },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.name,
                description: p.description,
                image: [p.image],
                url,
                brand: { "@type": "Brand", name: "Quero Bis" },
                ...(p.price > 0 && {
                  offers: {
                    "@type": "Offer",
                    price: p.price.toFixed(2),
                    priceCurrency: "BRL",
                    availability: "https://schema.org/InStock",
                    url,
                  },
                }),
              }),
            },
          ]
        : undefined,
    };
  },
  component: ProductPreviewPage,
});

function ProductPreviewPage() {
  const { id } = Route.useParams();
  const p = Route.useLoaderData();

  // Usuários reais são redirecionados imediatamente para o cardápio com o
  // modal do produto aberto. Bots (WhatsApp/Facebook/Twitter) já pegaram o
  // HTML SSR com os og:tags corretos antes desta navegação.
  return (
    <>
      <Navigate to="/" search={{ produto: id }} replace />
      <div className="min-h-screen bg-[#2a1240] px-4 py-10 text-white">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <img
            src={p.image}
            alt={p.name}
            width={320}
            height={320}
            className="h-64 w-64 rounded-3xl object-contain"
          />
          <h1 className="mt-6 text-2xl font-bold">{p.name}</h1>
          {p.description && (
            <p className="mt-2 text-sm text-white/70">{p.description}</p>
          )}
          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#2a1240]"
          >
            Ver no cardápio
          </a>
        </div>
      </div>
    </>
  );
}
