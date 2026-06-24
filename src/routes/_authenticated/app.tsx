import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdmin } from "@/lib/gestores.functions";
import {
  LayoutDashboard, CreditCard, MessageCircle, Users, ListChecks, Settings,
  ExternalLink, LogOut, Trophy, Menu, X, Shield,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Painel do bolão" }] }),
  component: AppLayout,
});

type NavItem = {
  to: "/app" | "/app/bolao" | "/app/pix" | "/app/whatsapp" | "/app/torcedores" | "/app/palpites" | "/app/ganhadores" | "/app/gestores";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const baseNav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/bolao", label: "Meu bolão", icon: Settings },
  { to: "/app/pix", label: "Pix", icon: CreditCard },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/app/torcedores", label: "Torcedores", icon: Users },
  { to: "/app/palpites", label: "Palpites", icon: ListChecks },
  { to: "/app/ganhadores", label: "Ganhadores", icon: Trophy },
];

function AppLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkSuper = useServerFn(isSuperAdmin);
  const { data: superCheck } = useQuery({ queryKey: ["isSuperAdmin"], queryFn: () => checkSuper() });
  const nav: NavItem[] = superCheck?.isSuperAdmin
    ? [...baseNav, { to: "/app/gestores", label: "Gestores", icon: Shield }]
    : baseNav;
  const currentLabel = nav.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? "Painel";

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user.id).maybeSingle();
      if (!t) navigate({ to: "/onboarding" });
    })();
  }, [navigate]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex">
      {/* Sidebar (desktop) */}
      <aside className="w-64 hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <BrandLink />
        <SidebarNav />
        <SidebarFooter onLogout={logout} />
      </aside>

      {/* Sidebar (mobile drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85%] h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
            <BrandLink onClick={() => setMobileOpen(false)} />
            <SidebarNav />
            <SidebarFooter onLogout={logout} />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center gap-3 px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent/10"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Painel</p>
            <h2 className="truncate font-display font-bold text-sm leading-tight">{currentLabel}</h2>
          </div>
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-accent/10"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Site público
          </Link>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto"><Outlet /></div>
      </main>
    </div>
  );
}

function BrandLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className="px-5 h-16 flex items-center gap-2 border-b border-sidebar-border text-sidebar-foreground"
    >
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-samba shadow-glow">
        <Trophy className="h-5 w-5 text-gold-foreground" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-black tracking-tight leading-tight">Bolão SaaS</p>
        <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Espírito brasileiro</p>
      </div>
    </Link>
  );
}

function SidebarNav() {
  return (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">Menu</p>
      {nav.map(({ to, label, icon: Icon, exact }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: !!exact }}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeProps={{
            className:
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-sidebar-primary text-sidebar-primary-foreground shadow-glow",
          }}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="p-3 border-t border-sidebar-border">
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/75 hover:bg-destructive/15 hover:text-destructive transition-colors"
      >
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );
}

// Silence unused import warning for the icon used only in mobile close button if needed in future
void X;
