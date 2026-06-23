import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { friendlyError } from "@/lib/errors";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — CopaHub" }] }),
  component: Page,
});

const signinSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(255),
  pwd: z.string().min(6, "A senha precisa ter ao menos 6 caracteres.").max(72),
});
const signupSchema = signinSchema.extend({
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/admin" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/admin" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = (mode === "signup" ? signupSchema : signinSchema).safeParse({ email, pwd, name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.pwd,
          options: { emailRedirectTo: window.location.origin + "/admin", data: { name: (parsed.data as any).name } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.pwd,
        });
        if (error) throw error;
      }
      navigate({ to: "/admin" });
    } catch (err) {
      setError(friendlyError(err, "Não foi possível autenticar."));
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/admin" });
      if (res.error) throw res.error;
    } catch (err) {
      setError(friendlyError(err, "Falha ao entrar com Google."));
    }
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
