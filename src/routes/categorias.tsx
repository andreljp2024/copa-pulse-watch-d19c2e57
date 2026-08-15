import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getCatalog } from "@/lib/ecommerce.functions";
import { SITE, ogMeta, canonicalLink } from "@/lib/seo";
import { Package, Grid } from "lucide-react";

const catalogOpts = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — CestaFácil" },
      { name: "description", content: "Explore nossos produtos por categorias." },
      ...ogMeta({ 
        title: "Categorias — CestaFácil", 
        description: "Explore nossos produtos por categorias.",
        url: "/categorias" 
      }),

    ],
    links: [canonicalLink("/categorias")],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(catalogOpts);
  },
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(catalogOpts);
  const { categorias } = data;

  return (
    <AppShell>
      <div className="pt-24 pb-16 bg-background min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <header className="mb-10 space-y-4">
            <h1 className="text-4xl font-display uppercase">Categorias</h1>
            <p className="text-muted-foreground">Navegue por nossa seleção especializada de produtos.</p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categorias.map((cat: any) => (
              <div key={cat.id} className="group bg-card border border-border rounded-3xl p-8 hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Grid className="w-48 h-48 text-primary" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display uppercase">{cat.nome}</h3>
                    <p className="text-muted-foreground text-sm mt-2">{cat.descricao || "Produtos selecionados com qualidade."}</p>
                  </div>
                  <div className="pt-4">
                     <span className="inline-flex items-center text-xs font-black uppercase tracking-tighter text-primary group-hover:gap-2 transition-all">
                        Explorar Categoria
                        <Package className="ml-1 h-3 w-3" />
                     </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {categorias.length === 0 && (
             <div className="py-20 text-center border border-dashed rounded-3xl">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Em breve, novas categorias disponíveis.</p>
             </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
