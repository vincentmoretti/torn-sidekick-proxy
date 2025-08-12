// Faster, Edge-based scanner with concurrency + small defaults
export const config = { runtime: 'edge' };

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

export default async function handler(req) {
  const url = new URL(req.url);
  const key = process.env.TORN_API_KEY;
  if (!key) return json({ error: 'Missing TORN_API_KEY env var' }, 500);

  const minPrice = Number(url.searchParams.get('minPrice') ?? 1000);
  const margin = Number(url.searchParams.get('margin') ?? 5);
  const needListings = Number(url.searchParams.get('needListings') ?? 10);
  const category = (url.searchParams.get('category') || '').toLowerCase();
  const maxItems = Math.max(1, Math.min(12, Number(url.searchParams.get('maxItems') ?? 12))); // cap low for speed

  const base = 'https://api.torn.com';
  const ua = { headers: { 'User-Agent': 'TornSidekick/1.0' } };

  // 1) Load item catalog (server-side; fine here)
  const itemsResp = await fetch(`${base}/torn/?selections=items&key=${key}`, ua);
  const itemsData = await itemsResp.json();
  const items = itemsData?.items || {};

  // 2) Candidate set
  let candidates = Object.entries(items)
    .map(([id, meta]) => ({ item_id: Number(id), name: meta.name, type: meta.type }))
    .filter(x => !category || (x.type || '').toLowerCase() === category)
    .slice(0, maxItems);

  // 3) Utils
  async function getListings(id) {
    const r = await fetch(`${base}/v2/market/${id}/itemmarket?key=${key}`, ua);
    try { return await r.json(); } catch { return {}; }
  }
  const chunk = (arr, n) => arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i+n)]), []);

  const results = [];
  const concurrency = 6; // small batch to stay friendly

  for (const group of chunk(candidates, concurrency)) {
    const groupData = await Promise.all(group.map(c =>
      getListings(c.item_id)
        .then(d => ({ c, d }))
        .catch(() => ({ c, d: {} }))
    ));

    for (const { c, d } of groupData) {
      const list = (d?.itemmarket || [])
        .map(x => ({ price: Number(x.cost), qty: Number(x.quantity || 1), seller: x.ID || '' }))
        .filter(x => Number.isFinite(x.price))
        .sort((a, b) => a.price - b.price);

      const prices = list.map(x => x.price);
      const n = prices.length;
      if (!n || n < needListings) continue;

      const median = n % 2 ? prices[(n - 1) / 2] : Math.round((prices[n / 2 - 1] + prices[n / 2]) / 2);
      const p10 = prices[Math.floor((n - 1) * 0.10)];
      const p90 = prices[Math.floor((n - 1) * 0.90)];
      const low = prices[0];

      if (low < minPrice) continue;

      const thresh = Math.round(median * (1 - margin / 100));
      const deals = list
        .filter(x => x.price <= thresh)
        .slice(0, 3)
        .map(x => ({
          price: x.price,
          qty: x.qty,
          seller: x.seller,
          pct_under: Math.round((1 - x.price / median) * 1000) / 10
        }));

      // require at least two cheap listings to avoid single-outlier traps
      if (deals.length >= 2) {
        results.push({
          item_id: c.item_id,
          name: c.name,
          type: c.type,
          n_listings: n,
          low,
          median,
          p10,
          p90,
          deals
        });
      }
    }
  }

  results.sort((a, b) => (b.deals[0]?.pct_under || 0) - (a.deals[0]?.pct_under || 0));
  return json({ params: { minPrice, margin, needListings, category, maxItems }, count: results.length, results });
}

