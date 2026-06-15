import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — CopaHub" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/admin" }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password: pwd,
          options: { emailRedirectTo: window.location.origin + "/admin", data: { name } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
      }
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err.message ?? "Erro ao autenticar");
    } finally { setLoading(false); }
  }

  async function google() {
    setError(null);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/admin" });
    if (res.error) setError((res.error as any).message ?? "Erro no Google");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-pitch text-primary-foreground"><Trophy className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-black">Entrar no CopaHub</h1>
            <p className="text-sm text-muted-foreground">Acesse o painel administrativo</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 card-elevated">
          <div className="flex gap-1 rounded-lg bg-muted p-1 mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === m ? "bg-card shadow" : "text-muted-foreground"}`}>
                {m === "signin" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>
          <button onClick={google} className="w-full h-11 mb-4 rounded-lg border border-border bg-background font-semibold hover:bg-muted">
            Continuar com Google
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4"><div className="flex-1 h-px bg-border" />ou<div className="flex-1 h-px bg-border" /></div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full h-11 rounded-lg border border-border bg-background px-3" />
            )}
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="w-full h-11 rounded-lg border border-border bg-background px-3" />
            <input required type="password" minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Senha (mínimo 6 caracteres)" className="w-full h-11 rounded-lg border border-border bg-background px-3" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button disabled={loading} className="w-full h-11 rounded-lg bg-pitch text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50">
              {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
