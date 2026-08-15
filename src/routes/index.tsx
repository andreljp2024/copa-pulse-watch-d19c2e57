import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { SITE, ogMeta, canonicalLink, jsonLd } from "@/lib/seo";
import { getCatalog } from "@/lib/ecommerce.functions";
import { ShoppingBasket, Truck, ShieldCheck, Heart, ArrowRight, Package } from "lucide-react";

const catalogOpts = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  refetchInterval: 60_000,
  staleTime: 30_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE.titleTemplate("Cestas Básicas e Kits de Alimentos") },
      {
        name: "description",
        content: SITE.description,
      },
      ...ogMeta({
        title: SITE.titleTemplate("Cestas Básicas e Kits de Alimentos"),
        description: SITE.description,
        url: "/",
      }),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "Store",
        name: "CestaFácil",
        description: SITE.description,
        url: SITE.domain,
        inLanguage: "pt-BR",
      }),
    ],
    links: [canonicalLink("/")],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(catalogOpts);
  },
  component: LandingPage,
});

function LandingPage() {
  const { data } = useSuspenseQuery(catalogOpts);

  return (
    <AppShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-hero grain pt-20 pb-16 lg:pt-32 lg:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary backdrop-blur-md">
                <Heart className="h-3.5 w-3.5 fill-primary" />
                Cuidado para sua família
              </div>
              
              <h1 className="font-display uppercase text-white leading-[0.95] [font-size:clamp(2.5rem,7vw,5rem)]">
                QUALIDADE & <br />
                <span className="text-gradient-gold">ECONOMIA</span>
              </h1>
              
              <p className="max-w-xl text-lg md:text-xl leading-relaxed text-muted-foreground">
                Cestas básicas completas e kits de alimentação direto na sua porta. 
                Economize tempo e dinheiro com produtos selecionados.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/catalogo"
                  className="inline-flex h-14 items-center justify-center rounded-xl bg-gradient-gold px-10 text-base font-black uppercase tracking-tight text-gold-foreground shadow-gold transition-all hover:scale-105 active:scale-95"
                >
                  Ver Catálogo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex h-14 items-center justify-center rounded-xl border border-border bg-card/40 px-10 text-base font-black uppercase tracking-tight text-foreground backdrop-blur transition-colors hover:bg-card/60"
                >
                  Monte a Sua
                </Link>

              </div>

              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  Entrega Grátis*
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Garantia de Qualidade
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-50 animate-pulse" />
              <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-2xl p-6 aspect-square flex items-center justify-center">
                 <ShoppingBasket className="w-64 h-64 text-primary/20 absolute" />
                 <div className="text-center relative">
                    <Package className="w-24 h-24 text-primary mx-auto mb-6" />
                    <h3 className="text-4xl font-display uppercase">Cesta Premium</h3>
                    <p className="text-gold text-2xl font-black mt-2">R$ 289,90</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      <span className="px-3 py-1 bg-muted rounded-full text-xs font-bold uppercase">58 Itens</span>
                      <span className="px-3 py-1 bg-muted rounded-full text-xs font-bold uppercase">Família Grande</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Cestas */}
      <section className="py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="font-display text-4xl uppercase mb-4">Nossas Cestas</h2>
              <p className="text-muted-foreground text-lg">Opções que se adaptam à sua necessidade e bolso.</p>
            </div>
            <Link to="/catalogo" className="text-primary font-bold flex items-center gap-2 hover:underline">
              Ver todas as opções <ArrowRight className="h-4 w-4" />
            </Link>

          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {data.cestas.length === 0 ? (
              <div className="col-span-full py-20 text-center border border-dashed rounded-3xl">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Em breve, novas cestas disponíveis.</p>
              </div>
            ) : (
              data.cestas.map((cesta: any) => (
                <div key={cesta.id} className="group rounded-3xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all card-elevated">
                  <div className="aspect-[4/3] bg-muted relative flex items-center justify-center overflow-hidden">
                    {cesta.foto_url ? (
                      <img src={cesta.foto_url} alt={cesta.nome} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <ShoppingBasket className="h-20 w-20 text-muted-foreground/30" />
                    )}
                    <div className="absolute top-4 left-4">
                       <span className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-black uppercase rounded-full tracking-tighter">
                          Destaque
                       </span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <h3 className="text-2xl font-display uppercase">{cesta.nome}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{cesta.descricao}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-2xl font-black text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cesta.preco_base)}
                      </span>
                      <Link 
                        to="/cesta/$slug"
                        params={{ slug: cesta.slug }}
                        className="h-10 px-5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold uppercase flex items-center hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        Detalhes
                      </Link>

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-card border-y border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-2 md:grid-cols-3 gap-8">
          <div className="text-center">
            <p className="font-stats text-5xl text-primary">{data.stats.items}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Produtos Ativos</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="font-stats text-5xl text-primary">{data.stats.orders}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Pedidos Entregues</p>
          </div>
          <div className="text-center">
            <p className="font-stats text-5xl text-primary">{data.stats.stores}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Unidades Parceiras</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
