import { Router } from 'express';
import { getDb, getClient, toObjectId, isValidObjectId } from '../db/mongo.js';
import { withId, withIds } from '../db/serialize.js';
import { SETTINGS_ID } from '../db/seed.js';

const router = Router();

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

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
 * Create an invoice.
 * body: {
 *   customer: { id?, name, phone, address, state, gstin },
 *   payment_mode,
 *   discount,
 *   old_gold_exchange_value,
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
      const isInterstate = !!customer.state && !!settings.state &&
        customer.state.trim().toLowerCase() !== settings.state.trim().toLowerCase();

      let taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
      const lineItems = [];
      const pieceUpdates = [];

      for (const item of b.items) {
        if (!isValidObjectId(item.piece_id)) throw { status: 400, message: `Invalid piece id ${item.piece_id}` };
        const piece = await db.collection('pieces').findOne({ _id: toObjectId(item.piece_id) }, { session });
        if (!piece) throw { status: 404, message: `Piece ${item.piece_id} not found` };
        if (piece.status !== 'in_stock') throw { status: 400, message: `Piece ${item.piece_id} is not in stock (already sold)` };
        const article = await db.collection('articles').findOne({ _id: toObjectId(piece.article_id) }, { session });
        if (!article) throw { status: 404, message: `Article for piece ${item.piece_id} not found` };

        const rate = Number(item.metal_rate_per_gram ?? (article.metal === 'Silver' ? settings.silver_rate_per_gram : settings.gold_rate_per_gram));
        const metalValue = round2(rate * piece.net_weight);

        let makingCharge = 0;
        if (item.making_charge !== undefined) {
          makingCharge = Number(item.making_charge);
        } else if (article.making_charge_type === 'per_gram') {
          makingCharge = round2(article.making_charge_value * piece.net_weight);
        } else if (article.making_charge_type === 'percentage') {
          makingCharge = round2((article.making_charge_value / 100) * metalValue);
        } else {
          makingCharge = article.making_charge_value;
        }

        const stoneCharge = Number(item.stone_charge ?? piece.stone_charge ?? 0);
        const taxableValue = round2(metalValue + makingCharge + stoneCharge);
        const gstRate = Number(item.gst_rate_override ?? article.gst_rate);

        let cgst = 0, sgst = 0, igst = 0;
        if (isInterstate) {
          igst = round2(taxableValue * (gstRate / 100));
        } else {
          cgst = round2(taxableValue * (gstRate / 200));
          sgst = round2(taxableValue * (gstRate / 200));
        }
        const lineTotal = round2(taxableValue + cgst + sgst + igst);

        taxableTotal += taxableValue;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        lineItems.push({
          piece_id: String(piece._id),
          article_id: String(article._id),
          description: article.name,
          hsn_code: article.hsn_code,
          purity: article.purity,
          gross_weight: piece.gross_weight,
          stone_weight: piece.stone_weight,
          net_weight: piece.net_weight,
          metal_rate_per_gram: rate,
          metal_value: metalValue,
          making_charge: makingCharge,
          stone_charge: stoneCharge,
          taxable_value: taxableValue,
          gst_rate: gstRate,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          line_total: lineTotal,
        });
        pieceUpdates.push(piece._id);
      }

      const discount = round2(Number(b.discount ?? 0));
      const oldGoldValue = round2(Number(b.old_gold_exchange_value ?? 0));
      const preRoundTotal = round2(taxableTotal + cgstTotal + sgstTotal + igstTotal - discount - oldGoldValue);
      const grandTotal = Math.round(preRoundTotal);
      const roundOff = round2(grandTotal - preRoundTotal);

      let customerId = customer.id || null;
      if (!customerId && customer.name) {
        const custResult = await db.collection('customers').insertOne({
          name: customer.name,
          phone: customer.phone || '',
          address: customer.address || '',
          state: customer.state || '',
          gstin: customer.gstin || '',
          created_at: new Date().toISOString(),
        }, { session });
        customerId = String(custResult.insertedId);
      }

      const invoiceNumber = `${settings.invoice_prefix}-${String(settings.next_invoice_no).padStart(4, '0')}`;
      const invoiceDoc = {
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString(),
        customer_id: customerId,
        customer_name: customer.name || '',
        customer_phone: customer.phone || '',
        customer_address: customer.address || '',
        customer_state: customer.state || '',
        customer_gstin: customer.gstin || '',
        place_of_supply: customer.state || settings.state,
        is_interstate: isInterstate,
        discount,
        taxable_value: round2(taxableTotal),
        cgst_amount: round2(cgstTotal),
        sgst_amount: round2(sgstTotal),
        igst_amount: round2(igstTotal),
        round_off: roundOff,
        grand_total: grandTotal,
        payment_mode: b.payment_mode || 'Cash',
        old_gold_exchange_value: oldGoldValue,
        status: 'completed',
        items: lineItems,
        created_at: new Date().toISOString(),
      };

      const invoiceResult = await db.collection('invoices').insertOne(invoiceDoc, { session });

      await db.collection('pieces').updateMany(
        { _id: { $in: pieceUpdates } },
        { $set: { status: 'sold', sold_at: new Date().toISOString() } },
        { session }
      );

      await db.collection('settings').updateOne(
        { _id: SETTINGS_ID },
        { $inc: { next_invoice_no: 1 } },
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
