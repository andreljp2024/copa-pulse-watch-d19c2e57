import { createFileRoute } from "@tanstack/react-router";
import http from "node:http";

export const Route = createFileRoute("/auth/v1/$")({
  server: {
    handlers: {
      GET: proxyAuth,
      POST: proxyAuth,
      PUT: proxyAuth,
      DELETE: proxyAuth,
      PATCH: proxyAuth,
      OPTIONS: proxyAuth,
    },
  },
});

function proxyAuth({ request }: { request: Request }): Promise<Response> {
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
      console.error("[auth proxy] error:", err.message);
      resolve(new Response(JSON.stringify({ error: true, message: err.message }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }));
    });

    proxyReq.setTimeout(15000, () => {
      proxyReq.destroy();
      resolve(new Response(JSON.stringify({ error: true, message: "timeout" }), {
        status: 504,
        headers: { "content-type": "application/json" },
      }));
    });

    request.text().then((body) => {
      if (body) proxyReq.write(body);
      proxyReq.end();
    }).catch(() => proxyReq.end());
  });
}
