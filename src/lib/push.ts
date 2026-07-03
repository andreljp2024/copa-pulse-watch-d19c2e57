/**
 * Web Push — inscrição do navegador para notificações nativas.
 * A chave VAPID pública é intencionalmente hardcoded (é pública por design).
 */
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY =
  "BK_3-DO_j1-I6JIhaZSbyKG7g8kv9mb_CfeaTgQ7ihyCQrZJoUvjmZK9fmpGMJbu1XxeFIG2P2fd7BSyc_7wzS8";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function subscribePush(params: {
  bolao_id?: string;
  torcedor_id?: string;
}): Promise<boolean> {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  if (!params.bolao_id || !params.torcedor_id) {
    // Vínculo obrigatório para registrar a inscrição
    return false;
  }
  const { error } = await supabase.rpc("register_push_subscription", {
    p_bolao_id: params.bolao_id,
    p_torcedor_id: params.torcedor_id,
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) return false;
  return true;
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
