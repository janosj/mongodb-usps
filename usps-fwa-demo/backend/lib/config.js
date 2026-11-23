import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The single root-level env file: usps-fwa-demo/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const provider = (process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase();

export const config = {
  port: Number(process.env.PORT || 5001),
  feedUrl: `http://localhost:${process.env.FEED_PORT || 5003}`,
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || 'usps_fwa',
  coll: {
    packages: process.env.COLL_PACKAGES || 'pieces',
    accounts: process.env.COLL_ACCOUNTS || 'accounts',
    tips: process.env.COLL_TIPS || 'tips',
    leads: process.env.COLL_LEADS || 'leads',
    metrics: process.env.COLL_SCAN_METRICS || 'scan_metrics',
  },
  useTransactions: String(process.env.USE_TRANSACTIONS || 'false').toLowerCase() === 'true',
  leadMode: (process.env.LEAD_MODE || 'template').toLowerCase(),
  openaiKey: process.env.OPENAI_API_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  embedding: {
    provider,
    model: process.env.EMBEDDING_MODEL || (provider === 'voyage' ? 'voyage-3.5' : 'text-embedding-3-small'),
    dims: Number(process.env.EMBEDDING_DIMS) || (provider === 'voyage' ? 1024 : 1536),
  },
  searchIndexes: { text: 'tips_text', vector: 'tips_vector' },
};
