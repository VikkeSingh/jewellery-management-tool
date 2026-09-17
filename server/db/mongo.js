import { MongoClient, ObjectId } from 'mongodb';

// Cache the client/connection across invocations. On Vercel, the module
// scope can be reused between requests in the same warm serverless
// instance, so we avoid reconnecting every time. In local dev this also
// avoids creating a new connection per hot-reload.
let cachedClient = globalThis.__mongoClient;
let cachedDb = globalThis.__mongoDb;

async function getDb() {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  const client = cachedClient || new MongoClient(uri, { maxPoolSize: 10 });
  if (!cachedClient) {
    await client.connect();
    cachedClient = client;
    globalThis.__mongoClient = client;
  }
  cachedDb = client.db(process.env.MONGODB_DB_NAME || 'jewellery_shop');
  globalThis.__mongoDb = cachedDb;
  return cachedDb;
}

export function isValidObjectId(id) {
  return typeof id === 'string' && ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

export function toObjectId(id) {
  return new ObjectId(id);
}

async function getClient() {
  await getDb();
  return cachedClient;
}

export { getDb, getClient, ObjectId };
