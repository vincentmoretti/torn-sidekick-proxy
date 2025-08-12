export default async function handler(req, res) {
  if (req.headers["x-sidekick-token"] !== process.env.SIDEKICK_TOKEN)
    return res.status(401).json({ error: "Unauthorized" });

  const key = process.env.TORN_API_KEY_PRIVATE;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY_PRIVATE" });

  const type = (req.query.type || "itemmarket").toString().toLowerCase(); // e.g. "itemmarket", "bazaar"
  const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 100)));
  const ua = { headers: { "User-Agent": "TornSidekick/1.0" } };

  const r = await fetch(`https://api.torn.com/user/?selections=log&key=${key}`, ua);
  const raw = await r.json();
  const logs = Array.isArray(raw?.log) ? raw.log : Object.values(raw?.log || {});
  const filtered = logs
    .filter(e => (e?.type || "").toString().toLowerCase().includes(type))
    .slice(0, limit);
  res.status(200).json({ count: filtered.length, results: filtered });
}
