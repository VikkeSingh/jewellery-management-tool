import { getDb } from './mongo.js';

const SETTINGS_ID = 'main';

let ensured = false;

export async function ensureDb() {
  if (ensured) return;
  const db = await getDb();

  await db.collection('settings').updateOne(
    { _id: SETTINGS_ID },
    {
      $setOnInsert: {
        _id: SETTINGS_ID,
        shop_name: process.env.SEED_SHOP_NAME || 'My Jewellery Shop',
        address: process.env.SEED_SHOP_ADDRESS || '',
        state: process.env.SEED_SHOP_STATE || '',
        phone: process.env.SEED_SHOP_PHONE || '',
        email: process.env.SEED_SHOP_EMAIL || '',
        gstin: process.env.SEED_SHOP_GSTIN || '',
        invoice_prefix: process.env.SEED_INVOICE_PREFIX || 'INV',
        next_invoice_no: 1,
        estimate_prefix: process.env.SEED_ESTIMATE_PREFIX || 'EST',
        next_estimate_no: 1,
        order_prefix: process.env.SEED_ORDER_PREFIX || 'ORD',
        next_order_no: 1,
        invoice_footer: process.env.SEED_INVOICE_FOOTER || 'Thank you for your business!',
        gold_rate_per_gram: Number(process.env.SEED_GOLD_RATE || 0),
        silver_rate_per_gram: Number(process.env.SEED_SILVER_RATE || 0),
        diamond_rate_per_carat: Number(process.env.SEED_DIAMOND_RATE || 0),
      },
    },
    { upsert: true }
  );

  // Backfill numbering fields for a settings doc that predates a document
  // type being introduced.
  await db.collection('settings').updateOne(
    { _id: SETTINGS_ID, estimate_prefix: { $exists: false } },
    { $set: { estimate_prefix: 'EST', next_estimate_no: 1 } }
  );
  await db.collection('settings').updateOne(
    { _id: SETTINGS_ID, order_prefix: { $exists: false } },
    { $set: { order_prefix: 'ORD', next_order_no: 1 } }
  );
  await db.collection('settings').updateOne(
    { _id: SETTINGS_ID, diamond_rate_per_carat: { $exists: false } },
    { $set: { diamond_rate_per_carat: 0 } }
  );

  await Promise.all([
    db.collection('pieces').createIndex({ article_id: 1 }),
    db.collection('pieces').createIndex({ status: 1 }),
    db.collection('pieces').createIndex({ tag_number: 1 }, { unique: true, sparse: true }),
    db.collection('articles').createIndex({ sku: 1 }, { unique: true, sparse: true }),
    db.collection('invoices').createIndex({ invoice_number: 1 }, { unique: true }),
    db.collection('orders').createIndex({ order_number: 1 }, { unique: true }),
    db.collection('orders').createIndex({ status: 1 }),
    db.collection('customers').createIndex({ name: 1 }),
    db.collection('customers').createIndex({ phone: 1 }),
  ]);

  ensured = true;
}

export { SETTINGS_ID };
