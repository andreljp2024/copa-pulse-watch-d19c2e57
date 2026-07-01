import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

interface Contato {
  nome: string;
  numero: string;
}

// Normaliza número para padrão internacional
function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, '').replace(/^55/, '').padStart(13, '55');
}

// Lê arquivo CSV
function lerCsv(conteudo: string): Contato[] {
  const registros = parse(conteudo, {
    columns: true,
    skip_empty_lines: true
  });

  return registros.map((reg: any) => ({
    nome: reg.nome || reg.Nome || reg.name || reg.Name || '',
    numero: normalizarNumero(reg.numero || reg.Numero || reg.phone || reg.Phone || '')
  })).filter(c => c.nome && c.numero);
}

// Lê arquivo XLSX
function lerXlsx(conteudo: ArrayBuffer): Contato[] {
  const workbook = XLSX.read(conteudo);
  const primeiraPlanilha = workbook.Sheets[workbook.SheetNames[0]];
  const dados = XLSX.utils.sheet_to_json(primeiraPlanilha);

  return dados.map((reg: any) => ({
    nome: reg.nome || reg.Nome || reg.name || reg.Name || '',
    numero: normalizarNumero(reg.numero || reg.Numero || reg.phone || reg.Phone || '')
  })).filter(c => c.nome && c.numero);
}

// Lê arquivo VCF
function lerVcf(conteudo: string): Contato[] {
  const contatos: Contato[] = [];
  const linhas = conteudo.split("\n");

  let contatoAtual: Partial<Contato> = {};

  for (const linha of linhas) {
    if (linha.startsWith("FN:")) {
      contatoAtual.nome = linha.substring(3).trim();
    } else if (linha.startsWith("TEL:")) {
      const numero = linha.match(/TEL;TYPE=CELL:(.*)/)?.[1] || linha.substring(4).trim();
      contatoAtual.numero = normalizarNumero(numero);
    } else if (linha === "END:VCARD" && contatoAtual.nome && contatoAtual.numero) {
      contatos.push({
        nome: contatoAtual.nome,
        numero: contatoAtual.numero
      });
      contatoAtual = {};
    }
  }

  return contatos;
}

// Verifica duplicidade
async function verificarDuplicados(contatos: Contato[]): Promise<{unicos: Contato[], duplicados: Contato[]}> {
  const numeros = contatos.map(c => c.numero);
  const { data } = await supabase
    .from('torcedores')
    .select('whatsapp')
    .in('whatsapp', numeros);

  const existentes = new Set((data ?? []).map(c => c.whatsapp));
  return {
    unicos: contatos.filter(c => !existentes.has(c.numero)),
    duplicados: contatos.filter(c => existentes.has(c.numero))
  };
}

// Configuração da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://api.evolution-api.com/v1";
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN || "YOUR_EVOLUTION_API_TOKEN";

// Valida via Evolution API
async function validarWhatsApp(contatos: Contato[]): Promise<{validos: Contato[], semWhatsApp: Contato[]}> {
  const validos: Contato[] = [];
  const semWhatsApp: Contato[] = [];

  for (const contato of contatos) {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/YOUR_INSTANCE_ID/check-number-status/${contato.numero}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${EVOLUTION_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        semWhatsApp.push(contato);
        continue;
      }

      const data = await response.json();
      if (data.exists) {
        validos.push(contato);
      } else {
        semWhatsApp.push(contato);
      }
    } catch (error) {
      console.error("Erro ao validar WhatsApp:", error);
      semWhatsApp.push(contato);
    }
  }

  return { validos, semWhatsApp };
}

// Importa contatos válidos
async function importarContatos(contatos: Contato[], tenantId: string, bolaoId: string): Promise<number> {
  const { data, error } = await supabase
    .from('torcedores')
    .upsert(
      contatos.map(c => ({
        tenant_id: tenantId,
        bolao_id: bolaoId,
        nome: c.nome,
        whatsapp: c.numero
      })),
      { onConflict: 'whatsapp', ignoreDuplicates: true }
    )
    .select('id');

  if (error) throw error;
  return data?.length || 0;
}

// Função principal para processar arquivo
async function processarArquivo(file: File, tenantId: string, bolaoId: string): Promise<{
  total: number;
  importados: number;
  duplicados: number;
  invalidos: number;
  semWhatsApp: number;
}> {
  const conteudo = await file.text();
  let contatos: Contato[] = [];

  if (file.name.endsWith('.csv')) {
    contatos = lerCsv(conteudo);
  } else if (file.name.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer();
    contatos = lerXlsx(buffer);
  } else if (file.name.endsWith('.vcf')) {
    contatos = lerVcf(conteudo);
  } else {
    throw new Error('Formato de arquivo não suportado');
  }

  const { unicos, duplicados } = await verificarDuplicados(contatos);
  const { validos, semWhatsApp } = await validarWhatsApp(unicos);
  const importados = await importarContatos(validos, tenantId, bolaoId);

  return {
    total: contatos.length,
    importados,
    duplicados: duplicados.length,
    invalidos: contatos.length - unicos.length,
    semWhatsApp: semWhatsApp.length
  };
}

// Server function para importação
const importarContatosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { file: File; tenant_id: string; bolao_id: string })
  .handler(async ({ context, data }) => {
    const { tenant_id, bolao_id, file } = data;
    return await processarArquivo(file, tenant_id, bolao_id);
  });

export {
  importarContatosFn,
  lerCsv,
  lerXlsx,
  lerVcf,
  normalizarNumero,
  verificarDuplicados,
  validarWhatsApp,
};