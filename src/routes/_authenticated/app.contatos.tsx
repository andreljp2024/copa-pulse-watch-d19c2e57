import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, CheckCircle2, Download, AlertCircle, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Contato {
  nome: string;
  numero: string;
}

export const Route = createFileRoute("/_authenticated/app/contatos")({
  component: ImportarContatos,
});

function ImportarContatos() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Contato[]>([]);
  const [importando, setImportando] = useState(false);
  const [resumo, setResumo] = useState<{
    total: number;
    importados: number;
    duplicados: number;
  } | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const linhas = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (linhas.length < 2) { toast.error("CSV sem dados."); return; }
        const cabecalho = linhas[0].split(",").map((h) => h.replace(/^"|"$/g, "").toLowerCase().trim());
        const contatos: Contato[] = [];
        for (let i = 1; i < linhas.length; i++) {
          const vals = linhas[i].split(",").map((v) => v.replace(/^"|"$/g, "").trim());
          const linha: Record<string, string> = {};
          cabecalho.forEach((h, idx) => { linha[h] = vals[idx] || ""; });
          const nome = linha.nome || linha.name || linha["first name"] || "";
          const numero = (linha.numero || linha.phone || linha["mobile phone"] || linha.telefone || "")
            .replace(/\D/g, "")
            .replace(/^55/, "")
            .padStart(13, "55");
          if (nome && numero.length >= 12) contatos.push({ nome, numero });
        }
        setPreview(contatos);
        if (contatos.length === 0) toast.error("Nenhum contato válido encontrado no CSV.");
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
        setResumo({ total: preview.length, importados: 0, duplicados });
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

      setResumo({ total: preview.length, importados: novos.length, duplicados });
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
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setResumo(null); setArquivo(null); setPreview([]); }}
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