import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, CreditCard, MessageCircle, Users, ListChecks, Settings, ExternalLink, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Painel do bolão" }] }),
  component: AppLayout,
});

const nav: { to: "/app" | "/app/bolao" | "/app/pix" | "/app/whatsapp" | "/app/torcedores" | "/app/palpites"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/bolao", label: "Meu bolão", icon: Settings },
  { to: "/app/pix", label: "Pix", icon: CreditCard },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/app/torcedores", label: "Torcedores", icon: Users },
  { to: "/app/palpites", label: "Palpites", icon: ListChecks },
];

function AppLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user.id).maybeSingle();
      if (!t) navigate({ to: "/onboarding" });
    })();
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-muted/20 flex">
      <aside className="w-60 hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link to="/" className="px-5 h-16 flex items-center font-black tracking-tight border-b border-sidebar-border text-sidebar-foreground">CopaHub SaaS</Link>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} activeOptions={{ exact: !!exact }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-sidebar-primary text-sidebar-primary-foreground" }}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <ExternalLink className="h-4 w-4" /> Ver site público
          </Link>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden border-b border-border bg-card px-4 h-14 flex items-center gap-2 overflow-x-auto">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} activeOptions={{ exact: !!exact }}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground"
              activeProps={{ className: "shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-pitch text-primary-foreground" }}>
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </div>
        <div className="p-6"><Outlet /></div>
      </main>
    </div>
  );
}
