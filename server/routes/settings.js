import { Router } from 'express';
import { getDb } from '../db/mongo.js';
import { SETTINGS_ID } from '../db/seed.js';

const router = Router();

router.get('/', async (req, res) => {
  const db = await getDb();
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  res.json(settings);
});

router.put('/', async (req, res) => {
  const fields = [
    'shop_name', 'address', 'state', 'phone', 'email', 'gstin',
    'invoice_prefix', 'estimate_prefix', 'invoice_footer', 'gold_rate_per_gram', 'silver_rate_per_gram'
  ];
  const body = req.body || {};
  const update = {};
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f];
  }
  const db = await getDb();
  await db.collection('settings').updateOne({ _id: SETTINGS_ID }, { $set: update });
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  res.json(settings);
});

export default router;
