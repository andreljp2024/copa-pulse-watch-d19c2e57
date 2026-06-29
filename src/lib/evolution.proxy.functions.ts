import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVO_API_URL = "http://10.0.1.31:3000";

export const callEvolutionApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { method: string; path: string; body?: any })
  .handler(async ({ context, data }) => {
    const { method, path, body } = data;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const resp = await fetch(`${EVO_API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, status: resp.status, error: text.slice(0, 500) };
    }

    const json = await resp.json().catch(() => ({}));
    return { ok: true, data: json };
  });
