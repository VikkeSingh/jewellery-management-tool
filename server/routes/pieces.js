import { Router } from 'express';
import { getDb, toObjectId, isValidObjectId } from '../db/mongo.js';
import { withId } from '../db/serialize.js';

const router = Router();

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.article_id || !isValidObjectId(b.article_id)) return res.status(400).json({ error: 'A valid article_id is required' });
  const db = await getDb();
  const article = await db.collection('articles').findOne({ _id: toObjectId(b.article_id) });
  if (!article) return res.status(404).json({ error: 'Article not found' });

  const gross = Number(b.gross_weight ?? 0);
  const stone = Number(b.stone_weight ?? 0);
  const net = b.net_weight !== undefined ? Number(b.net_weight) : Math.max(gross - stone, 0);

  const doc = {
    article_id: b.article_id,
    huid: b.huid || '',
    gross_weight: gross,
    stone_weight: stone,
    net_weight: net,
    stone_charge: Number(b.stone_charge ?? 0),
    cost_price: Number(b.cost_price ?? 0),
    status: 'in_stock',
    added_at: new Date().toISOString(),
    sold_at: null,
  };
  // Only store tag_number when actually provided: a sparse unique index
  // still indexes an explicit null, so leaving the key out entirely
  // (rather than null) is what lets multiple pieces have no tag number.
  if (b.tag_number) doc.tag_number = b.tag_number;
  try {
    const result = await db.collection('pieces').insertOne(doc);
    res.status(201).json(withId({ _id: result.insertedId, ...doc }));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A piece with this tag number already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { article_id, status } = req.query;
  const filter = {};
  if (article_id) filter.article_id = article_id;
  if (status) filter.status = status;
  const db = await getDb();
  const pieces = await db.collection('pieces').find(filter).sort({ added_at: -1 }).toArray();

  const articleIds = [...new Set(pieces.map((p) => p.article_id))].filter(isValidObjectId).map(toObjectId);
  const articles = await db.collection('articles').find({ _id: { $in: articleIds } }).toArray();
  const articleMap = new Map(articles.map((a) => [String(a._id), a]));

  const enriched = pieces.map((p) => {
    const article = articleMap.get(p.article_id);
    return { ...withId(p), article_name: article?.name, metal: article?.metal, purity: article?.purity };
  });
  res.json(enriched);
});

router.put('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Piece not found' });
  const db = await getDb();
  const existing = await db.collection('pieces').findOne({ _id: toObjectId(req.params.id) });
  if (!existing) return res.status(404).json({ error: 'Piece not found' });
  if (existing.status === 'sold') return res.status(400).json({ error: 'Cannot edit a sold piece' });

  const b = req.body || {};
  const merged = { ...existing, ...b };
  const gross = Number(merged.gross_weight ?? 0);
  const stone = Number(merged.stone_weight ?? 0);
  const net = b.net_weight !== undefined ? Number(b.net_weight) : Math.max(gross - stone, 0);

  const update = {
    huid: merged.huid || '',
    gross_weight: gross,
    stone_weight: stone,
    net_weight: net,
    stone_charge: Number(merged.stone_charge ?? 0),
    cost_price: Number(merged.cost_price ?? 0),
  };
  const ops = { $set: update };
  if (merged.tag_number) update.tag_number = merged.tag_number;
  else ops.$unset = { tag_number: '' };
  await db.collection('pieces').updateOne({ _id: toObjectId(req.params.id) }, ops);
  const updated = await db.collection('pieces').findOne({ _id: toObjectId(req.params.id) });
  res.json(withId(updated));
});

router.delete('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Piece not found' });
  const db = await getDb();
  const existing = await db.collection('pieces').findOne({ _id: toObjectId(req.params.id) });
  if (!existing) return res.status(404).json({ error: 'Piece not found' });
  if (existing.status === 'sold') return res.status(400).json({ error: 'Cannot delete a sold piece (it is part of an invoice history)' });
  await db.collection('pieces').deleteOne({ _id: toObjectId(req.params.id) });
  res.json({ ok: true });
});

export default router;
