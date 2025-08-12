export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

  const minPrice = Number(req.query.minPrice ?? 1000);         // minimum listing price to consider
  const maxItems = Number(req.query.maxItems ?? 40);           // limit items scanned per call
  const category = (req.query.category || "").toLowerCase();   // "energy drink", "alcohol", "", etc.
  const margin = Number(req.query.margin ?? 5);                // percent under median to flag
  const needListings = Number(req.query.needListings ?? 10);   // min active listings for instant flip

  // 1, load all items
  const itemsUrl = `https://api.torn.com/torn/?selections=items&key=${key}`;
  const itemsResp = await fetch(itemsUrl, { headers: { "User-Agent": "TornSidekick/1.0" } });
  const itemsData = await itemsResp.json();
  const all = itemsData?.items || {};

  // 2, pick candidates by category and priceable types
  let candidates = Object.entries(all)
    .map(([id, meta]) => ({ item_id: Number(id), name: meta.name, type: meta.type }))
    .filter(x => !category || x.type.toLowerCase() === category);

  // keep it bounded so we do not hammer the API
  candidates = candidates.slice(0, maxItems);

  // 3, helper to fetch v2 itemmarket
  async function getListings(itemId) {
    const url = `https://api.torn.com/v2/market/${itemId}/itemmarket?key=${key}`;
    const r = await fetch(url, { headers: { "User-Agent": "TornSidekick/1.0" } });
    try { return await r.json(); } catch { return {}; }
  }

  // 4, per item stats
  function statsFrom(list) {
    const prices = (list || []).map(x => Number(x.cost)).filter(Boolean).sort((a,b)=>a-b);
    const n = prices.length;
    if (!n) return null;
    const median = n % 2 ? prices[(n-1)/2] : Math.round((prices[n/2 - 1] + prices[n/2]) / 2);
    const p10 = prices[Math.floor((n - 1) * 0.10)];
    const p90 = prices[Math.floor((n - 1) * 0.90)];
    const low = prices[0];
    return { n, low, median, p10, p90 };
  }

  const results = [];
  for (const c of candidates) {
    const data = await getListings(c.item_id);
    const list = data?.itemmarket || [];
    const s = statsFrom(list);
    if (!s) continue;
    if (s.n < needListings) continue; // instant flip needs liquidity
    if (s.low < minPrice) continue;

    const thresh = Math.round(s.median * (1 - margin / 100));
    const deals = list
      .filter(x => Number(x.cost) <= thresh)
      .map(x => ({
        price: Number(x.cost),
        qty: Number(x.quantity || 1),
        seller: x.ID || "",
        pct_under: Math.round((1 - Number(x.cost) / s.median) * 1000) / 10
      }))
      .sort((a,b) => a.price - b.price);

    if (deals.length) {
      results.push({
        item_id: c.item_id,
        name: c.name,
        type: c.type,
        n_listings: s.n,
        low: s.low,
        median: s.median,
        p10: s.p10,
        p90: s.p90,
        deals
      });
    }
  }

  // sort by best discount first
  results.sort((a,b) => (b.deals[0]?.pct_under || 0) - (a.deals[0]?.pct_under || 0));

  res.status(200).json({
    params: { minPrice, margin, needListings, category, maxItems },
    count: results.length,
    results
  });
}
