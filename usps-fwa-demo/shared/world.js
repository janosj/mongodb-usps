// Shared, deterministic "world" for the demo: facilities and accounts.
// The seed script and the mock scan feed both import this, so they always agree.

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Synthetic processing facilities (city centers, approximate).
export const FACILITIES = [
  { city: 'Chicago', state: 'IL', zip: '60607', region: 'Midwest', lon: -87.63, lat: 41.88 },
  { city: 'Atlanta', state: 'GA', zip: '30301', region: 'South', lon: -84.39, lat: 33.75 },
  { city: 'Dallas', state: 'TX', zip: '75201', region: 'South', lon: -96.8, lat: 32.78 },
  { city: 'Los Angeles', state: 'CA', zip: '90012', region: 'West', lon: -118.24, lat: 34.05 },
  { city: 'Newark', state: 'NJ', zip: '07102', region: 'Northeast', lon: -74.17, lat: 40.73 },
  { city: 'Denver', state: 'CO', zip: '80202', region: 'West', lon: -104.99, lat: 39.74 },
  { city: 'Seattle', state: 'WA', zip: '98101', region: 'West', lon: -122.33, lat: 47.61 },
  { city: 'Miami', state: 'FL', zip: '33101', region: 'South', lon: -80.19, lat: 25.77 },
  { city: 'Kansas City', state: 'MO', zip: '64101', region: 'Midwest', lon: -94.58, lat: 39.1 },
  { city: 'Phoenix', state: 'AZ', zip: '85001', region: 'West', lon: -112.07, lat: 33.45 },
];

// The scenario: one account starts issuing counterfeit-looking labels from one facility.
export const SURGE = {
  accountId: 'ACCT-0042',
  facilityIndex: 0, // Chicago
  device: 'D-4471',
  labelStyle: 'v3',
};

// Fields every record carries in feed version 1. Anything else is "new".
export const BASELINE_FIELDS = {
  label: ['_id', 'label_id', 'account_id', 'mailer_id', 'postage_usd', 'scans', 'decision', 'created_at', 'source', 'schema_version'],
  scan: ['event', 'at', 'where', 'facility', 'declared_weight_oz', 'actual_weight_oz', 'delta_oz'],
};

const ADJ = ['Lakeside', 'Summit', 'Harbor', 'Prairie', 'Cedar', 'Granite', 'Riverbend', 'Maple', 'Beacon', 'Orchard', 'Keystone', 'Meridian', 'Sterling', 'Willow', 'Ironwood', 'Bluebird'];
const NOUN = ['Fulfillment', 'Parcel Co.', 'Logistics', 'Direct', 'Supply', 'Mailers', 'Goods', 'Distribution', 'Outfitters', 'Trading'];

export function buildAccounts(n = 150) {
  const r = rng(42);
  const accounts = [];
  for (let i = 0; i < n; i++) {
    const id = `ACCT-${String(i + 1).padStart(4, '0')}`;
    const home = Math.floor(r() * FACILITIES.length);
    const typical = Math.round((1500 + r() * 9000) / 100) * 100;
    accounts.push({
      _id: id,
      name: `${ADJ[Math.floor(r() * ADJ.length)]} ${NOUN[Math.floor(r() * NOUN.length)]}`,
      mailer_id: String(902000000 + i * 37 + Math.floor(r() * 30)),
      home_facility: home,
      region: FACILITIES[home].region,
      typical_exposure_usd: typical,
      exposure_usd: Math.round(typical * (0.7 + r() * 0.25)),
      labels_issued: 0,
      status: 'IN_GOOD_STANDING',
      payment_type: 'EPA',
    });
  }
  // The scenario account (index 41 => ACCT-0042).
  const s = accounts.find((a) => a._id === SURGE.accountId);
  s.name = 'Lakeside Fulfillment';
  s.mailer_id = '902144201';
  s.home_facility = SURGE.facilityIndex;
  s.region = FACILITIES[SURGE.facilityIndex].region;
  s.typical_exposure_usd = 6000;
  s.exposure_usd = 5400;
  return accounts;
}
