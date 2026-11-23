import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { config } from './lib/config.js';
import { connect, col } from './lib/db.js';
import { addClient } from './lib/sse.js';
import { ingestLabel } from './lib/ingest.js';
import { seedAll } from './lib/seed.js';
import { getFlagged, getVolume, getGeo } from './lib/investigate.js';
import { searchRelated } from './lib/related.js';
import { draftLead, approveLead } from './lib/leads.js';
import { getFieldCoverage, getByDevice, getSampleWithNewField, setGuardrail, getGuardrail, tryMalformedInsert } from './lib/schema.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/health', (req, res) => res.json({ ok: true, db: config.dbName, embedding: config.embedding, leadMode: config.leadMode }));

// Live decisions, streamed to the UI
app.get('/api/stream', (req, res) => addClient(req, res));

// The in-flight API: upstream systems post label records here, in whatever shape they have today.
app.post('/api/ingest', wrap(async (req, res) => {
  const result = await ingestLabel(req.body);
  res.json(result);
}));

app.get('/api/accounts/:id', wrap(async (req, res) => {
  const acct = await col(config.coll.accounts).findOne({ _id: req.params.id });
  if (!acct) return res.status(404).json({ error: 'Not found' });
  res.json(acct);
}));

// Reset the demo to its starting state
app.post('/api/seed', wrap(async (req, res) => {
  await axios.post(`${config.feedUrl}/control`, { running: false, surge: false, version: 1 }).catch(() => {});
  const out = await seedAll((m) => console.log('  seed', m));
  res.json({ success: true, ...out });
}));

// Smart: investigate
app.get('/api/investigate/flagged', wrap(async (req, res) => res.json(await getFlagged())));
app.get('/api/investigate/volume', wrap(async (req, res) => {
  res.json(await getVolume(String(req.query.mailer_id), Number(req.query.minutes || 10)));
}));
app.get('/api/investigate/geo', wrap(async (req, res) => {
  res.json(await getGeo(String(req.query.account_id), String(req.query.mailer_id)));
}));
app.post('/api/search/related', wrap(async (req, res) => {
  const { queryText, region } = req.body || {};
  if (!queryText) return res.json({ query: '', vector: { results: [] }, lexical: { results: [] } });
  res.json(await searchRelated(queryText, region));
}));
app.post('/api/leads/draft', wrap(async (req, res) => {
  res.json(await draftLead(req.body.account_id, { refresh: !!req.body.refresh }));
}));
app.post('/api/leads/approve', wrap(async (req, res) => {
  res.json(await approveLead(req.body.account_id, req.body.reviewer));
}));

// Flexible: schema drift, new fields, guardrail
app.get('/api/schema/fields', wrap(async (req, res) => res.json(await getFieldCoverage())));
app.get('/api/schema/by-device', wrap(async (req, res) => res.json(await getByDevice())));
app.get('/api/labels/sample', wrap(async (req, res) => res.json(await getSampleWithNewField())));
app.get('/api/guardrail', wrap(async (req, res) => res.json(await getGuardrail())));
app.post('/api/guardrail', wrap(async (req, res) => res.json(await setGuardrail(!!req.body.enabled))));
app.post('/api/ingest/malformed', wrap(async (req, res) => {
  const out = await tryMalformedInsert();
  res.status(out.isValidationError ? 400 : 200).json(out);
}));

connect().then(() => {
  app.listen(config.port, () => {
    console.log(`USPS FWA backend running on port ${config.port}`);
  });
}).catch((err) => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
