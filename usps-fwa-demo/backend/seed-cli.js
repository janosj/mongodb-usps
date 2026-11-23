// Command-line reset (same as the "Reset Demo Data" button).  Run: cd backend && npm run seed
import { connect, client } from './lib/db.js';
import { seedAll } from './lib/seed.js';

await connect();
const out = await seedAll((m) => console.log('  ' + m));
console.log('Seeded:', out);
await client.close();
