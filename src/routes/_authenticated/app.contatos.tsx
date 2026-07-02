import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, CheckCircle2, Download, AlertCircle, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Contato {
  nome: string;
  numero: string; // formato E.164 sem "+": 55 + DDD(2) + 9 + 8 dígitos = 13 dígitos
}

interface LinhaRejeitada {
  linha: number;
  nome: string;
  numero: string;
  motivo: string;
}

export const Route = createFileRoute("/_authenticated/app/contatos")({
  component: ImportarContatos,
});

// Aceita 10 ou 11 dígitos locais (com/sem 9), com ou sem DDI 55.
// Só valida celulares BR: DDD 11-99 + 9 + 8 dígitos.
function normalizarWhatsappBR(raw: string): { ok: true; e164: string } | { ok: false; motivo: string } {
  const somenteDig = (raw || "").replace(/\D/g, "");
  if (!somenteDig) return { ok: false, motivo: "número vazio" };
  let local = somenteDig;
  if (local.startsWith("55") && local.length > 11) local = local.slice(2);
  if (local.length === 10) local = local.slice(0, 2) + "9" + local.slice(2); // adiciona 9º dígito
  if (local.length !== 11) return { ok: false, motivo: "número precisa ter 10 ou 11 dígitos" };
  const ddd = Number(local.slice(0, 2));
  if (ddd < 11 || ddd > 99) return { ok: false, motivo: `DDD inválido (${local.slice(0, 2)})` };
  if (local[2] !== "9") return { ok: false, motivo: "não é celular (falta 9º dígito)" };
  return { ok: true, e164: "55" + local };
}

