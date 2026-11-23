import { config } from './config.js';
import { col } from './db.js';
import { FACILITIES } from '../../shared/world.js';

export const RADIUS_MILES = 25;
const EARTH_MILES = 3963.2;

export async function getFlagged() {
  const since = new Date(Date.now() - 6 * 3600 * 1000);
  return col(config.coll.packages)
    .aggregate([
      { $match: { 'decision.action': { $in: ['HOLD', 'REVIEW'] }, created_at: { $gte: since } } },
      {
        $group: {
          _id: '$account_id',
          mailer_id: { $first: '$mailer_id' },
          flags: { $sum: 1 },
          holds: { $sum: { $cond: [{ $eq: ['$decision.action', 'HOLD'] }, 1, 0] } },
          first_flag: { $min: '$created_at' },
          last_flag: { $max: '$created_at' },
        },
      },
      { $sort: { flags: -1 } },
      { $limit: 8 },
      { $lookup: { from: config.coll.accounts, localField: '_id', foreignField: '_id', as: 'acct' } },
      { $unwind: '$acct' },
      {
        $project: {
          account_id: '$_id',
          _id: 0,
          name: '$acct.name',
          mailer_id: 1,
          flags: 1,
          holds: 1,
          first_flag: 1,
          last_flag: 1,
          exposure_usd: '$acct.exposure_usd',
          typical_exposure_usd: '$acct.typical_exposure_usd',
          home_facility: '$acct.home_facility',
          region: '$acct.region',
        },
      },
    ])
    .toArray();
}

// Scans per 10 seconds for one mailer ID, from the MongoDB Time Series collection.
export async function getVolume(mailerId, minutes = 10) {
  const metrics = col(config.coll.metrics);
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const rows = await metrics
    .aggregate([
      { $match: { ts: { $gte: since }, 'meta.mailer_id': mailerId } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'second', binSize: 10 } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  // Typical rate for this mailer: the two hours before the window.
  const before = await metrics.countDocuments({
    'meta.mailer_id': mailerId,
    ts: { $gte: new Date(since.getTime() - 2 * 3600 * 1000), $lt: since },
  });
  const baseline = Math.round((before / 720) * 100) / 100; // 720 ten-second buckets in two hours

  // Fill gaps so the chart is continuous.
  const buckets = [];
  const byTime = new Map(rows.map((r) => [new Date(r._id).getTime(), r.count]));
  const start = Math.floor(since.getTime() / 10000) * 10000;
  const end = Math.floor(Date.now() / 10000) * 10000;
  for (let t = start; t <= end; t += 10000) buckets.push({ t, count: byTime.get(t) || 0 });
  return { buckets, baseline, window_minutes: minutes };
}

// Points for the map, plus a geospatial count around the account's home facility.
export async function getGeo(accountId, mailerId) {
  const packages = col(config.coll.packages);
  const acct = await col(config.coll.accounts).findOne({ _id: accountId });
  const home = FACILITIES[acct?.home_facility ?? 0];
  const since = new Date(Date.now() - 30 * 60 * 1000);

  const [mine, others] = await Promise.all([
    packages
      .find({ mailer_id: mailerId, created_at: { $gte: since } }, { projection: { 'scans.where': 1, 'decision.action': 1 } })
      .sort({ created_at: -1 })
      .limit(400)
      .toArray(),
    packages.aggregate([{ $sample: { size: 300 } }, { $project: { 'scans.where': 1 } }]).toArray(),
  ]);

  const pt = (d, flagged) => {
    const w = d.scans?.find((s) => s.where)?.where?.coordinates;
    return w ? { lon: w[0], lat: w[1], flagged } : null;
  };
  const points = [
    ...others.map((d) => pt(d, false)),
    ...mine.map((d) => pt(d, d.decision?.action !== 'RELEASE')),
  ].filter(Boolean);

  const circle = { $geoWithin: { $centerSphere: [[home.lon, home.lat], RADIUS_MILES / EARTH_MILES] } };
  const [flaggedNear, allNear] = await Promise.all([
    packages.countDocuments({ 'scans.where': circle, mailer_id: mailerId, created_at: { $gte: since } }),
    packages.countDocuments({ 'scans.where': circle, created_at: { $gte: since } }),
  ]);

  return {
    facilities: FACILITIES.map((f) => ({ city: f.city, lon: f.lon, lat: f.lat })),
    points,
    cluster: { city: home.city, lon: home.lon, lat: home.lat, radius_miles: RADIUS_MILES, mailer_count: flaggedNear, all_count: allNear },
  };
}
