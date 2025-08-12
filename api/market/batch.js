export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

  // ids=532,181,294 ...
  const idsParam = (req.query.ids || "").toString();
  const top = Math.max(1, Math.min(10, Number(req.query.top ?? 5))); // return top N cheapest listings per item
  const ids = idsParam.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);

  if (!ids.length) return res.status(400).json({ error: "Provide ?ids=comma,separated,itemIds" });
  if (ids.length > 50) return res.status(400).json({ error: "Max 50 ids per call" });

  const base = "https://api.torn.com";
  const ua = { headers: { "User-Agent": "TornSidekick/1.0" } };

  // Map id -> name/type (server-side is fine to pull full list once)
  const itemsResp = await fetch(`${base}/torn/?selections=items&key=${key}`, ua);
  const itemsData = await itemsResp.json();
  const items = itemsData?.items || {};

  async function fetchListings(itemId) {
    const r = await fetch(`${base}/v2/market/${itemId}/itemmarket?key=${key}`, ua);
    try { return await r.json(); } catch { return {}; }
  }

  function stats(listings) {
    const prices = (listings || []).map(x => Number(x.cost)).filter(Boolean).sort((a,b)=>a-b);
    const n = prices.length;
    if (!n) return null;
    const median = n % 2 ? prices[(n-1)/2] : Math.round((prices[n/2 - 1] + prices[n/2]) / 2);
    const p10 = prices[Math.floor((n - 1) * 0.10)];
    const p90 = prices[Math.floor((n - 1) * 0.90)];
    const low = prices[0];
    return { n, low, median, p10, p90 };
  }

  const out = [];
  for (const id of ids) {
    const meta = items[id] || {};
    const name = meta.name || `item_${id}`;
    const type = meta.type || "";

    const data = await fetchListings(id);
    const list = (data?.itemmarket || [])
      .map(x => ({ price: Number(x.cost), qty: Number(x.quantity || 1), seller: x.ID || "" }))
      .filter(x => Number.isFinite(x.price))
      .sort((a,b) => a.price - b.price);

    const s = stats(list);
    if (!s) { out.push({ item_id: id, name, type, n_listings: 0 }); continue; }

    out.push({
      item_id: id, name, type,
      n_listings: s.n, low: s.low, median: s.median, p10: s.p10, p90: s.p90,
      lowest_listings: list.slice(0, top)
    });
  }

  res.status(200).json({ count: out.length, results: out });
}
