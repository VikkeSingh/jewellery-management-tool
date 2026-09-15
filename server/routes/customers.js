import { Router } from 'express';
import { getDb, toObjectId, isValidObjectId } from '../db/mongo.js';
import { withId, withIds } from '../db/serialize.js';

const router = Router();

router.get('/', async (req, res) => {
  const { q } = req.query;
  const db = await getDb();
  const filter = q
    ? { $or: [{ name: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }] }
    : {};
  const customers = await db.collection('customers').find(filter).sort({ name: 1 }).toArray();
  res.json(withIds(customers));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  const db = await getDb();
  const doc = {
    name: b.name,
    phone: b.phone || '',
    address: b.address || '',
    state: b.state || '',
    gstin: b.gstin || '',
    created_at: new Date().toISOString(),
  };
  const result = await db.collection('customers').insertOne(doc);
  res.status(201).json(withId({ _id: result.insertedId, ...doc }));
});

router.put('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Customer not found' });
  const db = await getDb();
  const existing = await db.collection('customers').findOne({ _id: toObjectId(req.params.id) });
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  const fields = ['name', 'phone', 'address', 'state', 'gstin'];
  const update = {};
  const b = req.body || {};
  for (const f of fields) if (b[f] !== undefined) update[f] = b[f];
  await db.collection('customers').updateOne({ _id: toObjectId(req.params.id) }, { $set: update });
  const updated = await db.collection('customers').findOne({ _id: toObjectId(req.params.id) });
  res.json(withId(updated));
});

export default router;
