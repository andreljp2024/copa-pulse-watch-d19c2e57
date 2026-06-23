import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal } from "lucide-react";

type Row = {
  torcedor_id: string;
  nome: string;
  acertos_exatos: number;
  acertos_resultado: number;
  total: number;
  pontos: number;
};

const rankingOpts = (slug: string) =>
  queryOptions({
    queryKey: ["bolao", slug, "ranking"],
    queryFn: async () => {
      const { data: bolao, error } = await supabase
        .from("boloes")
        .select("id, nome, slug, cor_primaria, tenant_id")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!bolao) throw notFound();

      const [palpitesRes, torcedoresRes, matchesRes] = await Promise.all([
        supabase
          .from("palpites")
          .select("id, torcedor_id, match_id, palpite_a, palpite_b")
          .eq("bolao_id", bolao.id),
        supabase.from("torcedores").select("id, nome").eq("bolao_id", bolao.id),
        supabase.from("matches").select("id, home_score, away_score, status").eq("status", "finished"),
      ]);

      const matchMap = new Map((matchesRes.data ?? []).map((m) => [m.id, m]));
      const torMap = new Map((torcedoresRes.data ?? []).map((t) => [t.id, t.nome]));
      const agg = new Map<string, Row>();

      for (const p of palpitesRes.data ?? []) {
        const m = matchMap.get(p.match_id);
        if (!m || m.home_score == null || m.away_score == null) continue;
        const row =
          agg.get(p.torcedor_id) ?? {
            torcedor_id: p.torcedor_id,
            nome: torMap.get(p.torcedor_id) ?? "?",
            acertos_exatos: 0,
            acertos_resultado: 0,
            total: 0,
            pontos: 0,
          };
        row.total += 1;
        const exato = p.palpite_a === m.home_score && p.palpite_b === m.away_score;
        const resultadoReal = Math.sign(m.home_score - m.away_score);
        const resultadoPalpite = Math.sign(p.palpite_a - p.palpite_b);
        if (exato) {
          row.acertos_exatos += 1;
          row.pontos += 10;
        } else if (resultadoReal === resultadoPalpite) {
          row.acertos_resultado += 1;
          row.pontos += 5;
        }
        agg.set(p.torcedor_id, row);
      }

      const rows = [...agg.values()].sort(
        (a, b) => b.pontos - a.pontos || b.acertos_exatos - a.acertos_exatos,
      );
      return { bolao, rows };
    },
    staleTime: 30_000,
  });

export const Route = createFileRoute("/bolao/$slug/ranking")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(rankingOpts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Ranking — ${loaderData.bolao.nome}` },
          { name: "description", content: `Ranking de participantes do ${loaderData.bolao.nome}.` },
        ]
      : [],
  }),
  component: Ranking,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">Não foi possível carregar o ranking</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <h1 className="text-3xl font-black">Bolão não encontrado</h1>
    </div>
  ),
});

function Ranking() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(rankingOpts(slug));
  const { bolao, rows } = data;

  return (
    <div className="min-h-screen bg-muted/20">
      <header
        className="border-b border-border"
        style={{ background: bolao.cor_primaria ?? "#0f766e", color: "white" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-8 flex items-center gap-3">
          <Trophy className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-black">Ranking</h1>
            <p className="text-sm opacity-90">{bolao.nome}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/bolao/$slug"
          params={{ slug: bolao.slug }}
          className="text-sm text-pitch font-semibold hover:underline"
        >
          ← Voltar ao bolão
        </Link>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Ainda não há jogos finalizados com palpites computados.
          </p>
        ) : (
          <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">Torcedor</th>
                  <th className="text-center p-3">Exatos</th>
                  <th className="text-center p-3">Resultado</th>
                  <th className="text-right p-3">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.torcedor_id} className="border-t border-border">
                    <td className="p-3 font-bold">
                      {i < 3 ? (
                        <Medal
                          className={`inline h-4 w-4 ${
                            i === 0
                              ? "text-yellow-500"
                              : i === 1
                                ? "text-gray-400"
                                : "text-amber-700"
                          }`}
                        />
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="p-3 font-medium">{r.nome}</td>
                    <td className="p-3 text-center">{r.acertos_exatos}</td>
                    <td className="p-3 text-center">{r.acertos_resultado}</td>
                    <td className="p-3 text-right font-black">{r.pontos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
