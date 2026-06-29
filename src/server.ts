import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import http from "node:http";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const SUPABASE_PATHS = ["/auth/v1/", "/rest/v1/", "/storage/v1/"];

function isSupabasePath(pathname: string): boolean {
  return SUPABASE_PATHS.some((p) => pathname.startsWith(p));
}

function proxyToKong(request: Request): Promise<Response> {
  return new Promise((resolve) => {
    const url = new URL(request.url);
    const options: http.RequestOptions = {
      hostname: "kong",
      port: 8000,
      path: url.pathname + url.search,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
    };
    delete options.headers!["host"];

    const proxyReq = http.request(options, (proxyRes) => {
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const body = Buffer.concat(chunks);
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value) headers[key] = Array.isArray(value) ? value.join(", ") : value;
        }
        resolve(new Response(body, {
          status: proxyRes.statusCode || 500,
          headers,
        }));
      });
    });

    proxyReq.on("error", (err) => {
      console.error("[supabase-proxy]", err.message);
      resolve(new Response(JSON.stringify({ error: true, message: err.message }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }));
    });

    proxyReq.setTimeout(15000, () => {
      proxyReq.destroy();
      resolve(new Response("Gateway timeout", { status: 504 }));
    });

    request.text().then((body) => {
      if (body) proxyReq.write(body);
      proxyReq.end();
    }).catch(() => proxyReq.end());
  });
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (isSupabasePath(new URL(request.url).pathname)) {
        return await proxyToKong(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
