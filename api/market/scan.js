// api/market/scan.js
// Node serverless + defensive guards + small defaults
export default async function handler(req, res) {
  try {
    const key = process.env.TORN_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

    const q = req.query || {};
    const minPrice     = Number(q.minPrice    ?? 1000);
    const margin       = Number(q.margin      ?? 5);    // % under median to flag
    const needListings = Number(q.needListings?? 10);   // liquidity floor
    const category     = (q.category || "").toString().toLowerCase(); // "energy drink", "alcohol", etc.
    const maxItems     = Math.max(1, Math.min(12, Number(q.maxItems ?? 12))); // keep small for speed

    const base = "https://api.torn.com";
    const ua = { headers: { "User-Agent": "TornSidekick/1.0" } };

    // 1) load catalog
    let itemsData;
    try {
      const r = await fetch(`${base}/torn/?selections=items&key=${key}`, ua);
      itemsData = await r.json();
    } catch (e) {
      return res.status(502).json({ error: "Failed to fetch items catalog", detail: String(e) });
    }
    const items = itemsData?.items || {};

    // 2) candidates
    let candidates = Object.entries(items)
      .map(([id, meta]) => ({ item_id: Number(id), name: meta?.name || `item_${id}`, type: (meta?.type || "") }))
      .filter(x => !category || x.type.toLowerCase() === category)
      .slice(0, maxItems);

    // helpers
    async function getListings(id) {
      try {
        const r = await fetch(`${base}/v2/market/${id}/itemmarket?key=${key}`, ua);
        const d = await r.json();
        return d;
      } catch {
        return { itemmarket: [] };
      }
    }
    function toArray(maybe) {
      if (Array.isArray(maybe)) return maybe;
      if (maybe && typeof maybe === "object") return Object.values(maybe);
      return [];
    }
    function stats(listings) {
      const prices = listings.map(x => Number(x.cost)).filter(Number.isFinite).sort((a,b)=>a-b);
      const n = prices.length;
      if (!n) return null;
      const mid = n / 2;
      const median = n % 2 ? prices[(n-1)/2] : Math.round((prices[mid-1] + prices[mid]) / 2);
      const p10 = prices[Math.floor((n - 1) * 0.10)];
      const p90 = prices[Math.floor((n - 1) * 0.90)];
      return { n, low: prices[0], median, p10, p90 };
    }
    const chunk = (arr, n) => arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i+n)]), []);
    const results = [];
    const errors = [];
    const concurrency = 5;

    for (const group of chunk(candidates, concurrency)) {
      const settled = await Promise.allSettled(
        group.map(c => getListings(c.item_id).then(d => ({ c, d })))
      );

      for (const s of settled) {
        if (s.status !== "fulfilled") { errors.push(String(s.reason)); continue; }
        const { c, d } = s.value;

        // ✅ normalize itemmarket to array
        const list = toArray(d?.itemmarket)
          .map(x => ({ price: Number(x.cost), qty: Number(x.quantity || 1), seller: x.ID || "" }))
          .filter(x => Number.isFinite(x.price))
          .sort((a,b) => a.price - b.price);

        const S = stats(list);
        if (!S) continue;
        if (S.n < needListings) continue;
        if (S.low < minPrice) continue;

        const thresh = Math.round(S.median * (1 - margin/100));
        const deals = list
          .filter(x => x.price <= thresh)
          .slice(0, 3)
          .map(x => ({
            price: x.price,
            qty: x.qty,
            seller: x.seller,
            pct_under: Math.round((1 - x.price / S.median) * 1000)/10
          }));

        // require at least two cheap listings to avoid single-outlier traps
        if (deals.length >= 2) {
          results.push({
            item_id: c.item_id, name: c.name, type: c.type,
            n_listings: S.n, low: S.low, median: S.median, p10: S.p10, p90: S.p90,
            deals
          });
        }
      }
    }

    results.sort((a,b) => (b.deals[0]?.pct_under || 0) - (a.deals[0]?.pct_under || 0));
    return res.status(200).json({
      params: { minPrice, margin, needListings, category, maxItems },
      count: results.length,
      results
    });
  } catch (err) {
    return res.status(500).json({ error: "scan crashed", detail: String(err) });
  }
}



