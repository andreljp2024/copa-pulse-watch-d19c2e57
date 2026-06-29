import { createServerFn } from "@tanstack/react-start";

const EVO_API_URL = "http://hotspot-evolution-api-d3uxn9ysvfhfrhla3h274r3h:8080";

export const callEvolutionApi = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { method: string; path: string; apiKey: string; body?: any })
  .handler(async ({ data }) => {
    const { method, path, apiKey, body } = data;

    const headers: Record<string, string> = {};
    if (apiKey) headers["apikey"] = apiKey;
    if (body) headers["Content-Type"] = "application/json";

    const url = `${EVO_API_URL}${path}`;
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await resp.text().catch(() => "");

    if (!resp.ok) {
      return { ok: false, status: resp.status, error: text.slice(0, 500) };
    }

    try {
      const json = JSON.parse(text);
      return { ok: true, data: json };
    } catch {
      return { ok: true, data: text };
    }
  });
