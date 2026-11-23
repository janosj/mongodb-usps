import { performance } from 'perf_hooks';
import { config } from './config.js';
import { client, col } from './db.js';
import { decide } from '../../shared/rules.js';
import { broadcast } from './sse.js';

// Takes whatever shape an upstream system sends. There is no per-field mapping here:
// new fields in the payload are stored as they arrive.
export async function ingestLabel(payload) {
  const t0 = performance.now();
  const accounts = col(config.coll.accounts);
  const packages = col(config.coll.packages);

  const weigh = (payload.scans || []).find((s) => s.event === 'weight_check');
  const delta = weigh?.delta_oz ?? 0;
  const postage = Number(payload.postage_usd || 0);
  const now = new Date();

  const doc = { _id: payload.label_id, ...payload, created_at: now };
  const acctUpdate = [
    { _id: payload.account_id },
    {
      $inc: { exposure_usd: postage, labels_issued: 1 },
      $set: { last_seen: now },
      $setOnInsert: { name: 'Unknown account', typical_exposure_usd: 5000, mailer_id: payload.mailer_id },
    },
  ];
  const acctOpts = { upsert: true, returnDocument: 'after' };

  let acct;
  let decision;
  let decisionMs;

  if (config.useTransactions) {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        acct = await accounts.findOneAndUpdate(...acctUpdate, { ...acctOpts, session });
        decision = decide({ exposure_usd: acct.exposure_usd, typical_exposure_usd: acct.typical_exposure_usd, delta_oz: delta });
        decisionMs = performance.now() - t0;
        doc.decision = decision;
        await packages.insertOne(doc, { session });
      });
    } finally {
      await session.endSession();
    }
  } else {
    // One atomic update returns the new exposure, so the decision is ready after a single round trip.
    acct = await accounts.findOneAndUpdate(...acctUpdate, acctOpts);
    decision = decide({ exposure_usd: acct.exposure_usd, typical_exposure_usd: acct.typical_exposure_usd, delta_oz: delta });
    decisionMs = performance.now() - t0;
    doc.decision = decision;
    await packages.insertOne(doc);
  }
  const totalMs = performance.now() - t0;

  // The first hold moves the account out of good standing. Later holds skip this write.
  // Off the decision path, so it adds nothing to the decision time.
  if (decision.action === 'HOLD' && acct.status !== 'UNDER_REVIEW') {
    accounts
      .updateOne({ _id: payload.account_id }, { $set: { status: 'UNDER_REVIEW', status_changed_at: now } })
      .catch(() => {});
  }

  // Lightweight measurement for charts (MongoDB Time Series). Best effort, off the decision path.
  col(config.coll.metrics)
    .insertOne({
      ts: now,
      meta: { mailer_id: payload.mailer_id, account_id: payload.account_id },
      scans: 1,
      delta_oz: delta,
    })
    .catch(() => {});

  const result = {
    label_id: payload.label_id,
    account_id: payload.account_id,
    city: payload.scans?.[0]?.facility?.city,
    action: decision.action,
    reasons: decision.reasons,
    exposure_usd: acct.exposure_usd,
    typical_exposure_usd: acct.typical_exposure_usd,
    decision_ms: Math.round(decisionMs * 10) / 10,
    total_ms: Math.round(totalMs * 10) / 10,
    at: now.toISOString(),
  };
  broadcast(result);
  return result;
}
