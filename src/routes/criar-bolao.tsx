import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Trophy, MessageCircle, BarChart3, Crown, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/criar-bolao")({
  head: () => ({
    meta: [
      { title: "Crie seu Bolão da Copa 2026 em minutos" },
      { name: "description", content: "Plataforma SaaS para administrar bolões da Copa 2026: Pix por WhatsApp, palpites, resultados automáticos e ranking de ganhadores." },
      { property: "og:title", content: "Crie seu Bolão da Copa 2026 em minutos" },
      { property: "og:description", content: "Cadastre participantes, receba Pix, controle palpites e descubra ganhadores automaticamente." },
    ],
  }),
  component: LandingPage,
});

const benefits = [
  { icon: MessageCircle, title: "Pix por WhatsApp", desc: "Links prontos com seus dados Pix em cada palpite." },
  { icon: BarChart3, title: "Gestão de palpites", desc: "Painel para confirmar pagamentos e acompanhar tudo." },
  { icon: Trophy, title: "Resultados automáticos", desc: "Jogos da Copa 2026 sincronizados pela plataforma." },
  { icon: Crown, title: "Ranking de ganhadores", desc: "Veja quem acertou e divulgue os campeões." },
  { icon: Smartphone, title: "Painel mobile-first", desc: "Funciona perfeitamente no celular do administrador." },
];

const plans = [
  { nome: "Grátis", preco: "R$ 0", destaque: false, items: ["Até 50 palpites", "1 bolão ativo", "Pix por WhatsApp", "Resultados automáticos"] },
  { nome: "Intermediário", preco: "R$ 99,90", destaque: true, items: ["Até 100 palpites", "Bolões ilimitados", "Logo personalizada", "Exportação CSV", "Ranking de ganhadores"] },
  { nome: "Ilimitado", preco: "R$ 149,90", destaque: false, items: ["Palpites ilimitados", "Bolões ilimitados", "WhatsApp API", "Domínio personalizado", "Suporte prioritário"] },
];

const faq = [
  { q: "Preciso pagar para começar?", a: "Não. O plano Grátis permite até 1 bolão com 50 torcedores. Você pode evoluir quando quiser." },
  { q: "Como recebo os pagamentos?", a: "Você cadastra seu Pix uma única vez. A plataforma gera links de WhatsApp com seus dados em cada palpite." },
  { q: "Quem cuida dos jogos da Copa?", a: "A plataforma sincroniza automaticamente os 72 jogos da Copa 2026. Você só gerencia palpites e pagamentos." },
];

function LandingPage() {
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSigned(!!data.user));
  }, []);
  const ctaTo = signed ? "/onboarding" : "/auth";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-pitch shadow-glow">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl tracking-wide">Bolão AI <span className="text-gold">SaaS</span></span>
          </Link>
          <Link to={ctaTo} className="inline-flex h-10 items-center rounded-full bg-gradient-gold px-5 text-sm font-bold text-gold-foreground shadow-gold">
            Criar meu bolão
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 pitch-lines opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Trophy className="h-3.5 w-3.5 text-gold" /> Plataforma oficial multiempresa · Copa do Mundo 2026
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.95] tracking-tight md:text-7xl lg:text-8xl">
            Crie seu <span className="text-gradient-gold">Bolão da Copa</span><br />em minutos
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Cadastre participantes, receba via Pix, controle palpites pelo WhatsApp e descubra os ganhadores automaticamente.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to={ctaTo} className="inline-flex h-12 items-center rounded-full bg-gradient-gold px-7 text-base font-bold text-gold-foreground shadow-gold hover:opacity-95">
              Criar meu bolão grátis
            </Link>
            <a href="#planos" className="inline-flex h-12 items-center rounded-full border border-border bg-card/60 px-7 text-base font-semibold backdrop-blur hover:bg-card">
              Ver planos
            </a>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-center">Tudo o que você precisa</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-pitch/10 text-pitch"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-bold text-lg">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="planos" className="bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-center">Planos para todo bolão</h2>
          <p className="mt-2 text-center text-muted-foreground">Comece grátis. Faça upgrade quando seu bolão crescer.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((p) => (
              <div key={p.nome} className={`rounded-2xl border bg-card p-6 flex flex-col ${p.destaque ? "border-pitch ring-2 ring-pitch/30" : "border-border"}`}>
                {p.destaque && <span className="self-start mb-2 rounded-full bg-pitch px-2 py-0.5 text-xs font-bold text-primary-foreground">Mais popular</span>}
                <h3 className="text-xl font-black">{p.nome}</h3>
                <div className="mt-2 text-3xl font-black text-pitch">{p.preco}<span className="text-sm font-medium text-muted-foreground">/mês</span></div>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2"><Check className="h-4 w-4 text-pitch shrink-0 mt-0.5" /> <span>{it}</span></li>
                  ))}
                </ul>
                <Link to={ctaTo} className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-pitch px-4 text-sm font-semibold text-primary-foreground">
                  Começar
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-center">Perguntas frequentes</h2>
        <div className="mt-8 space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to={ctaTo} className="inline-flex h-12 items-center rounded-xl bg-pitch px-8 text-base font-bold text-primary-foreground">
            Criar meu bolão agora
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © Bolão AI SaaS — Bolão Copa 2026.
      </footer>
    </div>
  );
}
