import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { v4 as uuidv4 } from "uuid";

// Configuração da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://api.evolution-api.com/v1";
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN || "YOUR_MASTER_API_TOKEN";

interface EvolutionCredentials {
  instanceId: string;
  apiKey: string;
  qrCode: string;
}

// Gera credenciais para um novo gestor
async function gerarCredenciais(gestorId: string): Promise<EvolutionCredentials> {
  const instanceId = `bolaoai-${gestorId}-${uuidv4().substring(0, 8)}`;
  const apiKey = uuidv4();

  try {
    // Criar instância na Evolution API
    const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EVOLUTION_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instanceName: instanceId,
        token: apiKey,
        qrcode: true
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar instância: ${response.status}`);
    }

    const data = await response.json();
    return {
      instanceId,
      apiKey,
      qrCode: data.qrcode
    };
  } catch (error) {
    console.error("Erro ao gerar credenciais:", error);
    throw error;
  }
}

// Salva credenciais no banco de dados
async function salvarCredenciais(gestorId: string, credenciais: EvolutionCredentials): Promise<void> {
  const { error } = await supabaseAdmin
    .from("evolution_credentials")
    .upsert({
      gestor_id: gestorId,
      instance_id: credenciais.instanceId,
      api_key: credenciais.apiKey,
      qr_code: credenciais.qrCode,
      created_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

// Função para gerar credenciais (chamada pelo frontend)
const gerarCredenciaisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { gestor_id: string })
  .handler(async ({ context, data }) => {
    const { gestor_id } = data;
    const credenciais = await gerarCredenciais(gestor_id);
    await salvarCredenciais(gestor_id, credenciais);
    return credenciais;
  });

export { gerarCredenciaisFn };