import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listPlanos } from "@/lib/planos.functions";
import { Check, Trophy } from "lucide-react";

const planosOpts = queryOptions({ queryKey: ["planos-publicos"], queryFn: () => listPlanos() });

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — CopaHub" },
      { name: "description", content: "Escolha o plano ideal para o seu bolão da Copa 2026: Grátis, Intermediário ou Ilimitado." },
      { property: "og:title", content: "Planos CopaHub" },
      { property: "og:description", content: "Planos a partir de R$ 0 — até 50 palpites grátis." },
    ],
  }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(planosOpts); },
  component: Planos,
  errorComponent: () => <div className="p-8 text-center text-muted-foreground">Erro ao carregar planos.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Não encontrado.</div>,
});

function fmtBRL(v: number) {
  return v === 0 ? "Grátis" : `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function Planos() {
  const { data: planos } = useSuspenseQuery(planosOpts);

  return (
    <AppShell>
      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background pointer-events-none" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Planos CopaHub
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl uppercase leading-[0.95]">
            Escolha o plano <span className="text-gradient-gold">do seu bolão</span>
          </h1>
          <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
            Comece grátis com até 50 palpites. Escale conforme o seu bolão cresce.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {planos.map((p, i) => {
            const destaque = i === 1;
            const palpites = p.limite_palpites === null ? "Palpites ilimitados" : `Até ${p.limite_palpites} palpites`;
            return (
              <article
                key={p.id}
                className={`relative rounded-2xl border p-8 flex flex-col ${destaque ? "border-gold/60 bg-card shadow-gold" : "border-border bg-card"}`}
              >
                {destaque && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-gold px-3 py-1 text-xs font-black uppercase tracking-widest text-gold-foreground">
                    Mais popular
                  </span>
                )}
                <h2 className="font-display text-3xl uppercase">{p.nome}</h2>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl text-gold">{fmtBRL(Number(p.preco))}</span>
                  {Number(p.preco) > 0 && <span className="text-sm text-muted-foreground">/mês</span>}
                </div>
                <ul className="mt-6 space-y-3 text-sm flex-1">
                  <Feature>{palpites}</Feature>
                  {p.limite_boloes != null && <Feature>{p.limite_boloes} {p.limite_boloes === 1 ? "bolão" : "bolões"}</Feature>}
                  {p.limite_torcedores != null && <Feature>Até {p.limite_torcedores} torcedores</Feature>}
                  {p.permite_logo && <Feature>Logo personalizada</Feature>}
                  {p.permite_exportacao && <Feature>Exportação de dados</Feature>}
                  {p.permite_whatsapp_api && <Feature>Integração WhatsApp</Feature>}
                  {p.permite_dominio_personalizado && <Feature>Domínio personalizado</Feature>}
                </ul>
                <Link
                  to="/criar-bolao"
                  className={`mt-8 inline-flex h-12 items-center justify-center rounded-sm px-6 text-sm font-black uppercase tracking-tight transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                    destaque
                      ? "bg-gradient-gold text-gold-foreground shadow-gold"
                      : "border border-border bg-card/40 text-foreground hover:bg-card/70"
                  }`}
                >
                  {Number(p.preco) === 0 ? "Começar Grátis" : "Assinar"}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
