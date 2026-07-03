import { createFileRoute } from "@tanstack/react-router";

/**
 * Dispatcher da fila de push nativo (tipo = 'push').
 * Envia via protocolo Web Push (RFC 8030) usando VAPID (RFC 8292),
 * assinado com Web Crypto — compatível com o runtime do Worker.
 * Autenticação: header `apikey` = SUPABASE_PUBLISHABLE_KEY.
 */
export const Route = createFileRoute("/api/public/hooks/dispatch-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) return json({ error: "unauthorized" }, 401);

        const vapidPub = process.env.VAPID_PUBLIC_KEY;
        const vapidPriv = process.env.VAPID_PRIVATE_KEY;
        const vapidSub = process.env.VAPID_SUBJECT ?? "mailto:no-reply@bolao.ai";
        if (!vapidPub || !vapidPriv) return json({ error: "vapid_not_configured" }, 500);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: pending } = await supabaseAdmin
          .from("notification_queue")
          .select("id, torcedor_id, mensagem, tentativas")
          .eq("status", "pending")
          .eq("tipo", "push")
          .lte("scheduled_at", new Date().toISOString())
          .lt("tentativas", 5)
          .order("scheduled_at", { ascending: true })
          .limit(20);

        if (!pending || pending.length === 0) return json({ ok: true, processed: 0 });

        const torcedorIds = [...new Set(pending.map((r) => r.torcedor_id).filter(Boolean))];
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("torcedor_id, endpoint, p256dh, auth")
          .in("torcedor_id", torcedorIds as string[]);

        const subsByTorcedor = new Map<string, typeof subs>();
        for (const s of subs ?? []) {
          const arr = subsByTorcedor.get(s.torcedor_id!) ?? [];
          arr.push(s);
          subsByTorcedor.set(s.torcedor_id!, arr as never);
        }

        let sent = 0, failed = 0, skipped = 0;
        for (const item of pending) {
          const targets = (item.torcedor_id && subsByTorcedor.get(item.torcedor_id)) || [];
          if (targets.length === 0) {
            await supabaseAdmin.from("notification_queue").update({
              status: "skipped", ultimo_erro: "Sem inscrição de push", sent_at: new Date().toISOString(),
            }).eq("id", item.id);
            skipped++;
            continue;
          }

          try {
            for (const s of targets) {
              const res = await sendWebPush({
                endpoint: s.endpoint,
                p256dh: s.p256dh,
                auth: s.auth,
                payload: item.mensagem,
                vapidPublicKey: vapidPub,
                vapidPrivateKey: vapidPriv,
                vapidSubject: vapidSub,
              });
              if (res.status === 404 || res.status === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
              } else if (!res.ok) {
                throw new Error(`push ${res.status}: ${(await res.text()).slice(0, 200)}`);
              }
            }
            await supabaseAdmin.from("notification_queue").update({
              status: "sent", sent_at: new Date().toISOString(), tentativas: item.tentativas + 1,
            }).eq("id", item.id);
            sent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const next = item.tentativas + 1;
            await supabaseAdmin.from("notification_queue").update({
              status: next >= 5 ? "failed" : "pending",
              tentativas: next,
              ultimo_erro: msg.slice(0, 500),
              scheduled_at: new Date(Date.now() + Math.min(60_000 * 2 ** next, 3_600_000)).toISOString(),
            }).eq("id", item.id);
            failed++;
          }
        }
        return json({ ok: true, processed: pending.length, sent, failed, skipped });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// --- Web Push helpers ---------------------------------------------------------

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
async function hmac(key: CryptoKey, data: Uint8Array) {
  const sig = await crypto.subtle.sign("HMAC", key, data as unknown as BufferSource);
  return new Uint8Array(sig);
}
async function importHmacKey(raw: Uint8Array) {
  return crypto.subtle.importKey("raw", raw as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const prkKey = await importHmacKey(salt);
  const prk = await hmac(prkKey, ikm);
  const t1Key = await importHmacKey(prk);
  const t1 = await hmac(t1Key, concat(info, new Uint8Array([1])));
  return t1.slice(0, len);
}

// Raw P-256 (65 bytes uncompressed) → JWK
function rawP256ToJwk(raw: Uint8Array, isPublic: boolean, d?: Uint8Array): JsonWebKey {
  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    x: b64urlEncode(x), y: b64urlEncode(y),
    ext: true,
  };
  if (!isPublic && d) jwk.d = b64urlEncode(d);
  return jwk;
}

