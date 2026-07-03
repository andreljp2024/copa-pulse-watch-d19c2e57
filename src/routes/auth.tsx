import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { signInSuperAdminByWhatsApp, signUpOrganizerByWhatsApp } from "@/lib/auth.functions";
import { friendlyError } from "@/lib/errors";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Bolão dos Amigos Brasileiros" }] }),
  component: Page,
});

// WhatsApp do administrador (98) 98603-0534 — recebe aviso a cada novo organizador
const ADMIN_WHATSAPP = "5598986030534";
// Domínio sintético usado para o e-mail interno do Supabase (login é pelo WhatsApp)
const WA_EMAIL_DOMAIN = "wa.bolao.local";

type Mode = "login" | "signup";

/** Aplica máscara (DD) DDDDD-DDDD sobre os dígitos do usuário (sem o DDI 55). */
function maskWhats(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Retorna somente os dígitos (DDD+número, sem DDI). */
function onlyDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

/** Monta o e-mail sintético usado internamente. */
function toSyntheticEmail(digitsSemDDI: string): string {
  return `55${digitsSemDDI}@${WA_EMAIL_DOMAIN}`;
}

/** Máscara DD/MM/AAAA sem autocompletar — usuário digita apenas números. */
function maskDate(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function Page() {
  const navigate = useNavigate();
  const signInSuperAdmin = useServerFn(signInSuperAdminByWhatsApp);
  const signUpOrganizer = useServerFn(signUpOrganizerByWhatsApp);
  const [mode, setMode] = useState<Mode>("login");
  const [whatsMasked, setWhatsMasked] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [underageOpen, setUnderageOpen] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/app" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  function onWhatsChange(v: string) {
    setWhatsMasked(maskWhats(v));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = onlyDigits(whatsMasked);
    if (digits.length < 10) {
      setError("Informe seu WhatsApp com DDD (ex.: (98) 98603-0534).");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: toSyntheticEmail(digits),
        password,
      });
      if (error) {
        const raw = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
        if (raw.includes("email_provider_disabled") || raw.includes("email logins are disabled")) {
          const session = await signInSuperAdmin({ data: { whatsapp: `55${digits}`, password } });
          const { error: setSessionError } = await supabase.auth.setSession(session);
          if (setSessionError) throw setSessionError;
          navigate({ to: "/app" });
          return;
        }
        throw error;
      }
    } catch (err) {
      setError(friendlyError(err, "WhatsApp ou senha inválidos."));
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
    const dobDigits = birthDate.replace(/\D/g, "");
    if (dobDigits.length !== 8) {
      setError("Informe a data de nascimento no formato DD/MM/AAAA.");
      return;
    }
    const dd = Number(dobDigits.slice(0, 2));
    const mm = Number(dobDigits.slice(2, 4));
    const yyyy = Number(dobDigits.slice(4, 8));
    const dob = new Date(yyyy, mm - 1, dd);
    if (
      Number.isNaN(dob.getTime()) ||
      dob.getDate() !== dd ||
      dob.getMonth() !== mm - 1 ||
      dob.getFullYear() !== yyyy ||
      yyyy < 1900
    ) {
      setError("Data de nascimento inválida.");
      return;
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 18) {
      setBirthDate("");
      (document.activeElement as HTMLElement | null)?.blur();
      setUnderageOpen(true);
      toast.error("⚠️ Cadastro bloqueado — menor de 18 anos", {
        description: "🚫 Fale com seu responsável.",
      });
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    const digits = onlyDigits(whatsMasked);
    if (digits.length < 10) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }
    setLoading(true);
    try {
      const birth = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const session = await signUpOrganizer({
        data: { whatsapp: `55${digits}`, password, nome, birth_date: birth },
      });
      const { error: setSessionError } = await supabase.auth.setSession(session);
      if (setSessionError) throw setSessionError;


      const msg =
        `🆕 Novo organizador cadastrado no Bolão dos Amigos Brasileiros\n\n` +
        `👤 Nome: ${nome}\n` +
        `📱 WhatsApp: +55 ${whatsMasked}\n\n` +
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
              {mode === "login" ? "Entre com seu WhatsApp" : "Cadastre-se como organizador"}
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
          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-foreground/90 space-y-2">
                  <p className="font-semibold">Termo de participação</p>
                  <p>
                    Ao me cadastrar como organizador, confirmo que sou{" "}
                    <strong>maior de 18 anos</strong>. O <strong>PIX pessoal</strong> serve apenas
                    para organizar palpites entre amigos — <strong>não é aposta e não visa lucro</strong>.
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
                  <label className="block text-sm font-medium mb-1">Data de nascimento</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    value={birthDate}
                    onChange={(e) => setBirthDate(maskDate(e.target.value))}
                    className="w-full h-11 rounded-lg border border-border bg-background px-3 tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground mt-1">É necessário ter no mínimo 18 anos.</p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <div className="flex items-stretch rounded-lg border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-pitch/40">
                <span className="grid place-items-center px-3 bg-muted text-sm font-semibold text-foreground/80 select-none">
                  +55
                </span>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="(98) 98603-0534"
                  value={whatsMasked}
                  onChange={(e) => onWhatsChange(e.target.value)}
                  className="flex-1 h-11 bg-background px-3 outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">DDD + número. O DDI 55 já está incluso.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Senha{mode === "signup" ? " (mín. 8 caracteres)" : ""}
              </label>
              <input
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-lg border border-border bg-background px-3"
              />
            </div>

            {mode === "signup" && (
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-pitch text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 transition"
            >
              {loading
                ? (mode === "login" ? "Entrando…" : "Cadastrando…")
                : (mode === "login" ? "Entrar" : "Cadastrar e avisar administrador")}
            </button>

            {mode === "signup" && (
              <p className="text-xs text-muted-foreground text-center">
                Ao finalizar, uma mensagem no WhatsApp será aberta para avisar o administrador.
              </p>
            )}
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}
        </div>
      </div>

      <AlertDialog open={underageOpen} onOpenChange={setUnderageOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <span aria-hidden>⚠️🚫</span>
              Você não pode estar aqui
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              <span aria-hidden>🔞</span> Este aplicativo é <strong>exclusivo para maiores de 18 anos</strong>.
              <br />
              <span aria-hidden>👨‍👩‍👧</span> Fale com seu <strong>responsável</strong> antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setUnderageOpen(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
