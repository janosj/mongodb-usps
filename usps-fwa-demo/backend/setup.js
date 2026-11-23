// One-time setup: collections, regular indexes, and the two Atlas search indexes.
// Run:  cd backend && npm run setup
import { config } from './lib/config.js';
import { connect, client, db, col } from './lib/db.js';
import { ensureCollections } from './lib/seed.js';

const { text: TEXT_INDEX, vector: VECTOR_INDEX } = config.searchIndexes;

async function ensureSearchIndex(collection, name, type, definition) {
  const existing = await collection.listSearchIndexes(name).toArray();
  if (existing.length) {
    const dimsNow = existing[0]?.latestDefinition?.fields?.find?.((f) => f.type === 'vector')?.numDimensions;
    if (type === 'vectorSearch' && dimsNow && dimsNow !== config.embedding.dims) {
      console.log(`  ${name}: dimensions changed (${dimsNow} -> ${config.embedding.dims}), recreating`);
      await collection.dropSearchIndex(name);
      await new Promise((r) => setTimeout(r, 4000));
    } else {
      console.log(`  ${name}: already exists`);
      return;
    }
  }
  await collection.createSearchIndex({ name, type, definition });
  console.log(`  ${name}: created`);
}

async function waitQueryable(collection, names, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const all = await collection.listSearchIndexes().toArray();
    const ready = names.every((n) => all.find((i) => i.name === n)?.queryable);
    if (ready) return true;
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

await connect();
console.log('Creating collections...');
await ensureCollections();

console.log('Creating indexes...');
const packages = col(config.coll.packages);
await packages.createIndex({ 'scans.where': '2dsphere' });
await packages.createIndex({ created_at: -1 });
await packages.createIndex({ mailer_id: 1, created_at: -1 });
await packages.createIndex({ 'decision.action': 1, created_at: -1 });

console.log('Creating Atlas Search and Vector Search indexes on tips...');
const tips = col(config.coll.tips);
await ensureSearchIndex(tips, TEXT_INDEX, 'search', {
  mappings: { dynamic: false, fields: { text: { type: 'string' } } },
});
await ensureSearchIndex(tips, VECTOR_INDEX, 'vectorSearch', {
  fields: [
    { type: 'vector', path: 'embedding', numDimensions: config.embedding.dims, similarity: 'cosine' },
    { type: 'filter', path: 'region' },
  ],
});

process.stdout.write('Waiting for the search indexes to become queryable');
const ok = await waitQueryable(tips, [TEXT_INDEX, VECTOR_INDEX]);
console.log(ok ? '\nReady.' : '\nStill building. Check the Atlas UI, then continue.');
console.log('Next: start the backend and click "Reset Demo Data" (or run: npm run seed).');
await client.close();
