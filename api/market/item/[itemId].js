export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Missing TORN_API_KEY env var" });
  }
  const { itemId } = req.query;
  const url = `https://api.torn.com/market/${itemId}?selections=itemmarket&key=${key}`;
  const r = await fetch(url, { headers: { "User-Agent": "TornSidekick/1.0" } });
  const text = await r.text();
  res.status(r.status).send(text);
}
