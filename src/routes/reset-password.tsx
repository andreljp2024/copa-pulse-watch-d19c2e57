import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Bolão AI" }] }),
  component: Page,
});

const schema = z.object({
  pwd: z.string().min(6, "A senha precisa ter ao menos 6 caracteres.").max(72),
  confirm: z.string(),
}).refine((d) => d.pwd === d.confirm, { path: ["confirm"], message: "As senhas não coincidem." });

function Page() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // Supabase entrega tokens no hash em fluxos de recovery; o client processa automaticamente.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const parsed = schema.safeParse({ pwd, confirm });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.pwd });
      if (error) throw error;
      setInfo("Senha atualizada! Redirecionando…");
      setTimeout(() => navigate({ to: "/admin" }), 1200);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível redefinir a senha."));
    } finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-pitch text-primary-foreground"><KeyRound className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-black">Redefinir senha</h1>
            <p className="text-sm text-muted-foreground">Defina uma nova senha de acesso</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 card-elevated">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Validando link de recuperação… Abra esta página pelo link enviado por e-mail.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <input required type="password" minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Nova senha" className="w-full h-11 rounded-lg border border-border bg-background px-3" />
              <input required type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirme a nova senha" className="w-full h-11 rounded-lg border border-border bg-background px-3" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              {info && <p className="text-sm text-pitch font-medium">{info}</p>}
              <button disabled={loading} className="w-full h-11 rounded-lg bg-pitch text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50">
                {loading ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