async function importP256Public(raw: Uint8Array) {
  return crypto.subtle.importKey("jwk", rawP256ToJwk(raw, true), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function ecdhSharedSecret(privJwk: JsonWebKey, pubRaw: Uint8Array): Promise<Uint8Array> {
  const priv = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const pub = await importP256Public(pubRaw);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
  return new Uint8Array(bits);
}

async function signJwtES256(header: object, payload: object, privJwk: JsonWebKey): Promise<string> {
  const enc = new TextEncoder();
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = enc.encode(`${h}.${p}`);
  const key = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data as unknown as BufferSource);
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

// AES128GCM content encoding per RFC 8291
async function encryptPayload(
  payload: Uint8Array,
  uaPublicRaw: Uint8Array,
  authSecret: Uint8Array,
): Promise<{ body: Uint8Array; asPublicRaw: Uint8Array }> {
  // 1) gerar chave ephemeral do servidor (application server)
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPubJwk = await crypto.subtle.exportKey("jwk", asKeys.publicKey);
  const asPrivJwk = await crypto.subtle.exportKey("jwk", asKeys.privateKey);
  const asPubRaw = concat(new Uint8Array([0x04]), b64urlDecode(asPubJwk.x!), b64urlDecode(asPubJwk.y!));

  // 2) ECDH shared secret
  const ikm0 = await ecdhSharedSecret(asPrivJwk, uaPublicRaw);

  // 3) key_info = "WebPush: info\0" || ua_public || as_public
  const enc = new TextEncoder();
  const keyInfo = concat(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublicRaw, asPubRaw);
  const ikm = await hkdf(authSecret, ikm0, keyInfo, 32);

  // 4) salt aleatório (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, concat(enc.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  // 5) plaintext + delimitador 0x02 (last record)
  const plaintext = concat(payload, new Uint8Array([0x02]));

  const cekKey = await crypto.subtle.importKey("raw", cek as unknown as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as unknown as BufferSource }, cekKey, plaintext as unknown as BufferSource));

  // 6) header: salt(16) || rs(4 = 4096) || idlen(1) || keyid(idlen)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([asPubRaw.length]), asPubRaw);

  return { body: concat(header, ct), asPublicRaw: asPubRaw };
}

async function sendWebPush(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}): Promise<Response> {
  const uaPub = b64urlDecode(opts.p256dh);
  const authSecret = b64urlDecode(opts.auth);
  const encPayload = new TextEncoder().encode(opts.payload);

  const { body } = await encryptPayload(encPayload, uaPub, authSecret);

  // VAPID JWT
  const url = new URL(opts.endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const vapidPubRaw = b64urlDecode(opts.vapidPublicKey);
  const vapidJwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    x: b64urlEncode(vapidPubRaw.slice(1, 33)),
    y: b64urlEncode(vapidPubRaw.slice(33, 65)),
    d: opts.vapidPrivateKey,
    ext: true,
  };
  const jwt = await signJwtES256({ typ: "JWT", alg: "ES256" }, { aud, exp, sub: opts.vapidSubject }, vapidJwk);

  return fetch(opts.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
      Authorization: `vapid t=${jwt}, k=${opts.vapidPublicKey}`,
    },
    body: body as unknown as BodyInit,
    signal: AbortSignal.timeout(10_000),
  });
}
