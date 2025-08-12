export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

  const type = (req.query.type || "").toString().toLowerCase(); // e.g., "energy drink"
  const limit = Number(req.query.limit ?? 200);

  const url = `https://api.torn.com/torn/?selections=items&key=${key}`;
  const r = await fetch(url, { headers: { "User-Agent": "TornSidekick/1.0" } });
  const data = await r.json();
  const items = data?.items || {};

  let rows = Object.entries(items).map(([id, meta]) => ({
    item_id: Number(id),
    name: meta.name,
    type: meta.type
  }));
  if (type) rows = rows.filter(x => (x.type || "").toLowerCase().includes(type));
  rows = rows.slice(0, limit);

  res.status(200).json({ count: rows.length, results: rows });
}
