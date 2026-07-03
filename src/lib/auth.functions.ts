import { timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SUPER_ADMIN_WHATSAPP = "5598986030534";
const WA_EMAIL_DOMAIN = "wa.bolao.local";

const loginSchema = z.object({
  whatsapp: z.string().min(10),
  password: z.string().min(1),
});

function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `55${digits}`;
  return digits;
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const signInSuperAdminByWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((data) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const whatsapp = normalizeWhatsApp(data.whatsapp);
    const expectedPassword = process.env.SUPER_ADMIN_WHATSAPP_LOGIN_PASSWORD;

    if (whatsapp !== SUPER_ADMIN_WHATSAPP || !expectedPassword) {
      throw new Error("WhatsApp ou senha inválidos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: allowed, error: rateError } = await supabaseAdmin.rpc("check_rate_limit", {
      p_chave: whatsapp,
      p_escopo: "super_admin_whatsapp_login",
      p_max: 5,
      p_janela_segundos: 300,
    });
    if (rateError) throw new Error("Falha ao validar acesso.");
    if (!allowed) throw new Error("Muitas tentativas. Aguarde alguns minutos.");

    if (!safeEquals(data.password, expectedPassword)) {
      throw new Error("WhatsApp ou senha inválidos.");
    }

    const email = `${whatsapp}@${WA_EMAIL_DOMAIN}`;
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link.properties?.hashed_token) {
      throw new Error("Não foi possível iniciar a sessão.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabasePublic = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: verified, error: verifyError } = await supabasePublic.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !verified.session) {
      throw new Error("Não foi possível concluir o login.");
    }

    return {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    };
  });

const signupSchema = z.object({
  whatsapp: z.string().min(10),
  password: z.string().min(8).max(72),
  nome: z.string().trim().min(2).max(120),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const signUpOrganizerByWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((data) => signupSchema.parse(data))
  .handler(async ({ data }) => {
    const whatsapp = normalizeWhatsApp(data.whatsapp);
    if (whatsapp.length < 12) throw new Error("WhatsApp inválido.");

    // Idade >= 18
    const [y, m, d] = data.birth_date.split("-").map(Number);
    const dob = new Date(y, m - 1, d);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const md = now.getMonth() - dob.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < dob.getDate())) age--;
    if (age < 18) throw new Error("É necessário ter no mínimo 18 anos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: allowed, error: rateError } = await supabaseAdmin.rpc("check_rate_limit", {
      p_chave: whatsapp,
      p_escopo: "signup_whatsapp",
      p_max: 5,
      p_janela_segundos: 600,
    });
    if (rateError) throw new Error("Falha ao validar cadastro.");
    if (!allowed) throw new Error("Muitas tentativas. Aguarde alguns minutos.");

    const email = `${whatsapp}@${WA_EMAIL_DOMAIN}`;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.nome, whatsapp, birth_date: data.birth_date },
    });
    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Este WhatsApp já está cadastrado. Faça login.");
      }
      throw new Error(createError.message || "Falha ao criar organizador.");
    }
    if (!created.user) throw new Error("Falha ao criar organizador.");

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link.properties?.hashed_token) {
      throw new Error("Conta criada. Faça login para continuar.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabasePublic = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: verified, error: verifyError } = await supabasePublic.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !verified.session) {
      throw new Error("Conta criada. Faça login para continuar.");
    }

    return {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    };
  });