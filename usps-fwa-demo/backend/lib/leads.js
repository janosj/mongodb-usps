import axios from 'axios';
import { config } from './config.js';
import { col } from './db.js';
import { getVolume, getGeo, RADIUS_MILES } from './investigate.js';
import { searchRelated } from './related.js';
import { LEAD_QUERY as CANONICAL_QUERY } from '../../shared/tips.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

async function gatherEvidence(accountId) {
  const accounts = col(config.coll.accounts);
  const packages = col(config.coll.packages);
  const acct = await accounts.findOne({ _id: accountId });
  if (!acct) throw new Error(`Unknown account ${accountId}`);
  const since = new Date(Date.now() - 6 * 3600 * 1000);

  const [stats] = await packages
    .aggregate([
      { $match: { account_id: accountId, created_at: { $gte: since }, 'decision.action': { $in: ['HOLD', 'REVIEW'] } } },
      {
        $group: {
          _id: null,
          flagged: { $sum: 1 },
          held: { $sum: { $cond: [{ $eq: ['$decision.action', 'HOLD'] }, 1, 0] } },
          weight_mismatches: { $sum: { $cond: [{ $in: ['WEIGHT_MISMATCH', '$decision.reasons'] }, 1, 0] } },
          first: { $min: '$created_at' },
          last: { $max: '$created_at' },
        },
      },
    ])
    .toArray();

  const devices = await packages
    .aggregate([
      { $match: { account_id: accountId, created_at: { $gte: since }, 'decision.action': { $in: ['HOLD', 'REVIEW'] }, 'scans.device_id': { $exists: true } } },
      { $group: { _id: { $arrayElemAt: ['$scans.device_id', 0] }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ])
    .toArray();

  const [volume, geo, related] = await Promise.all([
    getVolume(acct.mailer_id, 10),
    getGeo(accountId, acct.mailer_id),
    searchRelated(CANONICAL_QUERY),
  ]);
  const peak = Math.max(0, ...volume.buckets.map((b) => b.count));

  return {
    account: { id: acct._id, name: acct.name, mailer_id: acct.mailer_id },
    exposure: { current_usd: acct.exposure_usd, typical_usd: acct.typical_exposure_usd, multiple: Math.round((acct.exposure_usd / acct.typical_exposure_usd) * 10) / 10 },
    labels: stats ? { flagged: stats.flagged, held: stats.held, weight_mismatches: stats.weight_mismatches, first: stats.first, last: stats.last } : { flagged: 0, held: 0, weight_mismatches: 0 },
    volume: { peak_per_10s: peak, typical_per_10s: volume.baseline },
    place: { city: geo.cluster.city, radius_miles: RADIUS_MILES, mailer_count: geo.cluster.mailer_count, all_count: geo.cluster.all_count },
    device: devices[0] ? { id: devices[0]._id, flagged_labels: devices[0].n, share_pct: stats ? Math.round((devices[0].n / stats.flagged) * 100) : null } : null,
    related_tips: related.vector.results.slice(0, 5).map((t) => ({ id: t._id, text: t.text, source: t.source, score: Math.round(t.score * 1000) / 1000 })),
  };
}

function templateNarrative(e) {
  const cites = e.related_tips.map((t) => `[${t.id}]`).join(' ');
  const parts = [
    `${e.account.name} (${e.account.id}, mailer ID ${e.account.mailer_id}) has ${e.labels.flagged} flagged labels in the last six hours, ${e.labels.held} of them held.`,
    `${e.labels.weight_mismatches} show a scanned weight that does not match the declared weight.`,
    `Postage issued but not collected is ${money(e.exposure.current_usd)}, ${e.exposure.multiple}x this account's typical ${money(e.exposure.typical_usd)}.`,
    `Scan volume peaked at ${e.volume.peak_per_10s} per 10 seconds against a typical ${e.volume.typical_per_10s}.`,
    `${e.place.mailer_count} of the account's recent scans fall within ${e.place.radius_miles} miles of ${e.place.city}.`,
  ];
  if (e.device) parts.push(`Device ${e.device.id} appears on ${e.device.share_pct}% of the flagged labels.`);
  if (e.related_tips.length) parts.push(`${e.related_tips.length} related reports describe postage that fails to scan or validate ${cites}.`);
  parts.push('Recommended next step: review the evidence below and decide whether to open a case.');
  return parts.join(' ');
}

async function llmNarrative(e) {
  if (!config.openaiKey) throw new Error('OPENAI_API_KEY is not set');
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: config.chatModel,
      temperature: 0.2,
      max_tokens: 240,
      messages: [
        {
          role: 'system',
          content:
            'You draft a short lead summary for a postal inspector. Use ONLY the evidence JSON provided. Do not invent facts. Cite related reports by their id in square brackets, like [T-1187]. Write 4 to 6 sentences. End with a recommended next step that leaves the decision to the inspector.',
        },
        { role: 'user', content: JSON.stringify(e) },
      ],
    },
    { headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content.trim();
}

export async function draftLead(accountId, { refresh = false } = {}) {
  const leads = col(config.coll.leads);
  const id = `LEAD-${accountId}`;
  if (!refresh) {
    const cached = await leads.findOne({ _id: id });
    if (cached) return { ...cached, cached: true };
  }
  const started = Date.now();
  const evidence = await gatherEvidence(accountId);
  let narrative;
  let mode = 'template';
  if (config.leadMode === 'llm') {
    try {
      narrative = await llmNarrative(evidence);
      mode = 'llm';
    } catch (err) {
      console.warn('LLM narrative failed, using template:', err.message);
    }
  }
  if (!narrative) narrative = templateNarrative(evidence);

  const packet = {
    _id: id,
    status: 'DRAFT',
    mode,
    generated_at: new Date(),
    build_ms: Date.now() - started,
    evidence,
    narrative,
    citations: evidence.related_tips.map((t) => t.id),
  };
  await leads.replaceOne({ _id: id }, packet, { upsert: true });
  return { ...packet, cached: false };
}

export async function approveLead(accountId, reviewer = 'Postal Inspector (demo)') {
  const id = `LEAD-${accountId}`;
  await col(config.coll.leads).updateOne({ _id: id }, { $set: { status: 'APPROVED', approved_by: reviewer, approved_at: new Date() } });
  return col(config.coll.leads).findOne({ _id: id });
}
