import { config } from './config.js';
import { db, col } from './db.js';
import { embed } from './embeddings.js';
import { buildAccounts, FACILITIES, rng } from '../../shared/world.js';
import { makeLabel } from '../../shared/generate.js';
import { TIPS, QUERY_CHIPS, LEAD_QUERY } from '../../shared/tips.js';

const BASELINE_LABELS = 3000;
const BASELINE_HOURS = 2;

async function ensureCollection(name, options) {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) await db.createCollection(name, options);
}

async function insertInBatches(collection, docs, size = 1000) {
  for (let i = 0; i < docs.length; i += size) {
    await collection.insertMany(docs.slice(i, i + size), { ordered: false });
  }
}

export async function ensureCollections() {
  await ensureCollection(config.coll.packages);
  await ensureCollection(config.coll.accounts);
  await ensureCollection(config.coll.tips);
  await ensureCollection(config.coll.leads);
  await ensureCollection(config.coll.metrics, {
    timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'seconds' },
  });
}

// Resets the demo to its starting state. Search indexes live on the tips collection,
// so tips are cleared and reloaded (never dropped).
export async function seedAll(log = () => {}) {
  await ensureCollections();
  const r = rng(2026);
  const now = Date.now();

  // 1. Remove any guardrail left on from a previous run.
  await db.command({ collMod: config.coll.packages, validator: {}, validationLevel: 'off' }).catch(() => {});

  // 2. Accounts
  const accounts = buildAccounts();
  await col(config.coll.accounts).deleteMany({});
  await col(config.coll.accounts).insertMany(accounts);
  log(`accounts: ${accounts.length}`);

  // 3. Baseline labels spread across the last two hours (all normal)
  const labels = [];
  const metrics = [];
  for (let i = 0; i < BASELINE_LABELS; i++) {
    const acct = accounts[Math.floor(r() * accounts.length)];
    const t = new Date(now - r() * BASELINE_HOURS * 3600 * 1000);
    const p = makeLabel({ account: acct, now: t, version: 1, counterfeit: false, r });
    labels.push({ _id: p.label_id, ...p, decision: { action: 'RELEASE', reasons: [] }, created_at: t });
    metrics.push({ ts: t, meta: { mailer_id: p.mailer_id, account_id: p.account_id }, scans: 1, delta_oz: p.scans[1].delta_oz });
  }
  await col(config.coll.packages).deleteMany({});
  await insertInBatches(col(config.coll.packages), labels);
  log(`packages: ${labels.length}`);

  // 4. Time series: drop and recreate (fastest way to clear)
  await db.collection(config.coll.metrics).drop().catch(() => {});
  await ensureCollection(config.coll.metrics, {
    timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'seconds' },
  });
  await insertInBatches(col(config.coll.metrics), metrics);
  log(`scan_metrics: ${metrics.length}`);

  // 5. Tips with embeddings (cached on disk after the first run)
  const vectors = await embed(TIPS.map((t) => t.text), 'document');
  const tipDocs = TIPS.map((t, i) => ({
    _id: t.id,
    text: t.text,
    source: t.source,
    region: t.region,
    received_at: new Date(now - t.days_ago * 86400 * 1000),
    embedding: vectors[i],
  }));
  await col(config.coll.tips).deleteMany({});
  await col(config.coll.tips).insertMany(tipDocs);
  log(`tips: ${tipDocs.length}`);

  // 6. Warm the query embeddings: the suggested chips and the lead packet's search phrase
  await embed([...QUERY_CHIPS, LEAD_QUERY], 'query');

  // 7. Leads
  await col(config.coll.leads).deleteMany({});

  return { accounts: accounts.length, labels: labels.length, metrics: metrics.length, tips: tipDocs.length, facilities: FACILITIES.length };
}
