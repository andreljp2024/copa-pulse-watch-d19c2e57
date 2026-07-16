export const SITE = {
  name: "Bolão AI",
  domain: "https://bolao.ai.slz.br",
  titleTemplate: (t: string) => `${t} — Bolão AI`,
  description:
    "Tabela, calendário, resultados, seleções e estatísticas da Copa do Mundo em tempo real. Crie e gerencie seu bolão entre amigos.",
  ogImage: "/og-image.png",
  twitter: "@bolaoai",
  locale: "pt_BR",
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.domain}${path.startsWith("/") ? "" : "/"}${path}`;
}

export type MetaEntry =
  | { charSet: string }
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { httpEquiv: string; content: string }
  | { itemProp: string; content: string };

export function canonicalMeta(pathname: string): MetaEntry {
  return { name: "canonical", content: absoluteUrl(pathname) } as unknown as MetaEntry;
}

export function robotsMeta(content = "index, follow"): MetaEntry {
  return { name: "robots", content } as unknown as MetaEntry;
}

export function noindexMeta(): MetaEntry {
  return robotsMeta("noindex, nofollow");
}

export function ogMeta(opts: {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}): MetaEntry[] {
  const image = opts.image ?? SITE.ogImage;
  const absImage = absoluteUrl(image);
  const metas: MetaEntry[] = [
    { property: "og:site_name", content: SITE.name },
    { property: "og:locale", content: SITE.locale },
    { property: "og:type", content: opts.type ?? "website" },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:image", content: absImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: opts.title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: SITE.twitter },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    { name: "twitter:image", content: absImage },
  ];
  if (opts.url) {
    metas.push({ property: "og:url", content: absoluteUrl(opts.url) });
  }
  return metas;
}

export type JsonLdScript = React.JSX.IntrinsicElements["script"];

export function jsonLd(data: Record<string, unknown>): JsonLdScript {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  } as JsonLdScript;
}
