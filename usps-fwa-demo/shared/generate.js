// Builds one synthetic label record in the shape an upstream scan system would send.
// Version 1 is the original shape. Version 2 adds new fields (device_id, label_style)
// to show a feed changing in flight.

import { FACILITIES, SURGE } from './world.js';

const digits = (r, n) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');
const jitter = (r, c, spread) => c + (r() - 0.5) * 2 * spread;
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

let seq = 0;

export function makeLabel({ account, now = new Date(), version = 1, counterfeit = false, r = Math.random }) {
  const fac = counterfeit ? FACILITIES[SURGE.facilityIndex] : FACILITIES[account.home_facility];
  const spread = counterfeit ? 0.12 : 2.2; // surge is tight; normal traffic is spread across the region
  const declared = round1(8 + r() * 40);
  const delta = counterfeit ? round1((8 + r() * 17) * (r() < 0.5 ? -1 : 1)) : round1((r() - 0.5) * 0.8);
  const actual = round1(declared + delta);
  const postage = counterfeit ? round2(14 + r() * 20) : round2(4 + r() * 36);

  const acceptAt = new Date(now.getTime() - 20000);
  const accept = {
    event: 'accept',
    at: acceptAt,
    where: { type: 'Point', coordinates: [round2(jitter(r, fac.lon, spread)), round2(jitter(r, fac.lat, spread * 0.7))] },
    facility: { zip: fac.zip, city: fac.city },
  };
  const weigh = {
    event: 'weight_check',
    at: now,
    declared_weight_oz: declared,
    actual_weight_oz: actual,
    delta_oz: delta,
  };

  const payload = {
    label_id: `9405511899${String(++seq).padStart(6, '0')}${digits(r, 6)}`,
    account_id: account._id,
    mailer_id: account.mailer_id,
    postage_usd: postage,
    scans: [accept, weigh],
    source: `scan-feed-v${version}`,
    schema_version: version,
  };

  if (version >= 2) {
    const device = counterfeit && r() < 0.9 ? SURGE.device : `D-${1000 + Math.floor(r() * 3000)}`;
    accept.device_id = device;
    weigh.device_id = device;
    payload.label_style = counterfeit ? SURGE.labelStyle : r() < 0.5 ? 'v1' : 'v2';
  }
  return payload;
}
