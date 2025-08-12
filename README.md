# Torn Sidekick Proxy

This is a tiny Vercel serverless project that exposes two endpoints the Custom GPT can call.

Endpoints
export default async function handler(req, res) {
  const key = process.env.TORN_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing TORN_API_KEY env var" });

  const { itemId } = req.query;
  // ✅ API v2 path: selection in the path, not in ?selections=
  const url = `https://api.torn.com/market/${itemId}/itemmarket?key=${key}`;

  const r = await fetch(url, { headers: { "User-Agent": "TornSidekick/1.0" } });
  const text = await r.text();
  res.status(r.status).send(text);
}


Environment variable
- TORN_API_KEY, set this in Vercel Project Settings

Deploy steps
1, Push these files to a new GitHub repo, or upload with GitHub web
2, On Vercel, New Project, Import your repo, Deploy
3, In Vercel Project Settings, Environment Variables, add TORN_API_KEY with your Torn key, then redeploy
4, Test, https, your-project.vercel.app/api/torn/items should return JSON
