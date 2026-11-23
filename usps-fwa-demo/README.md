# USPS Fraud, Waste, and Abuse Demo

Companion demo for the webinar "Catching Fraud, Waste, and Abuse with MongoDB." All data is synthetic.
It follows the deck: **be fast, be smart, stay flexible.** Same conventions as `usps-ecommerce-demo`.

## Setup (once)

```bash
./install-all.sh                 # npm install in backend, mock-scan-feed, frontend
cp dot-env.EXAMPLE .env          # or copy your existing .env, then edit
cd backend && npm run setup      # collections, indexes, Atlas Search + Vector Search indexes (waits until queryable)
```

Then start everything and click **Reset Demo Data** in the header (loads the baseline data and the embeddings):

```bash
./run-all.sh                     # backend :5001, scan feed :5003, UI :3000 (ports from .env)
```

Or run each piece on its own: `backend/run-backend.sh`, `mock-scan-feed/run-feed.sh`, `frontend/run-frontend.sh`.

## Configuration

Every component reads `usps-fwa-demo/.env`. Just enter your MongoDB Atlas connect string and your AI embedding key.

The UI contains no hostnames or ports: it calls `/api/...` and `/feed/...`,
and `frontend/vite.config.js` proxies them using `PORT` and `FEED_PORT` from the same file.

## Initialization

- All data is preloaded by **Reset Demo Data**. Nothing loads during the demo.
- Embeddings are cached on disk (`backend/node_modules/.cache`), so resets after the first one make no API calls.
  The suggested search chips are cached too. Only a free-typed query makes one embedding call.
- The lead packet is assembled from the evidence in `LEAD_MODE=template` (instant). `llm` adds a model-written summary
  (a second or two) and every packet is cached, so a second click returns instantly and is labeled "generated earlier."
- Decision latency includes the trip from the backend to the cluster. Pick the Atlas region closest to you, and say so aloud.
  The data is small, so this shows how fast one decision is. It is not a benchmark.

## Folders

```
usps-fwa-demo/
  dot-env.EXAMPLE      .env lives here (not committed)
  shared/              facilities, accounts, label generator, hold rule, tips (used by backend AND feed)
  backend/             Express API, seed, setup (indexes), SSE stream
  mock-scan-feed/      the "upstream system" (control it from the UI)
  frontend/            Vite + React + Tailwind (USPS look, same as the eCommerce demo)
```

## Notes

- The hold rule lives in `shared/rules.js`: hold at 3x typical exposure, review on a weight mismatch over 3 oz. It is deliberately a rule, not a model.
- Changing the embedding provider, model, or dimensions: update `.env`, run `npm run setup` (recreates the vector index), then Reset Demo Data.
- Voyage AI: set `EMBEDDING_PROVIDER=voyage` and `VOYAGE_API_KEY`. The default model is `voyage-3.5` at 1024 dimensions; set
  `EMBEDDING_MODEL` and `EMBEDDING_DIMS` to use a newer one. Check the model name and dimensions against Voyage's current docs.
- Facility names, accounts, tips, and every figure are invented.
