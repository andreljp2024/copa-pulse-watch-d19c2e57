import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface Contato {
  nome: string;
  whatsapp: string;
}

export const getGoogleContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { providerToken: string })
  .handler(async ({ data }) => {
    const { providerToken } = data;

    if (!providerToken) {
      return { ok: false, error: "Token do Google não disponível. Refaça o login com o Google." };
    }

    try {
      const resp = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000",
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
            Accept: "application/json",
          },
        },
      );

      if (resp.status === 401) {
        return { ok: false, error: "Conexão com o Google expirou. Refaça o login e tente novamente." };
      }

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error("[GoogleImport] Google API error:", resp.status, errBody);
        return { ok: false, error: `Erro na API do Google (${resp.status})` };
      }

      const result = await resp.json();
      const connections = result.connections || [];

      const contatos: Contato[] = connections
        .map((c: any) => {
          const nome = c.names?.[0]?.displayName;
          const phone =
            c.phoneNumbers?.find(
              (p: any) => p.type === "mobile" || p.type === "home",
            )?.value ?? c.phoneNumbers?.[0]?.value;

          if (!nome || !phone) return null;

          return { nome, whatsapp: phone.replace(/\D/g, "") };
        })
        .filter(Boolean);

      return { ok: true, contatos };
    } catch (err: any) {
      console.error("[GoogleImport] Fetch error:", err);
      return { ok: false, error: err.message };
    }
  });