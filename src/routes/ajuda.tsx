import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  MessageCircle,
  UserPlus,
  CreditCard,
  Smartphone,
  Trophy,
  HelpCircle,
  Shield,
  BarChart3,
  CalendarDays,
  Users,
  Bell,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/ajuda")({
  head: () => ({ meta: [{ title: "Ajuda — Bolão AI" }] }),
  component: HelpPage,
});

const FAQ = [
  {
    icon: <UserPlus className="h-5 w-5" />,
    title: "Como criar meu bolão?",
    steps: [
      "Clique em 'Criar meu bolão' no topo da página",
      "Faça login com sua conta Google",
      "Preencha seus dados na etapa 1 (Cadastro)",
      "Configure o PIX na etapa 2 para receber pagamentos",
      "Configure o WhatsApp na etapa 3 para notificações",
      "Dê um nome ao seu bolão na etapa 4 e finalize",
    ],
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Como cadastrar torcedores?",
    steps: [
      "Acesse 'Meu painel' → 'Torcedores'",
      "Clique em 'Cadastrar torcedor'",
      "Informe nome e WhatsApp do participante",
      "O torcedor receberá um link para acessar o bolão",
      "Você pode cadastrar quantos torcedores quiser",
    ],
  },
  {
    icon: <Trophy className="h-5 w-5" />,
    title: "Como funciona a pontuação?",
    steps: [
      "Cada torcedor faz palpites para as partidas",
      "Acertar o placar EXATO: 10 pontos",
      "Acertar só o vencedor/empate: 5 pontos",
      "Errar o resultado: 0 pontos",
      "O ranking é atualizado automaticamente após cada jogo",
    ],
  },
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: "Como funciona o pagamento?",
    steps: [
      "Os torcedores pagam via PIX para fazer palpites",
      "O valor é definido por você na configuração do bolão",
      "O PIX cai direto na sua chave cadastrada",
      "Você pode conferir os pagamentos em 'Meu painel'",
    ],
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: "Notificações via WhatsApp",
    steps: [
      "Configure o número de WhatsApp na etapa 3 do cadastro",
      "Personalize as mensagens: novo palpite, confirmação, ganhador",
      "As mensagens são enviadas automaticamente",
      "O torcedor recebe confirmação no WhatsApp",
    ],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Acompanhamento ao vivo",
    steps: [
      "A página inicial mostra jogos ao vivo com placar atualizado",
      "O calendário tem filtros por status e fase",
      "A classificação dos grupos é atualizada a cada partida",
      "Os artilheiros são atualizados automaticamente via API",
    ],
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Área do Administrador",
    steps: [
      "Acesse /admin para gerenciar partidas e times",
      "Use 'Sincronizar API' para atualizar dados da Copa",
      "Edite placares manualmente se necessário",
      "Notificações de novos gestores aparecem no painel",
    ],
  },
  {
    icon: <CalendarDays className="h-5 w-5" />,
    title: "Fases da Copa",
    steps: [
      "Fase de Grupos: 48 seleções em 12 grupos (A-L)",
      "TOP 32: classificados vão para o mata-mata",
      "Oitavas, Quartas, Semi, 3º Lugar e Final",
      "Os confrontos são definidos automaticamente",
    ],
  },
];

export default function HelpPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="text-center">
          <BookOpen className="h-10 w-10 mx-auto text-pitch" />
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight">Central de Ajuda</h1>
          <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
            Tudo que você precisa saber para criar e gerenciar seu bolão da Copa do Mundo.
          </p>
        </div>

        {/* Contato direto */}
        <div className="mt-8 rounded-xl border border-pitch/30 bg-pitch/5 p-6 text-center">
          <MessageCircle className="h-8 w-8 mx-auto text-pitch" />
          <h2 className="mt-3 text-lg font-bold">Suporte direto via WhatsApp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tire suas dúvidas com o administrador
          </p>
          <a
            href="https://wa.me/5598996068024?text=Olá! Preciso de ajuda com o Bolão AI."
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            (98) 9 9606-8024 — Suporte Bolão AI
          </a>
        </div>

        {/* FAQ */}
        <div className="mt-10 space-y-6">
          {FAQ.map((item) => (
            <details
              key={item.title}
              className="group rounded-xl border border-border bg-card overflow-hidden"
            >
              <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors list-none">
                <span className="text-pitch">{item.icon}</span>
                <span className="flex-1 font-bold text-base">{item.title}</span>
                <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-4 pb-4 border-t border-border pt-3">
                <ol className="space-y-2">
                  {item.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pitch/10 text-pitch text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>

        {/* Dicas finais */}
        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <Bell className="h-6 w-6 text-pitch shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-base">Dica importante</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Os dados da Copa (partidas, resultados, artilheiros) são sincronizados
                automaticamente a cada 3 minutos com a API football-data.org. Você não precisa se
                preocupar em atualizar placares manualmente — o sistema faz tudo sozinho!
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
