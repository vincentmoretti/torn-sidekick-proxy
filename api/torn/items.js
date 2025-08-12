export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Missing TORN_API_KEY env var" });
  }
  const url = `https://api.torn.com/torn/?selections=items&key=${key}`;
  const r = await fetch(url, { headers: { "User-Agent": "TornSidekick/1.0" } });
  const text = await r.text();
  res.status(r.status).send(text);
}
