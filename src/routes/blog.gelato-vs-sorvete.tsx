import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://querobis.lovable.app/blog/gelato-vs-sorvete";

export const Route = createFileRoute("/blog/gelato-vs-sorvete")({
  head: () => ({
    meta: [
      { title: "Gelato vs Sorvete: qual a diferença? | Quero Bis" },
      {
        name: "description",
        content:
          "Entenda a diferença entre gelato artesanal e sorvete tradicional: ingredientes, textura, temperatura e gordura. Guia da Quero Bis em Ouro Preto do Oeste.",
      },
      { property: "og:title", content: "Gelato vs Sorvete: qual a diferença?" },
      {
        property: "og:description",
        content:
          "Gelato ou sorvete? Comparamos ingredientes, cremosidade, gordura, ar e temperatura de servir. Guia rápido da Quero Bis.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Gelato vs Sorvete: qual a diferença?",
          inLanguage: "pt-BR",
          author: { "@type": "Organization", name: "Quero Bis Sorveteria & Açaí" },
          publisher: {
            "@type": "Organization",
            name: "Quero Bis Sorveteria & Açaí",
            url: "https://querobis.lovable.app",
          },
          mainEntityOfPage: URL,
        }),
      },
    ],
  }),
  component: Page,
});

function Row({ label, gelato, sorvete }: { label: string; gelato: string; sorvete: string }) {
  return (
    <tr className="border-b border-white/10">
      <th scope="row" className="py-3 pr-4 text-left align-top font-semibold text-white/90">
        {label}
      </th>
      <td className="py-3 pr-4 align-top text-white/80">{gelato}</td>
      <td className="py-3 align-top text-white/80">{sorvete}</td>
    </tr>
  );
}

function Page() {
  return (
    <main className="min-h-screen bg-[#1a0a2e] px-4 py-10 text-white">
      <article className="mx-auto max-w-2xl">
        <p className="mb-2 text-xs uppercase tracking-widest text-neon-cyan">Guia Quero Bis</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">
          Gelato vs Sorvete: qual a diferença entre gelato e sorvete?
        </h1>
        <p className="mt-3 text-white/70">
          Se você já se perguntou por que o gelato italiano parece mais denso e cremoso que o
          sorvete tradicional, a resposta está em três detalhes: <strong>gordura</strong>,{" "}
          <strong>ar</strong> e <strong>temperatura</strong>. Como sorveteria artesanal em Ouro
          Preto do Oeste, a gente vive essa conversa todo dia — então vale explicar.
        </p>

        <h2 className="mt-8 text-xl font-bold">O que é gelato?</h2>
        <p className="mt-2 text-white/80">
          Gelato é a sobremesa gelada tradicional italiana, feita com <strong>mais leite do que
          creme</strong>, batida devagar (menos ar incorporado) e servida em uma temperatura um
          pouco mais alta que a do sorvete comum. O resultado é uma textura densa, sedosa, com
          sabor mais intenso.
        </p>

        <h2 className="mt-8 text-xl font-bold">O que é sorvete tradicional?</h2>
        <p className="mt-2 text-white/80">
          O sorvete que a gente conhece no Brasil geralmente leva <strong>mais creme de leite</strong>,
          é batido em velocidade mais alta (incorpora mais ar) e servido bem gelado. Fica mais
          leve na boca, com aquela sensação clássica de "colher afundando fácil".
        </p>

        <h2 className="mt-8 text-xl font-bold">Tabela comparativa</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/60">
                <th className="py-3 pr-4 font-semibold">Característica</th>
                <th className="py-3 pr-4 font-semibold">Gelato</th>
                <th className="py-3 font-semibold">Sorvete</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Gordura" gelato="4–8% (mais leite)" sorvete="10–16% (mais creme)" />
              <Row label="Ar incorporado" gelato="20–35% (denso)" sorvete="50–90% (aerado)" />
              <Row
                label="Temperatura de servir"
                gelato="−12 a −14 °C"
                sorvete="−18 a −20 °C"
              />
              <Row
                label="Textura"
                gelato="Sedosa, elástica, quase mastigável"
                sorvete="Cremosa e leve, derrete rápido"
              />
              <Row
                label="Sabor"
                gelato="Mais intenso, gordura não 'cobre' o sabor"
                sorvete="Cremoso, marcante em baunilha e chocolate"
              />
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-xl font-bold">Qual escolher?</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-white/80">
          <li>
            <strong>Sabores frutados e intensos</strong> (morango, maracujá, limão siciliano)
            brilham no formato gelato.
          </li>
          <li>
            <strong>Clássicos cremosos</strong> (baunilha, doce de leite, chocolate belga)
            costumam ficar mais gostosos como sorvete.
          </li>
          <li>
            Se você quer algo <strong>mais leve para o dia quente</strong>, o sorvete tradicional
            derrete mais rápido e refresca na hora.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-bold">E o açaí, entra onde?</h2>
        <p className="mt-2 text-white/80">
          Açaí não é gelato nem sorvete: é uma polpa batida congelada, com textura própria — mais
          próxima do <em>sorbet</em>. Na Quero Bis, você{" "}
          <Link to="/" className="text-neon-cyan underline">
            monta seu açaí
          </Link>{" "}
          escolhendo frutas, cremes e complementos.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/70">
            Bateu vontade? Peça sorvetes, açaí e milk shakes em Ouro Preto do Oeste pelo{" "}
            <Link to="/" className="font-semibold text-neon-pink underline">
              cardápio digital
            </Link>
            .
          </p>
        </div>
      </article>
    </main>
  );
}
