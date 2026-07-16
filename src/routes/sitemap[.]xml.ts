import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://bolao.ai.slz.br";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/criar-bolao", changefreq: "weekly", priority: "0.9" },
  { path: "/calendario", changefreq: "daily", priority: "0.9" },
  { path: "/grupos", changefreq: "daily", priority: "0.8" },
  { path: "/selecoes", changefreq: "weekly", priority: "0.8" },
  { path: "/estatisticas", changefreq: "daily", priority: "0.8" },
  { path: "/mata-mata", changefreq: "daily", priority: "0.7" },
  { path: "/planos", changefreq: "monthly", priority: "0.6" },
  { path: "/ajuda", changefreq: "monthly", priority: "0.6" },
  { path: "/auth", changefreq: "monthly", priority: "0.3" },
];

async function getActiveBolaoSlugs(): Promise<string[]> {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await client.from("boloes").select("slug").eq("status", "active").limit(1000);
    return (data ?? []).map((b: { slug: string }) => b.slug).filter(Boolean);
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const slugs = await getActiveBolaoSlugs();
        const dynamicEntries: SitemapEntry[] = slugs.flatMap((slug) => [
          { path: `/bolao/${slug}`, changefreq: "daily", priority: "0.8" },
          { path: `/bolao/${slug}/ranking`, changefreq: "hourly", priority: "0.6" },
        ]);

        const entries = [...STATIC_ENTRIES, ...dynamicEntries];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
