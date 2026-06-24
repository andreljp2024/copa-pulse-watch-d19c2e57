import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Moon, Sun, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import bgPattern from "@/assets/bg-pattern.jpg";
import bolaoIcon from "@/assets/bolaoai-icon.png";

const nav = [
  { to: "/", label: "Início" },
  { to: "/selecoes", label: "Seleções" },
  { to: "/grupos", label: "Grupos" },
  { to: "/calendario", label: "Calendário" },
  { to: "/mata-mata", label: "Mata-mata" },
  { to: "/estatisticas", label: "Estatísticas" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("copahub-theme");
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("copahub-theme", next ? "dark" : "light");
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-[0.12] dark:opacity-25 pointer-events-none"
        style={{ backgroundImage: `url(${bgPattern})` }}
      />
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-background/80 via-background/95 to-background pointer-events-none" />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={bolaoIcon} alt="BolaoAI" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="text-lg font-black tracking-tight">BolaoAI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                activeProps={{ className: "px-3 py-2 rounded-lg text-sm font-semibold text-foreground bg-muted" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} aria-label="Alternar tema" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/criar-bolao" className="hidden sm:inline-flex h-9 items-center rounded-lg border border-pitch text-pitch px-3 text-sm font-semibold hover:bg-pitch/5">
              Criar meu bolão
            </Link>
            {email ? (
              <Link to="/app" className="hidden sm:inline-flex h-9 items-center rounded-lg bg-pitch px-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Meu painel
              </Link>
            ) : (
              <Link to="/auth" className="hidden sm:inline-flex h-9 items-center rounded-lg bg-pitch px-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Entrar
              </Link>
            )}
            <button onClick={() => setOpen(!open)} className="md:hidden grid h-9 w-9 place-items-center rounded-lg border border-border" aria-label="Menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-4 py-2 flex flex-col">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="px-3 py-3 rounded-lg text-sm font-medium hover:bg-muted">
                  {n.label}
                </Link>
              ))}
              <Link to="/criar-bolao" onClick={() => setOpen(false)} className="px-3 py-3 rounded-lg text-sm font-semibold">
                Criar meu bolão
              </Link>
              <Link to={email ? "/app" : "/auth"} onClick={() => setOpen(false)} className="px-3 py-3 rounded-lg text-sm font-semibold text-pitch">
                {email ? "Meu painel" : "Entrar"}
              </Link>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>© BolaoAI — Acompanhe a Copa do Mundo em tempo real.</span>
          <span className="text-xs">Estrutura pronta para integração com API externa.</span>
        </div>
      </footer>
    </div>
  );
}
