import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Trophy, MessageCircle, BarChart3, Crown, Smartphone, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LIMITE_PALPITES_FREE, buildDevWhatsAppLink } from "@/lib/saas";
import heroCopa from "@/assets/hero-copa.jpg";

export const Route = createFileRoute("/criar-bolao")({
  head: () => ({
    meta: [
      { title: "Bolão AI — Cortesia para torcedores brasileiros rumo ao Hexa 🇧🇷" },
      {
        name: "description",
        content:
          "Bolão AI não é bets. É cortesia de Dev para torcedores brasileiros juntarem amigos e parentes e fazerem seus próprios palpites na Copa 2026.",
      },
      { property: "og:title", content: "Bolão AI — Cortesia para torcedores brasileiros" },
      {
        property: "og:description",
        content:
          "Junte amigos e parentes, faça seus palpites e torça pelo Hexa. Sem apostas, sem taxas escondidas — só torcida.",
      },
    ],
  }),
  component: LandingPage,
});

const benefits = [
  { icon: Heart, title: "Cortesia de Dev", desc: "Feito por torcedor, para torcedor. Não é bets — é bolão entre amigos." },
  { icon: MessageCircle, title: "Pix por WhatsApp", desc: "Links prontos com seus dados Pix em cada palpite." },
  { icon: BarChart3, title: "Gestão de palpites", desc: "Painel para confirmar pagamentos e acompanhar tudo." },
  { icon: Trophy, title: "Resultados automáticos", desc: "Jogos da Copa 2026 sincronizados pela plataforma." },
  { icon: Crown, title: "Ranking de ganhadores", desc: "Veja quem acertou e divulgue os campeões." },
  { icon: Smartphone, title: "Painel mobile-first", desc: "Funciona perfeitamente no celular do administrador." },
];

const devMsg = `Olá! Quero conversar sobre limites maiores de palpites no Bolão AI. 🏆⚽`;
const devLink = buildDevWhatsAppLink(devMsg);

