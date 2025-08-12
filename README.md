# Torn Sidekick Proxy

Tiny Vercel serverless project that exposes two read-only endpoints your Custom GPT can call.

## Endpoints
- `GET /api/torn/items` — Torn items metadata (ids, names, types)
- `GET /api/market/item/{itemId}` — Item Market listings for a specific item (API v2)

## Environment Variables
- `TORN_API_KEY` — your Torn API key (set in Vercel Project → Settings → Environment Variables)

## Deploy (GitHub + Vercel)
1) Upload these files to the repo root:
   - `api/torn/items.js`
   - `api/market/item/[itemId].js`
   - `package.json`
   - `README.md`
2) In Vercel: **New Project → Import** this repo → **Deploy**.
3) In Vercel → Project **Settings → Environment Variables**, add `TORN_API_KEY` (Production + Preview).
4) Trigger a new build (Redeploy the latest or make a tiny README edit).

## Test
- `https://YOUR_DOMAIN.vercel.app/api/torn/items`
- `https://YOUR_DOMAIN.vercel.app/api/market/item/261`

You should get JSON. If you see “Missing TORN_API_KEY,” set the env var and redeploy.

## Notes
- API v2 is required for `itemmarket`. The handler uses:
  `https://api.torn.com/v2/market/{itemId}/itemmarket?key=...`
- Seeing a 404 at the site root `/` is normal (we didn’t make a homepage).
  Optional: create `api/index.js` to return `{ ok: true }`.
