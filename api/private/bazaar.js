export default async function handler(req, res) {
  if (req.headers["x-sidekick-token"] !== process.env.SIDEKICK_TOKEN)
    return res.status(401).json({ error: "Unauthorized" });

  const key = process.env.TORN_API_KEY_PRIVATE;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY_PRIVATE" });

  const ua = { headers: { "User-Agent": "TornSidekick/1.0" } };
  const r = await fetch(`https://api.torn.com/user/?selections=bazaar&key=${key}`, ua);
  const raw = await r.json();
  const items = Array.isArray(raw?.bazaar) ? raw.bazaar : Object.values(raw?.bazaar || {});
  res.status(200).json({ count: items.length, results: items });
}
