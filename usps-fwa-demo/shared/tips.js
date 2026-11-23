// Synthetic tips and reports. All invented for the demo.
// Design note: the "related" tips describe the same problem in many different words, and
// mostly avoid the words "counterfeit" and "label". Keyword search for "counterfeit label"
// finds only a few. Search by meaning finds the rest. A couple of unrelated tips use the
// word "label" innocently, so keyword search also shows a false positive.
// The `related` flag is for tests only. It is not written to the database.

export const TIPS = [
  // ----- related to the counterfeit surge (varied wording) -----
  { id: 'T-1187', source: 'inspector', region: 'Midwest', days_ago: 1, related: true,
    text: 'Counterfeit shipping label spotted at the dock. The weight on the slip did not match the scale.' },
  { id: 'T-1204', source: 'carrier', region: 'Midwest', days_ago: 1, related: true,
    text: 'Parcel with a printed label that did not match the declared weight, flagged at the sorting belt.' },
  { id: 'T-1211', source: 'customer', region: 'Midwest', days_ago: 2, related: true,
    text: 'I bought discounted shipping from a seller on social media. The tracking number never showed any movement.' },
  { id: 'T-1219', source: 'customer', region: 'South', days_ago: 3, related: true,
    text: 'The barcode on the printout looked photocopied and the scanner at the counter would not read it.' },
  { id: 'T-1226', source: 'carrier', region: 'Midwest', days_ago: 1, related: true,
    text: 'Sticker on the box looked like a copy of a copy, with blurry postage marks and no clear tracking code.' },
  { id: 'T-1233', source: 'customer', region: 'West', days_ago: 4, related: true,
    text: 'A seller sent a printed shipping slip that the post office could not validate at the counter.' },
  { id: 'T-1240', source: 'customer', region: 'Midwest', days_ago: 2, related: true,
    text: 'The QR code on the shipping slip opened an error page instead of tracking.' },
  { id: 'T-1248', source: 'carrier', region: 'Midwest', days_ago: 1, related: true,
    text: 'Fake postage? The indicia on the envelope looked printed on plain paper from a screenshot.' },
  { id: 'T-1255', source: 'customer', region: 'Northeast', days_ago: 5, related: true,
    text: 'The tracking number on my parcel does not exist in any system, but the seller says it shipped.' },
  { id: 'T-1262', source: 'inspector', region: 'Midwest', days_ago: 1, related: true,
    text: 'Dozens of boxes from one sender carried postage that failed validation at the plant.' },
  { id: 'T-1270', source: 'inspector', region: 'Midwest', days_ago: 2, related: true,
    text: 'Several parcels from the same shipper carried near-identical slips with different tracking numbers.' },
  { id: 'T-1277', source: 'inspector', region: 'Midwest', days_ago: 1, related: true,
    text: 'Prepaid slips scanned as valid but the boxes weighed far less than the declared weight.' },
  { id: 'T-1284', source: 'customer', region: 'South', days_ago: 6, related: true,
    text: 'The postage on the package I received was refunded to the seller a day later, then voided.' },
  { id: 'T-1291', source: 'carrier', region: 'West', days_ago: 3, related: true,
    text: 'Package arrived with postage that looked real but the account on it says it was never paid.' },

  // ----- unrelated noise (some use "label" innocently) -----
  { id: 'T-1301', source: 'customer', region: 'Midwest', days_ago: 2, related: false,
    text: 'Carrier left my package in the rain and the contents were soaked.' },
  { id: 'T-1302', source: 'customer', region: 'South', days_ago: 3, related: false,
    text: 'The mail carrier was very polite and helped me carry a heavy box upstairs.' },
  { id: 'T-1303', source: 'customer', region: 'Midwest', days_ago: 1, related: false,
    text: 'My neighbor mailbox was pried open overnight and a few envelopes are missing.' },
  { id: 'T-1304', source: 'customer', region: 'Northeast', days_ago: 8, related: false,
    text: 'Holiday cards arrived two weeks late this year.' },
  { id: 'T-1305', source: 'customer', region: 'West', days_ago: 4, related: false,
    text: 'The post office lobby was closed on a weekday afternoon with no sign explaining why.' },
  { id: 'T-1306', source: 'customer', region: 'South', days_ago: 5, related: false,
    text: 'Package marked delivered but nothing was at my door.' },
  { id: 'T-1307', source: 'carrier', region: 'Midwest', days_ago: 2, related: false,
    text: 'Aggressive dog loose near the entrance of an apartment building on route 14.' },
  { id: 'T-1308', source: 'customer', region: 'West', days_ago: 6, related: false,
    text: 'The retailer never emailed the return label, so I could not send my refund package back.' },
  { id: 'T-1309', source: 'customer', region: 'Midwest', days_ago: 3, related: false,
    text: 'How do I print a return label for an exchange without a printer at home?' },
  { id: 'T-1310', source: 'customer', region: 'Northeast', days_ago: 7, related: false,
    text: 'Change of address was processed but mail still goes to my old apartment.' },
  { id: 'T-1311', source: 'customer', region: 'South', days_ago: 4, related: false,
    text: 'The parcel locker code did not open the door on the first two tries.' },
  { id: 'T-1312', source: 'carrier', region: 'West', days_ago: 2, related: false,
    text: 'Crushed corner on a box at the sorting belt, contents intact.' },
  { id: 'T-1313', source: 'customer', region: 'Midwest', days_ago: 9, related: false,
    text: 'The stamp vending machine kept my dollar and did not dispense anything.' },
  { id: 'T-1314', source: 'customer', region: 'Northeast', days_ago: 10, related: false,
    text: 'My passport application envelope took three weeks to arrive.' },
  { id: 'T-1315', source: 'carrier', region: 'Midwest', days_ago: 1, related: false,
    text: 'Forklift at the dock had a flat tire and slowed loading for an hour.' },
  { id: 'T-1316', source: 'customer', region: 'South', days_ago: 6, related: false,
    text: 'Mail forwarding for my dorm address stopped after the semester ended.' },
  { id: 'T-1317', source: 'customer', region: 'West', days_ago: 5, related: false,
    text: 'Two different carriers delivered to the wrong house on the same street this week.' },
  { id: 'T-1318', source: 'customer', region: 'Midwest', days_ago: 4, related: false,
    text: 'The line at the counter took forty minutes on Saturday morning.' },
  { id: 'T-1319', source: 'carrier', region: 'South', days_ago: 3, related: false,
    text: 'Heavy snow blocked the delivery route and vehicles could not reach the last three streets.' },
  { id: 'T-1320', source: 'customer', region: 'Northeast', days_ago: 8, related: false,
    text: 'Package sat in the facility for six days with no tracking update.' },
  { id: 'T-1321', source: 'customer', region: 'West', days_ago: 11, related: false,
    text: 'Great service at the counter, quick and friendly.' },
  { id: 'T-1322', source: 'customer', region: 'Midwest', days_ago: 6, related: false,
    text: 'A packet of seeds I ordered arrived in a damaged envelope.' },
  { id: 'T-1323', source: 'carrier', region: 'Northeast', days_ago: 2, related: false,
    text: 'Residents asked about moving their cluster mailbox closer to the building entrance.' },
  { id: 'T-1324', source: 'customer', region: 'South', days_ago: 7, related: false,
    text: 'Sent a certified letter and the green card never came back to me.' },
];

// The phrase the lead packet searches with. Cached at seed time so the first draft makes no API call.
export const LEAD_QUERY = 'counterfeit shipping label with fake postage that will not scan or validate';

// Suggested queries for the presenter. Their embeddings are cached at seed time.
export const QUERY_CHIPS = [
  'counterfeit label',
  'fake postage on a package',
  'shipping slip that will not scan',
];
