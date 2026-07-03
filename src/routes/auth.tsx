import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Bolão dos Amigos Brasileiros" }] }),
  component: Page,
});

// WhatsApp do administrador (98) 98603-0534 — recebe aviso a cada novo organizador
const ADMIN_WHATSAPP = "5598986030534";

type Mode = "login" | "signup";

function Page() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/app" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(friendlyError(err, "Falha ao entrar."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!accepted) {
      setError("Você precisa confirmar o termo antes de se cadastrar.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    const whatsDigits = whatsapp.replace(/\D/g, "");
    if (whatsDigits.length < 10) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: nome, whatsapp: whatsDigits },
        },
      });
      if (error) throw error;

      // Abre WhatsApp para o administrador com aviso do novo organizador
      const msg =
        `🆕 Novo organizador cadastrado no Bolão dos Amigos Brasileiros\n\n` +
        `👤 Nome: ${nome}\n` +
        `📧 E-mail: ${email}\n` +
        `📱 WhatsApp: ${whatsapp}\n\n` +
        `Cadastro realizado em ${new Date().toLocaleString("pt-BR")}.`;
      const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank", "noopener,noreferrer");

      setInfo("Cadastro concluído! Você será redirecionado ao painel.");
    } catch (err) {
      setError(friendlyError(err, "Falha ao cadastrar organizador."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-pitch text-primary-foreground">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Bolão dos Amigos Brasileiros</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Entre com e-mail e senha" : "Cadastre-se como organizador"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); setInfo(null); }}
            className={`h-10 rounded-lg font-bold transition ${
              mode === "login" ? "bg-pitch text-primary-foreground" : "bg-muted text-foreground/70"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
            className={`h-10 rounded-lg font-bold transition ${
              mode === "signup" ? "bg-pitch text-primary-foreground" : "bg-muted text-foreground/70"
            }`}
          >
            Cadastrar
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-elevated space-y-5">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg bg-pitch text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 transition"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-foreground/90 space-y-2">
                <p className="font-semibold">Termo de participação</p>
                <p>
                  Ao me cadastrar como organizador, confirmo que sou{" "}
                  <strong>maior de 18 anos</strong> e que o bolão é entre amigos convidados,
                  também maiores de idade. O <strong>PIX pessoal</strong> serve apenas para
                  organizar palpites entre amigos — <strong>não é aposta e não visa lucro</strong>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nome completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp (com DDD)</label>
                <input
                  type="tel"
                  required
                  placeholder="(98) 98603-0534"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Senha (mín. 8 caracteres)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => { setAccepted(e.target.checked); setError(null); }}
                  className="mt-1 h-5 w-5 accent-pitch"
                />
                <span className="text-sm">
                  Sou maior de <strong>18 anos</strong> e concordo com o termo acima.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg bg-pitch text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 transition"
              >
                {loading ? "Cadastrando…" : "Cadastrar e avisar administrador"}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Ao finalizar, uma mensagem no WhatsApp será aberta para avisar o administrador.
              </p>
            </form>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}
        </div>
      </div>
    </AppShell>
  );
}