const faq = [
  {
    q: "Bolão AI é uma casa de apostas?",
    a: "Não! Bolão AI NÃO é bets. É uma cortesia de Dev para torcedores brasileiros juntarem amigos e parentes e fazerem seus próprios palpites com espírito de torcedor rumo ao Hexa 🇧🇷.",
  },
  {
    q: "Preciso pagar para começar?",
    a: `Não. O plano Grátis libera todos os recursos com até ${LIMITE_PALPITES_FREE} palpites. Quando precisar de mais, é só falar com o Dev no WhatsApp.`,
  },
  {
    q: "Como recebo os pagamentos?",
    a: "Você cadastra seu Pix uma única vez. A plataforma gera links de WhatsApp com seus dados Pix em cada palpite — o dinheiro cai direto na sua conta.",
  },
  {
    q: "Quem cuida dos jogos da Copa?",
    a: "A plataforma sincroniza automaticamente os jogos da Copa 2026. Você só gerencia palpites e pagamentos com sua turma.",
  },
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
            <span className="font-display text-xl tracking-wide">
              Bolão AI <span className="text-gold">SaaS</span>
            </span>
          </Link>
          <Link
            to={ctaTo}
            className="inline-flex h-10 items-center rounded-full bg-gradient-gold px-5 text-sm font-bold text-gold-foreground shadow-gold"
          >
            Criar meu bolão
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 pitch-lines opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-card/60 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold backdrop-blur">
            <Heart className="h-3.5 w-3.5" /> Cortesia de Dev · Rumo ao Hexa 🇧🇷
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.95] tracking-tight md:text-7xl lg:text-8xl">
            <span className="text-gradient-gold">Bolão AI</span> não é bets.
            <br />
            É bolão entre <span className="text-gradient-gold">amigos.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Uma cortesia de Dev para os torcedores brasileiros juntarem amigos e parentes e fazerem
            seus próprios palpites na Copa 2026 — com o espírito de quem torce pelo Hexa 💚💛.
            Sem apostas, sem taxas escondidas: só torcida.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to={ctaTo}
              className="inline-flex h-12 items-center rounded-full bg-gradient-gold px-7 text-base font-bold text-gold-foreground shadow-gold hover:opacity-95"
            >
              Criar meu bolão grátis
            </Link>
            <a
              href="#planos"
              className="inline-flex h-12 items-center rounded-full border border-border bg-card/60 px-7 text-base font-semibold backdrop-blur hover:bg-card"
            >
              Ver planos
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-gold/30 bg-card/60 p-6 md:p-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold">
            <Heart className="h-3.5 w-3.5" /> Você é o organizador da sua turma
          </span>
          <h2 className="mt-4 font-display text-3xl md:text-4xl tracking-tight">
            Bolão entre amigos, do seu jeito 🤝⚽
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg leading-relaxed">
            🧑‍💼 <strong>Todos os contatos são do organizador.</strong> 🔧 <strong>Todos os parâmetros são do organizador.</strong>
            {" "}Junte amigos e familiares e <strong>vamos torcer juntos</strong> 💚💛! 🎉
          </p>
          <p className="mt-3 text-muted-foreground md:text-lg leading-relaxed">
            💰 Os valores dos palpites são apenas uma forma de <strong>custear a confraternização
            do torcedor</strong> 🍻🍿 — ficando <strong>apenas o organizador responsável pela sua
            própria turma</strong>. Bolão AI é cortesia de Dev, <strong>não é bets</strong> 🚫🎰.
          </p>
        </div>
      </section>




      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-center">
          Tudo o que você precisa
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-pitch/10 text-pitch">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-lg">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="planos" className="bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-center">
            Planos simples e honestos
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Comece grátis com todos os recursos. Precisou de mais? Fale com o Dev.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
            <article className="rounded-2xl border border-pitch ring-2 ring-pitch/30 bg-card p-6 flex flex-col">
              <span className="self-start mb-2 rounded-full bg-pitch px-2 py-0.5 text-xs font-bold text-primary-foreground">
                Recomendado
              </span>
              <h3 className="text-2xl font-black">Grátis</h3>
              <div className="mt-2 text-4xl font-black text-pitch">
                R$ 0<span className="text-sm font-medium text-muted-foreground">/sempre</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Todos os recursos, até {LIMITE_PALPITES_FREE} palpites no total.
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {[
                  `Até ${LIMITE_PALPITES_FREE} palpites no total`,
                  "Todos os recursos liberados",
                  "Pix por WhatsApp",
                  "Ranking e ganhadores automáticos",
                  "Resultados oficiais da Copa 2026",
                  "Painel mobile-first",
                ].map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-pitch shrink-0 mt-0.5" /> <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={ctaTo}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-gradient-gold px-4 text-sm font-bold text-gold-foreground shadow-gold"
              >
                Começar grátis
              </Link>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <span className="self-start mb-2 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">
                Bolão maior
              </span>
              <h3 className="text-2xl font-black">Consulte o Dev</h3>
              <div className="mt-2 text-4xl font-black text-gold">Sob consulta 👍</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Para bolões acima de {LIMITE_PALPITES_FREE} palpites, fale direto no WhatsApp.
              </p>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                👍 O Dev é especialista em <strong>redes de computadores</strong>, <strong>análise
                de sistemas</strong>, <strong>segurança cibernética</strong> e <strong>segurança
                eletrônica</strong> para o mercado corporativo — atendimento <strong>sob
                demanda</strong>.
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {[
                  "Limites maiores de palpites",
                  "Acompanhamento personalizado",
                  "Suporte direto com o Dev",
                  "Atendimento humano por WhatsApp",
                ].map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-gold shrink-0 mt-0.5" /> <span>{it}</span>
                  </li>
                ))}
              </ul>
              <a
                href={devLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-pitch px-4 text-sm font-bold text-primary-foreground"
              >
                <MessageCircle className="h-4 w-4" /> Falar com o Dev
              </a>
            </article>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-center">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            to={ctaTo}
            className="inline-flex h-12 items-center rounded-xl bg-pitch px-8 text-base font-bold text-primary-foreground"
          >
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
