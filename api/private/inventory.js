export default async function handler(req, res) {
  if (req.headers["x-sidekick-token"] !== process.env.SIDEKICK_TOKEN)
    return res.status(401).json({ error: "Unauthorized" });

  const key = process.env.TORN_API_KEY_PRIVATE;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY_PRIVATE" });

  const ua = { headers: { "User-Agent": "TornSidekick/1.0" } };
  const [itemsR, invR] = await Promise.all([
    fetch(`https://api.torn.com/torn/?selections=items&key=${key}`, ua),
    fetch(`https://api.torn.com/user/?selections=inventory&key=${key}`, ua)
  ]);
  const items = (await itemsR.json())?.items || {};
  const invObj = (await invR.json())?.inventory || {};
  const invArr = Array.isArray(invObj) ? invObj : Object.values(invObj || {});
  const results = invArr.map(r => ({
    item_id: Number(r.ID || r.id),
    name: items?.[r.ID || r.id]?.name || `item_${r.ID || r.id}`,
    quantity: Number(r.quantity || 0)
  })).filter(x => x.item_id && x.quantity > 0);
  res.status(200).json({ count: results.length, results });
}
