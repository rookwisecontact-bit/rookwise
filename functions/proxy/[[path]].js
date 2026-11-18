// Cloudflare Pages Function: bezpieczny pośrednik do publicznego API Chess.com (Published-Data API).
// Przepuszcza TYLKO listę archiwów i miesięczne archiwa partii jednego gracza, z cache na krawędzi sieci.
const CONTACT = "CHANGE_ME@example.com"; // <- wpisz swój e-mail kontaktowy (Chess.com prosi o kontakt w User-Agent)

export async function onRequestGet(context) {
  const raw = context.params.path;
  const path = (Array.isArray(raw) ? raw.join("/") : String(raw || "")).toLowerCase();
  const m = path.match(/^pub\/player\/[a-z0-9_-]{2,40}\/games\/(archives|(\d{4})\/(\d{2}))$/);
  if (!m) return json({ error: "Not allowed" }, 400);

  const now = new Date();
  const finished = m[2] && (+m[2] * 12 + +m[3]) < (now.getUTCFullYear() * 12 + now.getUTCMonth() + 1);
  const maxAge = finished ? 86400 : 300;
  const url = "https://api.chess.com/" + path;
  const cache = caches.default;
  const key = new Request(url);
  const hit = await cache.match(key);
  if (hit) return hit;

  const r = await fetch(url, {
    headers: { "User-Agent": `Rookwise/1.0 (contact: ${CONTACT})`, Accept: "application/json" },
  });
  const body = await r.text();
  const res = new Response(body, {
    status: r.status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${maxAge}` },
  });
  if (r.ok) context.waitUntil(cache.put(key, res.clone()));
  return res;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
