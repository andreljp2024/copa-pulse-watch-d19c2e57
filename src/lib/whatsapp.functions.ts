import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gerarCredenciaisFn } from "@/lib/evolution.functions";

// Configuração da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://api.evolution-api.com/v1";

// Obtém credenciais da Evolution API para um gestor
async function obterCredenciais(instanceId: string): Promise<{apiKey: string; qrCode: string}> {
  const { data, error } = await supabaseAdmin
    .from("evolution_credentials")
    .select("api_key, qr_code")
    .eq("instance_id", instanceId)
    .single();

  if (error) {
    throw error;
  }

  return {
    apiKey: data.api_key,
    qrCode: data.qr_code ?? ""
  };
}

// Função para gerar QR Code
const gerarQrCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { instance_id: string })
  .handler(async ({ context, data }) => {
    const { instance_id } = data;
    const { apiKey, qrCode } = await obterCredenciais(instance_id);
    return { qrCode };
  });

export { gerarQrCodeFn };