# Torn Sidekick Proxy

This is a tiny Vercel serverless project that exposes two endpoints the Custom GPT can call.

Endpoints
- /api/torn/items, returns Torn items metadata
- /api/market/item/[itemId], returns Item Market listings for a specific item id

Environment variable
- TORN_API_KEY, set this in Vercel Project Settings

Deploy steps
1, Push these files to a new GitHub repo, or upload with GitHub web
2, On Vercel, New Project, Import your repo, Deploy
3, In Vercel Project Settings, Environment Variables, add TORN_API_KEY with your Torn key, then redeploy
4, Test, https, your-project.vercel.app/api/torn/items should return JSON
