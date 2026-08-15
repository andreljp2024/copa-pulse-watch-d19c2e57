import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getCesta } from "@/lib/ecommerce.functions";
import { SITE, ogMeta, canonicalLink } from "@/lib/seo";
import { ShoppingBasket, Truck, ShieldCheck, Heart, ArrowRight, Package, Info, CheckCircle2 } from "lucide-react";

const cestaOpts = (slug: string) =>
  queryOptions({
    queryKey: ["cesta", slug],
    queryFn: () => getCesta({ data: { slug } }),

    staleTime: 30_000,
  });

export const Route = createFileRoute("/cesta/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(cestaOpts(params.slug)),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const title = SITE.titleTemplate(loaderData.nome);
    const desc = loaderData.descricao || `Conheça a ${loaderData.nome} da CestaFácil.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        ...ogMeta({
          title,
          description: desc,
          image: loaderData.foto_url ?? undefined,
          url: `/cesta/${loaderData.slug}`,
        }),
      ],
      links: [canonicalLink(`/cesta/${loaderData.slug}`)],
    };
  },
  component: CestaPage,
});

function CestaPage() {
  const { slug } = Route.useParams();
  const { data: cesta } = useSuspenseQuery(cestaOpts(slug));

  if (!cesta) return null;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <AppShell>
      <div className="pt-24 pb-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Gallery/Image */}
            <div className="space-y-6">
              <div className="aspect-square bg-card border border-border rounded-3xl overflow-hidden flex items-center justify-center relative">
                {cesta.foto_url ? (
                  <img src={cesta.foto_url} alt={cesta.nome} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBasket className="w-32 h-32 text-muted-foreground/20" />
                )}
                {cesta.preco_promocional && (
                  <div className="absolute top-6 right-6">
                    <span className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-black uppercase tracking-tighter shadow-xl">
                      Oferta Especial
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                  <Package className="h-4 w-4" />
                  Cesta de Alimentos
                </div>
                <h1 className="text-4xl sm:text-5xl font-display uppercase leading-none">{cesta.nome}</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {cesta.descricao}
                </p>
              </div>

              <div className="p-6 bg-card border border-border rounded-2xl space-y-6">
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl font-black text-white">
                    {formatCurrency(cesta.preco_promocional || cesta.preco_base)}
                  </span>
                  {cesta.preco_promocional && (
                    <span className="text-xl text-muted-foreground line-through">
                      {formatCurrency(cesta.preco_base)}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Em estoque - Pronta entrega
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    Entrega estimada em 24h a 48h
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button className="flex-1 h-14 bg-gradient-gold text-gold-foreground rounded-xl font-black uppercase tracking-tight shadow-gold hover:scale-[1.02] transition-all">
                    Adicionar ao Carrinho
                  </button>
                  {cesta.permite_personalizacao && (
                    <Link
                      to="/"
                      className="h-14 px-8 border border-border bg-background rounded-xl font-black uppercase tracking-tight flex items-center justify-center hover:bg-card transition-colors"
                    >
                      Personalizar
                    </Link>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Info className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-display uppercase">Composição da Cesta</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {cesta.itens && cesta.itens.length > 0 ? (
                    cesta.itens.map((item: any) => (
                      <div key={item.produto.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                        <div className="h-10 w-10 rounded-lg bg-card flex items-center justify-center font-bold text-primary text-sm">
                          {item.quantidade}x
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{item.produto.nome}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{item.produto.unidade_medida}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm col-span-full italic">Composição detalhada em breve.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
