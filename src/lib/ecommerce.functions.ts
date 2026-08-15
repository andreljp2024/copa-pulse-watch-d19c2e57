import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function publicClient() {
  // Use any to bypass outdated types temporarily until the system syncs
  return createClient<any>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`[${label}] ${res.error.message}`);
  return res.data ?? ([] as unknown as T);
}

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [cestas, categorias, stats] = await Promise.all([
    sb.from("cestas").select("*").eq("ativa", true).order("created_at"),
    sb.from("categorias").select("*").order("ordem"),
    Promise.all([
      sb.from("produtos").select("id", { count: "exact", head: true }),
      sb.from("pedidos").select("id", { count: "exact", head: true }),
      sb.from("tenants").select("id", { count: "exact", head: true }),
    ]).then(([prod, ped, ten]) => ({
      produtos: prod.count ?? 0,
      pedidos: ped.count ?? 0,
      tenants: ten.count ?? 0,
    })),
  ]);

  return {
    cestas: (cestas.data as any[]) ?? [],
    categorias: (categorias.data as any[]) ?? [],
    stats: {
      items: stats.produtos,
      orders: stats.pedidos,
      stores: stats.tenants,
    }
  };
});

export const getCesta = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: cesta, error } = await sb
      .from("cestas")
      .select("*, itens:cesta_itens(quantidade, obrigatorio, produto:produtos(*))")
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) throw new Error(`[getCesta] ${error.message}`);
    return cesta as any;
  });

export const listProdutos = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const res = await sb.from("produtos").select("*, categoria:categorias(nome)").eq("ativo", true).order("nome");
  return unwrap(res, "listProdutos");
});