function parseCsvLinha(linha: string): string[] {
  const out: string[] = [];
  let cur = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentroAspas) {
      if (c === '"' && linha[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') dentroAspas = false;
      else cur += c;
    } else {
      if (c === '"') dentroAspas = true;
      else if (c === "," || c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function ImportarContatos() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Contato[]>([]);
  const [rejeitadas, setRejeitadas] = useState<LinhaRejeitada[]>([]);
  const [importando, setImportando] = useState(false);
  const [resumo, setResumo] = useState<{
    total: number;
    importados: number;
    duplicados: number;
    rejeitados: number;
  } | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setPreview([]);
    setRejeitadas([]);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const linhas = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (linhas.length < 2) { toast.error("CSV sem dados."); return; }
        const cabecalho = parseCsvLinha(linhas[0]).map((h) => h.toLowerCase().trim());
        const contatos: Contato[] = [];
        const erros: LinhaRejeitada[] = [];
        const jaAdicionados = new Set<string>();
        for (let i = 1; i < linhas.length; i++) {
          const vals = parseCsvLinha(linhas[i]);
          const linha: Record<string, string> = {};
          cabecalho.forEach((h, idx) => { linha[h] = vals[idx] || ""; });
          const nomeRaw = (linha.nome || linha.name || linha["first name"] || "").trim();
          const numeroRaw = (linha.numero || linha.phone || linha["mobile phone"] || linha.telefone || linha.celular || "").trim();

          if (!nomeRaw || nomeRaw.length < 2) {
            erros.push({ linha: i + 1, nome: nomeRaw, numero: numeroRaw, motivo: "nome vazio ou inválido" });
            continue;
          }
          const normalizado = normalizarWhatsappBR(numeroRaw);
          if (!normalizado.ok) {
            erros.push({ linha: i + 1, nome: nomeRaw, numero: numeroRaw, motivo: normalizado.motivo });
            continue;
          }
          if (jaAdicionados.has(normalizado.e164)) {
            erros.push({ linha: i + 1, nome: nomeRaw, numero: numeroRaw, motivo: "duplicado no arquivo" });
            continue;
          }
          jaAdicionados.add(normalizado.e164);
          contatos.push({ nome: nomeRaw.slice(0, 100), numero: normalizado.e164 });
        }
        setPreview(contatos);
        setRejeitadas(erros);
        if (contatos.length === 0) toast.error("Nenhum contato válido encontrado no CSV.");
        else if (erros.length > 0) toast.warning(`${contatos.length} válidos, ${erros.length} ignorados.`);
        else toast.success(`${contatos.length} contatos válidos.`);
      } catch {
        toast.error("Erro ao ler o arquivo CSV.");
      }
    };
    reader.readAsText(file);
  };


  const handleImport = async () => {
    if (preview.length === 0) return;
    setImportando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Usuário não autenticado.");
      const tRes = await supabase.from("tenants").select("id").eq("owner_user_id", u.user.id).limit(1);
      const t = Array.isArray(tRes.data) ? tRes.data[0] : tRes.data;
      if (!t?.id) throw new Error("Nenhum tenant encontrado.");
      const bRes = await supabase.from("boloes").select("id").eq("tenant_id", t.id).limit(1);
      const b = Array.isArray(bRes.data) ? bRes.data[0] : bRes.data;
      if (!b?.id) throw new Error("Nenhum bolão encontrado.");

      const { data: existentes } = await supabase
        .from("torcedores")
        .select("whatsapp")
        .eq("bolao_id", b.id);
      const existentesSet = new Set((existentes ?? []).map((r: any) => r.whatsapp));

      const novos = preview.filter((c) => !existentesSet.has(c.numero));
      const duplicados = preview.length - novos.length;

      if (novos.length === 0) {
        setResumo({ total: preview.length, importados: 0, duplicados, rejeitados: rejeitadas.length });
        return;
      }

      const { error } = await supabase.from("torcedores").insert(
        novos.map((c) => ({
          tenant_id: t.id,
          bolao_id: b.id,
          nome: c.nome.trim(),
          whatsapp: c.numero,
        })),
      );
      if (error) throw new Error(error.message);

      setResumo({ total: preview.length, importados: novos.length, duplicados, rejeitados: rejeitadas.length });
      toast.success(`${novos.length} contatos importados!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title="Importar Contatos"
        subtitle="Importe contatos do Google para seu bolão"
        icon={<Upload className="h-5 w-5" />}
      />

      {/* Instruções */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Download className="h-4 w-4 text-pitch" /> Como exportar seus contatos do Google
        </h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>
            Acesse{" "}
            <a
              href="https://contacts.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pitch font-semibold hover:underline inline-flex items-center gap-1"
            >
              Google Contacts <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>Clique em "Exportar" (ou "Transferir" {"→"} "Exportar") no menu lateral</li>
          <li>Selecione "Todos os contatos" e formato <strong>CSV do Google</strong></li>
          <li>Baixe o arquivo .csv</li>
          <li>Volte aqui e faça upload do arquivo</li>
        </ol>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          O CSV precisa ter colunas com nome e telefone.{" "}
          <strong>Colunas reconhecidas:</strong> nome, Nome, name, Name, First Name &
          numero, Numero, phone, Phone, Mobile Phone, Telefone
        </div>
      </div>

      {!resumo ? (
        <>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
              id="upload-contatos"
            />
            <label
              htmlFor="upload-contatos"
              className="cursor-pointer inline-flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-pitch hover:underline">
                Selecionar arquivo CSV
              </span>
            </label>
            <p className="mt-1 text-xs text-muted-foreground">Apenas arquivos .csv</p>
          </div>

          {preview.length > 0 && (
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-pitch" />
                  <span className="text-sm font-medium">{arquivo?.name}</span>
                </div>
                <span className="text-sm font-semibold">{preview.length} contatos</span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.slice(0, 10).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="truncate">{c.nome}</span>
                    <span className="text-xs text-muted-foreground font-mono">{c.numero}</span>
                  </div>
                ))}
                {preview.length > 10 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    + {preview.length - 10} contatos adicionais
                  </p>
                )}
              </div>

              {rejeitadas.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {rejeitadas.length} linha(s) ignorada(s) — apenas nomes válidos e WhatsApp BR (DDD + 9 + 8 dígitos) são aceitos
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-muted-foreground">
                    {rejeitadas.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono text-[10px]">L{r.linha}</span>
                        <span className="truncate flex-1">{r.nome || "(sem nome)"} — {r.numero || "(sem número)"}</span>
                        <span className="text-amber-700">{r.motivo}</span>
                      </div>
                    ))}
                    {rejeitadas.length > 10 && <p className="pt-1">+ {rejeitadas.length - 10} outras</p>}
                  </div>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importando}
                className="w-full h-10 rounded-lg bg-pitch text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {importando ? "Importando..." : `Importar ${preview.length} contatos`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">Resumo da Importação</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total encontrados:</span>
              <span className="font-medium">{resumo.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Importados:</span>
              <span className="font-medium text-green-600">{resumo.importados}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-600">Já existentes (ignorados):</span>
              <span className="font-medium text-yellow-600">{resumo.duplicados}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-600">Rejeitados (nome/WhatsApp inválido):</span>
              <span className="font-medium text-amber-600">{resumo.rejeitados}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setResumo(null); setArquivo(null); setPreview([]); setRejeitadas([]); }}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-semibold hover:bg-accent/10"
            >
              Nova importação
            </button>
            <Link
              to="/app/torcedores"
              className="flex-1 h-10 rounded-lg bg-pitch text-sm font-semibold text-primary-foreground inline-flex items-center justify-center"
            >
              Ver torcedores
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}