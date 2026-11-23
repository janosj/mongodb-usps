// Mock upstream scan system. It posts label records to the backend API.
// Start it idle; the UI turns it on, injects the counterfeit surge, and upgrades it to v2.
//   node scan_feed.js         (version 1, the original shape)
//   node scan_feed.js --v2    (starts already on version 2)
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAccounts, SURGE } from '../shared/world.js';
import { makeLabel } from '../shared/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.FEED_PORT || 5003);
const BACKEND = `http://localhost:${process.env.PORT || 5001}`;

const accounts = buildAccounts();
const normal = accounts.filter((a) => a._id !== SURGE.accountId);
const surgeAcct = accounts.find((a) => a._id === SURGE.accountId);

const state = {
  running: false,
  rate: 40, // normal labels per second
  surgeRate: 60, // extra counterfeit labels per second while the surge is on
  version: process.argv.includes('--v2') ? 2 : 1,
  surge: false,
  sent: 0,
  errors: 0,
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let busy = false;
let timer = null;

async function tick() {
  const batch = [];
  const n = Math.max(1, Math.round(state.rate / 10));
  for (let i = 0; i < n; i++) batch.push(makeLabel({ account: pick(normal), version: state.version }));
  if (state.surge) {
    const m = Math.max(1, Math.round(state.surgeRate / 10));
    for (let i = 0; i < m; i++) batch.push(makeLabel({ account: surgeAcct, version: state.version, counterfeit: true }));
  }
  await Promise.all(
    batch.map((p) =>
      axios
        .post(`${BACKEND}/api/ingest`, p)
        .then(() => state.sent++)
        .catch(() => state.errors++)
    )
  );
}

function loop() {
  if (!state.running) {
    timer = null;
    return;
  }
  const t0 = Date.now();
  busy = true;
  tick().finally(() => {
    busy = false;
    timer = setTimeout(loop, Math.max(0, 100 - (Date.now() - t0)));
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/status', (req, res) => res.json(state));
app.post('/control', (req, res) => {
  const { running, rate, surgeRate, version, surge } = req.body || {};
  if (typeof rate === 'number') state.rate = rate;
  if (typeof surgeRate === 'number') state.surgeRate = surgeRate;
  if (version === 1 || version === 2) state.version = version;
  if (typeof surge === 'boolean') state.surge = surge;
  if (typeof running === 'boolean') {
    state.running = running;
    if (running && !timer && !busy) loop();
  }
  // A surge needs the feed running.
  if (state.surge && !state.running) {
    state.running = true;
    if (!timer && !busy) loop();
  }
  res.json(state);
});

app.listen(PORT, () => {
  console.log(`Mock scan feed on port ${PORT} (version ${state.version}). Posting to ${BACKEND}/api/ingest`);
});
