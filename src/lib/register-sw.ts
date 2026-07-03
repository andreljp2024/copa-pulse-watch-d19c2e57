/**
 * Wrapper único de registro do Service Worker (PWA offline-first).
 *
 * Segue os guards do skill PWA da Lovable:
 * - Nunca registra em dev, iframe, preview do editor ou `?sw=off`.
 * - Nesses casos, desregistra qualquer SW residual em `/sw.js`.
 * - Em produção real, registra via `workbox-window` e recarrega ao atualizar.
 */

const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.top !== window.self) return true; // iframe (preview)
  } catch {
    return true;
  }
  const host = window.location.hostname;
  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (isRefusedContext()) {
    await unregisterMatching();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox(SW_PATH, { scope: "/" });
    wb.addEventListener("waiting", () => {
      // Nova versão disponível: ativa imediatamente e recarrega.
      wb.messageSkipWaiting();
    });
    wb.addEventListener("controlling", () => {
      window.location.reload();
    });
    await wb.register();
  } catch (err) {
    // Falha silenciosa — offline continua degradando graciosamente.
    console.warn("[pwa] registro do SW falhou", err);
  }
}
