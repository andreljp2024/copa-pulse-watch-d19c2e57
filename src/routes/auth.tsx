import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { friendlyError } from "@/lib/errors";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Bolão dos Amigos Brasileiros" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/app" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function google() {
    if (!accepted) {
      setError("Você precisa confirmar o termo antes de entrar.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (res.error) throw res.error;
    } catch (err) {
      setError(friendlyError(err, "Falha ao entrar com Google."));
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
            <p className="text-sm text-muted-foreground">Entre com sua conta Google</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-elevated space-y-5">
          <div className="rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-foreground/90 space-y-2">
            <p className="font-semibold">Termo de participação</p>
            <p>
              Ao continuar, confirmo que sou <strong>maior de 18 anos</strong> e que este
              bolão é entre amigos convidados, também maiores de idade.
            </p>
            <p>
              Concordo que o <strong>PIX pessoal</strong> informado é utilizado apenas
              para organizar os palpites entre amigos. O valor tem finalidade exclusiva
              de custear a organização e o prazer brasileiro de reunir a galera para
              torcer — <strong>não é aposta e não visa lucro</strong>.
            </p>
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
            type="button"
            onClick={google}
            disabled={!accepted || loading}
            className="w-full h-12 rounded-lg bg-pitch text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "Aguarde…" : "Continuar com Google"}
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <p className="text-xs text-muted-foreground text-center">
            Somente contas <strong>@gmail.com</strong> são aceitas neste bolão.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
