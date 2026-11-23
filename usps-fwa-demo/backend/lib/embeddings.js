import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Kept under node_modules so the repo's .gitignore already excludes it.
const CACHE_DIR = path.resolve(__dirname, '../node_modules/.cache/usps-fwa');
const CACHE_FILE = path.join(CACHE_DIR, 'embeddings.json');

let cache = null;
function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}
function saveCache() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.warn('Could not write embedding cache:', e.message);
  }
}

const keyFor = (text, inputType) => {
  const { provider, model, dims } = config.embedding;
  return crypto.createHash('sha1').update([provider, model, dims, inputType, text].join('|')).digest('hex');
};

async function callProvider(texts, inputType) {
  const { provider, model, dims } = config.embedding;
  if (provider === 'voyage') {
    if (!config.voyageKey) throw new Error('VOYAGE_API_KEY is not set');
    const res = await axios.post(
      'https://api.voyageai.com/v1/embeddings',
      { input: texts, model, input_type: inputType, output_dimension: dims },
      { headers: { Authorization: `Bearer ${config.voyageKey}`, 'Content-Type': 'application/json' } }
    );
    return res.data.data.map((d) => d.embedding);
  }
  if (!config.openaiKey) throw new Error('OPENAI_API_KEY is not set');
  const body = { model, input: texts };
  if (model.startsWith('text-embedding-3')) body.dimensions = dims;
  const res = await axios.post('https://api.openai.com/v1/embeddings', body, {
    headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' },
  });
  return res.data.data.map((d) => d.embedding);
}

// inputType: 'document' for stored text, 'query' for search text.
// Results are cached on disk, so repeat runs (and reseeding) need no API calls.
export async function embed(texts, inputType = 'document') {
  const c = loadCache();
  const out = new Array(texts.length);
  const missing = [];
  texts.forEach((t, i) => {
    const hit = c[keyFor(t, inputType)];
    if (hit) out[i] = hit;
    else missing.push(i);
  });
  if (missing.length) {
    const vecs = await callProvider(missing.map((i) => texts[i]), inputType);
    missing.forEach((idx, j) => {
      out[idx] = vecs[j];
      c[keyFor(texts[idx], inputType)] = vecs[j];
    });
    saveCache();
  }
  return out;
}
