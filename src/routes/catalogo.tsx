import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listProdutos } from "@/lib/ecommerce.functions";
import { SITE, ogMeta, canonicalLink } from "@/lib/seo";
import { ShoppingBasket, Search, Filter, Package, ShoppingCart } from "lucide-react";

const opts = queryOptions({ queryKey: ["produtos"], queryFn: () => listProdutos() });

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo de Produtos — CestaFácil" },
      {
        name: "description",
        content: "Explore nosso catálogo completo de itens selecionados para sua cesta.",
      },
      ...ogMeta({
        title: "Catálogo de Produtos — CestaFácil",
        description: "Explore nosso catálogo completo de itens selecionados para sua cesta.",
        url: "/catalogo",
      }),
    ],
    links: [canonicalLink("/catalogo")],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(opts);
  },
  component: Page,
});

function Page() {
  const { data: produtos } = useSuspenseQuery(opts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const cats = new Set(produtos.map((p: any) => p.categoria?.nome).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [produtos]);

  const filtered = useMemo(() => {
    return produtos.filter((p: any) => {
      const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "all" || p.categoria?.nome === category;
      return matchSearch && matchCat;
    });
  }, [produtos, search, category]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <AppShell>
      <div className="pt-24 pb-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <header className="mb-10 space-y-4">
            <h1 className="text-4xl font-display uppercase">Nosso Catálogo</h1>
            <p className="text-muted-foreground">Itens individuais para complementar sua compra ou montar sua própria cesta.</p>
          </header>

          <div className="flex flex-col md:flex-row gap-4 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 h-12 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`h-12 px-6 rounded-xl font-bold text-sm whitespace-nowrap border transition-all ${
                    category === cat
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                      : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {cat === "all" ? "Todos" : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filtered.map((produto: any) => (
              <div key={produto.id} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all flex flex-col">
                <div className="aspect-square bg-muted/30 relative flex items-center justify-center overflow-hidden">
                  {produto.foto_url ? (
                    <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <ShoppingBasket className="w-12 h-12 text-muted-foreground/20" />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="h-8 w-8 bg-primary text-primary-foreground rounded-lg shadow-lg flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">{produto.categoria?.nome}</span>
                    <h3 className="font-bold text-sm text-white line-clamp-2 leading-tight">{produto.nome}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase mt-1">{produto.unidade_medida}</p>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-black text-white">{formatCurrency(produto.preco)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-20 text-center border border-dashed rounded-3xl">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum produto encontrado com esses filtros.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
