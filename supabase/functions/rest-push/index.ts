// Push-Mitteilung am Ende der Pause.
// Die App meldet beim Start der Pause Endzeit + Push-Abo; die Funktion wartet und schickt dann die Mitteilung.
// Längere Pausen werden in Abschnitten gewartet (die Funktion ruft sich selbst erneut auf).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:ronnielogman@example.com";

const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

// Nur bekannte Push-Dienste (Google/Android, Apple, Mozilla, Microsoft)
const PUSH_HOSTS = [
  /^https:\/\/fcm\.googleapis\.com\//,
  /^https:\/\/web\.push\.apple\.com\//,
  /^https:\/\/updates\.push\.services\.mozilla\.com\//,
  /^https:\/\/[a-z0-9.-]+\.notify\.windows\.com\//,
];
const CHUNK = 100_000; // max. Wartezeit pro Aufruf (unter dem Zeitlimit der Funktion)
const MAX_REST = 16 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (v: unknown, n: number) => String(v ?? "").slice(0, n);

async function fire(device: string, job: string) {
  const { data } = await db.from("rest_timers").select("ends_at,job").eq("device", device).maybeSingle();
  if (!data || data.job !== job) return; // abgebrochen oder neue Pause gestartet
  const wait = new Date(data.ends_at).getTime() - Date.now();
  if (wait > CHUNK) {
    await sleep(CHUNK);
    await fetch(`${SB_URL}/functions/v1/rest-push`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal": SERVICE },
      body: JSON.stringify({ action: "wait", device, job }),
    });
    return;
  }
  if (wait > 0) await sleep(wait);
  const { data: cur } = await db.from("rest_timers").select("*").eq("device", device).maybeSingle();
  if (!cur || cur.job !== job) return;
  try {
    await webpush.sendNotification(
      cur.sub,
      JSON.stringify({ title: cur.title || "Pause vorbei", body: cur.body || "" }),
      { TTL: 120, urgency: "high" },
    );
  } catch (e) {
    console.error("push failed", (e as { statusCode?: number }).statusCode ?? e);
  }
  await db.from("rest_timers").delete().eq("device", device).eq("job", job);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json" }, 400); }

  const device = clean(b.device, 64).replace(/[^A-Za-z0-9_-]/g, "");
  if (!device) return json({ error: "device" }, 400);

  if (b.action === "cancel") {
    await db.from("rest_timers").delete().eq("device", device);
    return json({ ok: true });
  }

  if (b.action === "wait") {
    if (req.headers.get("x-internal") !== SERVICE) return json({ error: "forbidden" }, 403);
    EdgeRuntime.waitUntil(fire(device, clean(b.job, 64)));
    return json({ ok: true });
  }

  if (b.action === "start") {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "vapid keys missing" }, 500);
    const ends = Number(b.ends_at);
    const delta = ends - Date.now();
    if (!(delta > 0 && delta <= MAX_REST)) return json({ error: "ends_at" }, 400);
    const sub = b.sub as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!sub?.endpoint || !PUSH_HOSTS.some((r) => r.test(sub.endpoint!)) || !sub.keys?.p256dh || !sub.keys?.auth) {
      return json({ error: "subscription" }, 400);
    }
    const job = crypto.randomUUID();
    const { error } = await db.from("rest_timers").upsert({
      device, job,
      ends_at: new Date(ends).toISOString(),
      sub: { endpoint: sub.endpoint, keys: { p256dh: clean(sub.keys.p256dh, 200), auth: clean(sub.keys.auth, 100) } },
      title: clean(b.title, 120), body: clean(b.body, 160),
    });
    if (error) return json({ error: "db" }, 500);
    EdgeRuntime.waitUntil(fire(device, job));
    return json({ ok: true, job });
  }

  return json({ error: "action" }, 400);
});
