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
        .select("id, nome, slug, cor_primaria, permitir_ranking_publico")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!bolao) throw notFound();
      if (bolao.permitir_ranking_publico === false) {
        throw new Error("Ranking público desativado para este bolão");
      }

      const { data: ranking, error: rErr } = await supabase.rpc("get_bolao_ranking", {
        p_slug: slug,
      });
      if (rErr) throw rErr;

      const rows: Row[] = (ranking ?? []).map((r: any) => ({
        torcedor_id: r.torcedor_id,
        nome: r.nome,
        acertos_exatos: Number(r.acertos_exatos ?? 0),
        acertos_resultado: Number(r.acertos_resultado ?? 0),
        total: Number(r.total ?? 0),
        pontos: Number(r.pontos ?? 0),
      }));
      return { bolao, rows };
    },
    staleTime: 30_000,
  });

export const Route = createFileRoute("/bolao/$slug/ranking")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(rankingOpts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData?.bolao
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
