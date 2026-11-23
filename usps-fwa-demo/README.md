# USPS Fraud, Waste, and Abuse Demo

Companion demo for the webinar "Catching Fraud, Waste, and Abuse with MongoDB AI." All data is synthetic.
It follows the deck: **be fast, be smart, stay flexible.** Same conventions as `usps-ecommerce-demo`.

## The story (about 8 minutes)

A mock upstream scan system posts label records to the backend. One account starts issuing counterfeit-looking labels.

| Tab | Beat | What the audience sees |
|---|---|---|
| 1 · Be fast | Live decisions | Scans arrive; each gets a decision with its latency. The account's exposure climbs past 3x its own typical level, and decisions flip from RELEASE to REVIEW to HOLD. |
| 2 · Be smart | Investigate | The surge appears as a spike (MongoDB Time Series) and a cluster (geospatial). Keyword search vs. search by meaning on related reports. A lead packet drafted from the evidence, approved by a person. |
| 3 · Stay flexible | Evolving data feeds | The upstream system upgrades to v2. New fields (`device_id`, `label_style`) appear in the records, show up in the field list on their own, and are queryable immediately. A guardrail rejects an incomplete record (Code 121). |

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

## One .env, one place

Every component reads `usps-fwa-demo/.env`. The UI contains no hostnames or ports: it calls `/api/...` and `/feed/...`,
and `frontend/vite.config.js` proxies them using `PORT` and `FEED_PORT` from the same file.

Variables: `MONGODB_URI`, `DB_NAME`, `COLL_PACKAGES`, `COLL_ACCOUNTS`, `COLL_TIPS`, `COLL_LEADS`, `COLL_SCAN_METRICS`,
`PORT`, `FEED_PORT`, `FRONTEND_PORT`, `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIMS`,
`LEAD_MODE`, `OPENAI_CHAT_MODEL`, `USE_TRANSACTIONS`.

## No waiting on stage

- All data is preloaded by **Reset Demo Data**. Nothing loads during the demo.
- Embeddings are cached on disk (`backend/node_modules/.cache`), so resets after the first one make no API calls.
  The suggested search chips are cached too. Only a free-typed query makes one embedding call.
- The lead packet is assembled from the evidence in `LEAD_MODE=template` (instant). `llm` adds a model-written summary
  (a second or two) and every packet is cached, so a second click returns instantly and is labeled "generated earlier."
- Decision latency includes the trip from the backend to the cluster. Pick the Atlas region closest to you, and say so aloud.
  The data is small, so this shows how fast one decision is. It is not a benchmark.

## Where the deck's claims show up

| Deck claim | In the demo |
|---|---|
| One read returns the whole record | `pieces` documents carry their scans and decision together |
| Transactions keep records consistent | `USE_TRANSACTIONS=true` wraps the decision and insert in one multi-document transaction |
| Time Series | `scan_metrics` is a MongoDB Time Series collection; the chart groups it with `$dateTrunc` |
| Geospatial | `$geoWithin` / `$centerSphere` around the account's home facility |
| Related evidence by meaning | Atlas Search (`tips_text`) next to Vector Search (`tips_vector`) over the same `tips` collection |
| Embeddings beside the record, with filters | `region` is a filter field in the vector index (the "Filter to the account's region" box) |
| Flexible records | The v2 feed adds fields with no change to the backend; the field list and the `device_id` query pick them up |
| Governed, not uncontrolled | Optional `$jsonSchema` validator; "Send an incomplete record" returns Code 121 |
| A person decides | The lead packet is a DRAFT until someone clicks **Approve as inspector** |

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
