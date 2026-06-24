import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Forbidden: super_admin role required");
}

export const isSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    return { isSuperAdmin: !!data };
  });

export const listGestores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenants, error } = await supabaseAdmin
      .from("tenants")
      .select("id, owner_user_id, nome_responsavel, nome_estabelecimento, email, whatsapp, cidade, estado, status, plano, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (tenants ?? []).map((t) => t.id);
    const ownerIds = (tenants ?? []).map((t) => t.owner_user_id);

    const [{ data: boloes }, { data: roles }, { data: authUsers }] = await Promise.all([
      supabaseAdmin.from("boloes").select("tenant_id").in("tenant_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const boloesCount = new Map<string, number>();
    (boloes ?? []).forEach((b: any) => boloesCount.set(b.tenant_id, (boloesCount.get(b.tenant_id) ?? 0) + 1));
    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    const lastSignIn = new Map<string, string | null>();
    (authUsers?.users ?? []).forEach((u: any) => lastSignIn.set(u.id, u.last_sign_in_at ?? null));

    return (tenants ?? []).map((t) => ({
      ...t,
      boloes_count: boloesCount.get(t.id) ?? 0,
      roles: rolesMap.get(t.owner_user_id) ?? [],
      last_sign_in_at: lastSignIn.get(t.owner_user_id) ?? null,
    }));
  });

const inviteSchema = z.object({
  email: z.string().email(),
  nome_responsavel: z.string().min(2),
  nome_estabelecimento: z.string().min(2),
});

export const inviteGestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const origin = process.env.SITE_URL ?? "https://copa-pulse-watch.lovable.app";
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nome_responsavel: data.nome_responsavel, nome_estabelecimento: data.nome_estabelecimento },
      redirectTo: `${origin}/onboarding`,
    });
    if (error) throw new Error(error.message);
    return { ok: true, user_id: inv.user?.id };
  });

export const updateGestorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ tenant_id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenants").update({ status: data.status }).eq("id", data.tenant_id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteGestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenant_id: z.string().uuid(), delete_auth_user: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("tenants").select("owner_user_id").eq("id", data.tenant_id).maybeSingle();
    const { error } = await supabaseAdmin.from("tenants").delete().eq("id", data.tenant_id);
    if (error) throw error;
    if (data.delete_auth_user && t?.owner_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(t.owner_user_id);
    }
    return { ok: true };
  });
