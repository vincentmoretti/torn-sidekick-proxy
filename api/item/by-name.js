export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

  const name = (req.query.name || "").toString().trim();
  if (!name) return res.status(400).json({ error: "Missing ?name= query" });

  // Get all items from Torn (same as your /api/torn/items)
  const url = `https://api.torn.com/torn/?selections=items&key=${key}`;
  const r = await fetch(url, { headers: { "User-Agent": "TornSidekick/1.0" } });
  const data = await r.json();

  const items = data?.items || {};
  const needle = name.toLowerCase();

  // Case-insensitive substring match on item name
  const matches = Object.entries(items)
    .map(([id, meta]) => ({ item_id: Number(id), name: meta.name, type: meta.type }))
    .filter(x => x.name.toLowerCase().includes(needle));

  return res.status(200).json({ query: name, results: matches });
}
