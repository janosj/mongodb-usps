import { config } from './config.js';
import { db, col } from './db.js';
import { BASELINE_FIELDS } from '../../shared/world.js';

// Which fields exist across the newest records, and how common each one is.
export async function getFieldCoverage() {
  const packages = col(config.coll.packages);
  const [labelFields, scanFields, labelTotal] = await Promise.all([
    packages
      .aggregate([
        { $sort: { created_at: -1 } },
        { $limit: 500 },
        { $project: { kv: { $objectToArray: '$$ROOT' } } },
        { $unwind: '$kv' },
        { $group: { _id: '$kv.k', count: { $sum: 1 } } },
      ])
      .toArray(),
    packages
      .aggregate([
        { $sort: { created_at: -1 } },
        { $limit: 500 },
        { $unwind: '$scans' },
        { $project: { kv: { $objectToArray: '$scans' } } },
        { $unwind: '$kv' },
        { $group: { _id: '$kv.k', count: { $sum: 1 } } },
      ])
      .toArray(),
    packages.estimatedDocumentCount(),
  ]);
  const sample = Math.min(500, labelTotal);
  const rows = [];
  for (const f of labelFields) rows.push({ level: 'label', path: f._id, pct: Math.round((f.count / sample) * 100), is_new: !BASELINE_FIELDS.label.includes(f._id) });
  for (const f of scanFields) rows.push({ level: 'scan', path: `scans.${f._id}`, pct: Math.min(100, Math.round((f.count / (sample * 2)) * 100)), is_new: !BASELINE_FIELDS.scan.includes(f._id) });
  rows.sort((a, b) => Number(b.is_new) - Number(a.is_new) || a.path.localeCompare(b.path));
  return { sample, rows };
}

// Group by a field that did not exist yesterday. No migration, no new index needed to ask.
export async function getByDevice() {
  return col(config.coll.packages)
    .aggregate([
      { $match: { 'scans.device_id': { $exists: true } } },
      {
        $group: {
          _id: { $arrayElemAt: ['$scans.device_id', 0] },
          labels: { $sum: 1 },
          flagged: { $sum: { $cond: [{ $in: ['$decision.action', ['HOLD', 'REVIEW']] }, 1, 0] } },
        },
      },
      { $sort: { flagged: -1, labels: -1 } },
      { $limit: 6 },
      { $project: { _id: 0, device_id: '$_id', labels: 1, flagged: 1 } },
    ])
    .toArray();
}

export async function getSampleWithNewField() {
  const packages = col(config.coll.packages);
  // Always the newest record, so the card follows the feed in both directions (v1 to v2 and back).
  const [doc] = await packages.find({}).sort({ created_at: -1 }).limit(1).toArray();
  return { doc: doc || null, has_new_fields: !!doc?.scans?.some((s) => s.device_id) };
}

const VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['label_id', 'account_id', 'scans'],
    properties: {
      label_id: { bsonType: 'string', description: 'Every record needs a label ID' },
      account_id: { bsonType: 'string', description: 'Every record needs an account' },
      scans: { bsonType: 'array', minItems: 1, description: 'At least one scan event' },
    },
  },
};

export async function setGuardrail(enabled) {
  await db.command({
    collMod: config.coll.packages,
    validator: enabled ? VALIDATOR : {},
    validationLevel: enabled ? 'strict' : 'off',
    validationAction: 'error',
  });
  return { enabled, validator: enabled ? VALIDATOR : null };
}

export async function getGuardrail() {
  const info = await db.listCollections({ name: config.coll.packages }).toArray();
  const v = info[0]?.options?.validator;
  return { enabled: !!(v && Object.keys(v).length), validator: v || null };
}

export async function tryMalformedInsert() {
  const id = `BAD-${Date.now()}`;
  try {
    await col(config.coll.packages).insertOne({ _id: id, label_id: id, scans: [] }); // no account_id
    await col(config.coll.packages).deleteOne({ _id: id }); // clean up if nothing stopped it
    return { accepted: true };
  } catch (error) {
    if (error.code === 121) {
      return {
        accepted: false,
        isValidationError: true,
        code: error.code,
        name: error.name,
        message: error.message,
        errInfo: error.errInfo || null,
      };
    }
    throw error;
  }
}
