import { MongoClient } from 'mongodb';
import { config } from './config.js';

export let client;
export let db;

export async function connect() {
  if (!config.mongoUri) {
    console.error('MONGODB_URI is not set. Copy dot-env.EXAMPLE to .env and fill it in.');
    process.exit(1);
  }
  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.dbName);
  console.log(`Connected to MongoDB: database [${config.dbName}]`);
  return db;
}

export const col = (name) => db.collection(name);
