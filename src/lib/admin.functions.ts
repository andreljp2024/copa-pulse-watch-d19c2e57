import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

interface AssertContext {
  supabase: SupabaseClient;
  userId: string;
}

async function assertAdmin(ctx: AssertContext) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin role required");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Check if user is the super admin by email
    const { data: userData } = await context.supabase.auth.getUser();
    if (userData.user?.email === "andreljp@gmail.com") return { isAdmin: true };

    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

// claimFirstAdmin removed: bootstrap admin is hard-coded via migration.
// Any need to grant admin must go through a privileged path (DB migration
// or an existing admin promoting another user) — never self-claim from the UI.

const matchSchema = z.object({
  id: z.string().uuid().optional(),
  home_team_id: z.string().uuid(),
  away_team_id: z.string().uuid(),
  group_id: z.string().uuid().nullable().optional(),
  phase: z.enum(["group", "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final"]),
  stadium_id: z.string().uuid().nullable().optional(),
  kickoff_at: z.string(),
  status: z.enum(["scheduled", "live", "finished", "postponed", "cancelled"]),
  home_score: z.number().int().min(0),
  away_score: z.number().int().min(0),
});

export const upsertMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => matchSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = data.id
      ? await sb.from("matches").update(data).eq("id", data.id)
      : await sb.from("matches").insert(data);
    if (error) throw error;
    return { ok: true };
  });

export const deleteMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = await sb.from("matches").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const teamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  code: z.string().min(2).max(4),
  flag_url: z.string().url().optional().nullable(),
  confederation: z.string().optional().nullable(),
  group_id: z.string().uuid().nullable().optional(),
  coach_name: z.string().optional().nullable(),
  fifa_rank: z.number().int().nullable().optional(),
});

export const upsertTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => teamSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = data.id
      ? await sb.from("teams").update(data).eq("id", data.id)
      : await sb.from("teams").insert(data);
    if (error) throw error;
    return { ok: true };
  });

// ---------- football-data.org integration ----------
export const syncFromExternalApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { syncFootballData } = await import("@/lib/football-sync.server");
    return syncFootballData(context.userId);
  });

export const listSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { data } = await sb
      .from("api_sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
