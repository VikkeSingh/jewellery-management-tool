import { Router } from 'express';
import { getDb, getClient, toObjectId, isValidObjectId } from '../db/mongo.js';
import { withId, withIds } from '../db/serialize.js';
import { SETTINGS_ID } from '../db/seed.js';
import { computeInvoiceLines, buildInvoiceDoc, invoiceCounterField, ensureCustomer } from '../services/invoiceCalc.js';

const router = Router();

router.get('/', async (req, res) => {
  const db = await getDb();
  const invoices = await db.collection('invoices').find({}).sort({ created_at: -1 }).toArray();
  res.json(withIds(invoices));
});

router.get('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Invoice not found' });
  const db = await getDb();
  const invoice = await db.collection('invoices').findOne({ _id: toObjectId(req.params.id) });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  res.json({ ...withId(invoice), settings });
});

/**
 * Create an invoice directly from in-stock pieces (a regular walk-in sale).
 * body: {
 *   document_type, customer: { id?, name, phone, address, state, gstin },
 *   payment_mode, discount, old_gold_exchange_value, old_silver_exchange_value,
 *   items: [{ piece_id, metal_rate_per_gram, making_charge, stone_charge, gst_rate_override }]
 * }
 */
router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const db = await getDb();
  const client = await getClient();
  const session = client.startSession();

  try {
    let responseInvoice;
    await session.withTransaction(async () => {
      const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID }, { session });
      const customer = b.customer || {};

      const calc = await computeInvoiceLines(db, session, settings, {
        document_type: b.document_type,
        customer,
        items: b.items,
        allowReservedForOrderId: null,
      });

      const customerId = await ensureCustomer(db, session, customer);

      const invoiceDoc = buildInvoiceDoc(settings, calc, {
        customer,
        customerId,
        payment_mode: b.payment_mode,
        discount: b.discount,
        old_gold_exchange_value: b.old_gold_exchange_value,
        old_silver_exchange_value: b.old_silver_exchange_value,
      });

      const invoiceResult = await db.collection('invoices').insertOne(invoiceDoc, { session });

      await db.collection('pieces').updateMany(
        { _id: { $in: calc.pieceIds } },
        { $set: { status: 'sold', sold_at: new Date().toISOString() } },
        { session }
      );

      await db.collection('settings').updateOne(
        { _id: SETTINGS_ID },
        { $inc: { [invoiceCounterField(calc.documentType)]: 1 } },
        { session }
      );

      responseInvoice = withId({ _id: invoiceResult.insertedId, ...invoiceDoc });
    });

    res.status(201).json(responseInvoice);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create invoice' });
  } finally {
    await session.endSession();
  }
});

// Cancel an invoice: restores pieces to in_stock, marks invoice cancelled (kept for GST audit trail)
router.post('/:id/cancel', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Invoice not found' });
  const db = await getDb();
  const invoice = await db.collection('invoices').findOne({ _id: toObjectId(req.params.id) });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'cancelled') return res.status(400).json({ error: 'Invoice already cancelled' });

  const client = await getClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const pieceIds = (invoice.items || []).filter((it) => it.piece_id && isValidObjectId(it.piece_id)).map((it) => toObjectId(it.piece_id));
      if (pieceIds.length > 0) {
        await db.collection('pieces').updateMany(
          { _id: { $in: pieceIds } },
          { $set: { status: 'in_stock', sold_at: null } },
          { session }
        );
      }
      await db.collection('invoices').updateOne({ _id: toObjectId(req.params.id) }, { $set: { status: 'cancelled' } }, { session });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
});

export default router;
