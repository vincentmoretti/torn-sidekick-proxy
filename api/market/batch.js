// api/market/batch.js
// Node serverless + normalization + small-batch concurrency
export default async function handler(req, res) {
  try {
    const key = process.env.TORN_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

    const q = req.query || {};
    const idsParam = (q.ids || "").toString();        // "532,181,294"
    const top = Math.max(1, Math.min(5, Number(q.top ?? 3))); // return up to N cheapest per item

    const ids = idsParam
      .split(",")
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n > 0);

    if (!ids.length) return res.status(400).json({ error: "Provide ?ids=comma,separated,itemIds" });
    if (ids.length > 50) return res.status(400).json({ error: "Max 50 ids per call" });

    const base = "https://api.torn.com";
    const ua = { headers: { "User-Agent": "TornSidekick/1.0" } };

    // Map id -> name/type (okay to pull once server-side)
    let items = {};
    try {
      const ir = await fetch(`${base}/torn/?selections=items&key=${key}`, ua);
      const data = await ir.json();
      items = data?.items || {};
    } catch (_) {
      items = {}; // continue anyway; we'll still return stats
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
    async function getListings(id) {
      try {
        const r = await fetch(`${base}/v2/market/${id}/itemmarket?key=${key}`, ua);
        return await r.json();
      } catch {
        return { itemmarket: [] };
      }
    }
    const chunk = (arr, n) => arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i+n)]), []);
    const out = [];
    const errors = [];
    const concurrency = 6;

    for (const group of chunk(ids, concurrency)) {
      const settled = await Promise.allSettled(group.map(id => getListings(id).then(d => ({ id, d }))));

      for (const s of settled) {
        if (s.status !== "fulfilled") { errors.push(String(s.reason)); continue; }
        const { id, d } = s.value;

        const meta = items?.[id] || {};
        const name = meta?.name || `item_${id}`;
        const type = meta?.type || "";

        const arr = toArray(d?.itemmarket)
          .map(x => ({ price: Number(x.cost), qty: Number(x.quantity || 1), seller: x.ID || "" }))
          .filter(x => Number.isFinite(x.price))
          .sort((a,b) => a.price - b.price);

        const S = stats(arr);
        if (!S) {
          out.push({ item_id: id, name, type, n_listings: 0, lowest_listings: [] });
          continue;
        }

        out.push({
          item_id: id, name, type,
          n_listings: S.n, low: S.low, median: S.median, p10: S.p10, p90: S.p90,
          lowest_listings: arr.slice(0, top) // cheapest N
        });
      }
    }

    res.status(200).json({ count: out.length, results: out, warnings: errors.length ? ["Some items failed; partial results returned"] : [] });
  } catch (err) {
    return res.status(500).json({ error: "batch crashed", detail: String(err) });
  }
}

