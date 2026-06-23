import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "../components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeMatches } from "@/hooks/useRealtimeMatches";

function NotFoundComponent() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-24 text-center">
        <h1 className="text-7xl font-black text-pitch">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-pitch px-4 text-sm font-semibold text-primary-foreground">Ir para o início</Link>
      </div>
    </AppShell>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente.</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 inline-flex h-10 items-center rounded-lg bg-pitch px-4 text-sm font-semibold text-primary-foreground">
          Tentar novamente
        </button>
      </div>
    </AppShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CopaHub — Acompanhe a Copa do Mundo" },
      { name: "description", content: "Tabela, calendário, resultados, seleções e estatísticas da Copa do Mundo em tempo real." },
      { property: "og:title", content: "CopaHub — Acompanhe a Copa do Mundo" },
      { property: "og:description", content: "Tabela, calendário, resultados, seleções e estatísticas da Copa do Mundo em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CopaHub — Acompanhe a Copa do Mundo" },
      { name: "twitter:description", content: "Tabela, calendário, resultados, seleções e estatísticas da Copa do Mundo em tempo real." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0a6af608-6cce-4f57-a6fd-c0a654b4005f/id-preview-b731ae3a--84da67c1-66da-4335-845c-026539ecf393.lovable.app-1781548084544.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0a6af608-6cce-4f57-a6fd-c0a654b4005f/id-preview-b731ae3a--84da67c1-66da-4335-845c-026539ecf393.lovable.app-1781548084544.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <Outlet />
    </QueryClientProvider>
  );
}

function RealtimeBridge() {
  useRealtimeMatches();
  return null;
}
