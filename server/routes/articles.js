import { Router } from 'express';
import { getDb, toObjectId, isValidObjectId } from '../db/mongo.js';
import { withId, withIds } from '../db/serialize.js';

const router = Router();

router.get('/', async (req, res) => {
  const db = await getDb();
  const articles = await db.collection('articles').aggregate([
    { $match: { is_active: true } },
    {
      $lookup: {
        from: 'pieces',
        let: { articleId: { $toString: '$_id' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$article_id', '$$articleId'] } } },
        ],
        as: 'pieces',
      },
    },
    {
      $addFields: {
        quantity: { $size: { $filter: { input: '$pieces', cond: { $eq: ['$$this.status', 'in_stock'] } } } },
        total_net_weight: {
          $sum: {
            $map: {
              input: { $filter: { input: '$pieces', cond: { $eq: ['$$this.status', 'in_stock'] } } },
              as: 'p',
              in: '$$p.net_weight',
            },
          },
        },
      },
    },
    { $project: { pieces: 0 } },
    { $sort: { name: 1 } },
  ]).toArray();
  res.json(withIds(articles));
});

router.get('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Article not found' });
  const db = await getDb();
  const article = await db.collection('articles').findOne({ _id: toObjectId(req.params.id) });
  if (!article) return res.status(404).json({ error: 'Article not found' });
  const pieces = await db.collection('pieces').find({ article_id: req.params.id }).sort({ added_at: -1 }).toArray();
  res.json({ ...withId(article), pieces: withIds(pieces) });
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  const db = await getDb();
  const doc = {
    name: b.name,
    category: b.category || '',
    metal: b.metal || 'Gold',
    purity: b.purity || '',
    hsn_code: b.hsn_code || '7113',
    making_charge_type: b.making_charge_type || 'per_gram',
    making_charge_value: Number(b.making_charge_value ?? 0),
    gst_rate: Number(b.gst_rate ?? 3),
    notes: b.notes || '',
    created_at: new Date().toISOString(),
    is_active: true,
  };
  // Only store sku when actually provided: a sparse unique index still
  // indexes an explicit null, so leaving the key out entirely (rather than
  // null) is what lets multiple articles have no SKU.
  if (b.sku) doc.sku = b.sku;
  try {
    const result = await db.collection('articles').insertOne(doc);
    res.status(201).json(withId({ _id: result.insertedId, ...doc }));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An article with this SKU already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Article not found' });
  const db = await getDb();
  const existing = await db.collection('articles').findOne({ _id: toObjectId(req.params.id) });
  if (!existing) return res.status(404).json({ error: 'Article not found' });
  const fields = ['name', 'category', 'metal', 'purity', 'hsn_code', 'making_charge_type', 'making_charge_value', 'gst_rate', 'notes'];
  const update = {};
  const b = req.body || {};
  for (const f of fields) if (b[f] !== undefined) update[f] = b[f];
  const unset = {};
  if (b.sku !== undefined) {
    if (b.sku) update.sku = b.sku;
    else unset.sku = '';
  }
  const ops = {};
  if (Object.keys(update).length) ops.$set = update;
  if (Object.keys(unset).length) ops.$unset = unset;
  await db.collection('articles').updateOne({ _id: toObjectId(req.params.id) }, ops);
  const updated = await db.collection('articles').findOne({ _id: toObjectId(req.params.id) });
  res.json(withId(updated));
});

router.delete('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Article not found' });
  const db = await getDb();
  const inStock = await db.collection('pieces').countDocuments({ article_id: req.params.id, status: 'in_stock' });
  if (inStock > 0) {
    return res.status(400).json({ error: 'Cannot delete an article that still has stock. Remove/sell its pieces first.' });
  }
  await db.collection('articles').updateOne({ _id: toObjectId(req.params.id) }, { $set: { is_active: false } });
  res.json({ ok: true });
});

export default router;
