// Integration-managed protected layout
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    console.log("[Auth] URL hash:", hash);
    console.log("[Auth] URL path:", window.location.pathname);
    console.log("[Auth] URL search:", window.location.search);

    // Tenta obter usuario via sessao existente (token no localStorage ou URL hash)
    const { data, error } = await supabase.auth.getUser();
    console.log("[Auth] getUser result:", { data, error: error?.message });

    if (error || !data?.user) {
      console.log("[Auth] No user found, checking auth cookie...");
      // Tenta fazer request direto ao Gotrue com o cookie HTTP (enviado automaticamente)
      try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "GET",
          headers: {
            "apikey": SUPABASE_KEY || "",
            "Accept": "application/json",
          },
          credentials: "include",
        });
        
        console.log("[Auth] Fetch /user status:", resp.status);
        
        if (resp.ok) {
          const userData = await resp.json();
          console.log("[Auth] Got user from cookie:", userData);
          return { user: userData };
        } else {
          console.log("[Auth] Fetch /user failed:", resp.statusText);
        }
      } catch (fetchErr) {
        console.error("[Auth] Fetch /user error:", fetchErr);
      }

      throw redirect({ to: "/auth" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
