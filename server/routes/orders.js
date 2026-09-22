import { Router } from 'express';
import { getDb, getClient, toObjectId, isValidObjectId } from '../db/mongo.js';
import { withId, withIds } from '../db/serialize.js';
import { SETTINGS_ID } from '../db/seed.js';
import { computeInvoiceLines, buildInvoiceDoc, invoiceCounterField, ensureCustomer, round2 } from '../services/invoiceCalc.js';

const router = Router();

router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  const db = await getDb();
  const orders = await db.collection('orders').find(filter).sort({ created_at: -1 }).toArray();
  res.json(withIds(orders));
});

router.get('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
  const db = await getDb();
  const order = await db.collection('orders').findOne({ _id: toObjectId(req.params.id) });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  let piece = null;
  if (order.piece_id && isValidObjectId(order.piece_id)) {
    piece = await db.collection('pieces').findOne({ _id: toObjectId(order.piece_id) });
  }
  res.json({ ...withId(order), settings, piece: piece ? withId(piece) : null });
});

/**
 * Create a new order with an advance payment.
 * body: {
 *   customer: { id?, name, phone, address, state, gstin },
 *   piece_id?,                 // reserve a specific in-stock piece
 *   description?,              // required if no piece_id (custom / made-to-order item)
 *   estimated_weight?,
 *   estimated_amount,          // informational total used on the advance receipt
 *   advance_amount,
 *   advance_payment_mode,
 * }
 */
router.post('/', async (req, res) => {
  const b = req.body || {};
  const customer = b.customer || {};
  if (!customer.name) return res.status(400).json({ error: 'Customer name is required' });
  if (!b.piece_id && !String(b.description || '').trim()) {
    return res.status(400).json({ error: 'Either an existing piece or a description of the item is required' });
  }
  const estimatedAmount = Number(b.estimated_amount ?? 0);
  if (!(estimatedAmount > 0)) return res.status(400).json({ error: 'Estimated amount must be greater than 0' });
  const advanceAmount = round2(Number(b.advance_amount ?? 0));
  if (advanceAmount < 0) return res.status(400).json({ error: 'Advance amount cannot be negative' });

  const db = await getDb();
  const client = await getClient();
  const session = client.startSession();

  try {
    let responseOrder;
    await session.withTransaction(async () => {
      const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID }, { session });

      let article = null;
      let piece = null;
      if (b.piece_id) {
        if (!isValidObjectId(b.piece_id)) throw { status: 400, message: 'Invalid piece id' };
        piece = await db.collection('pieces').findOne({ _id: toObjectId(b.piece_id) }, { session });
        if (!piece) throw { status: 404, message: 'Piece not found' };
        if (piece.status !== 'in_stock') throw { status: 400, message: 'That piece is not available to reserve (already sold or reserved)' };
        article = await db.collection('articles').findOne({ _id: toObjectId(piece.article_id) }, { session });
      }

      const customerId = await ensureCustomer(db, session, customer);

      const orderNumber = `${settings.order_prefix || 'ORD'}-${String(settings.next_order_no || 1).padStart(4, '0')}`;
      const orderDoc = {
        order_number: orderNumber,
        status: 'pending',
        customer_id: customerId,
        customer_name: customer.name || '',
        customer_phone: customer.phone || '',
        customer_address: customer.address || '',
        customer_state: customer.state || '',
        customer_gstin: customer.gstin || '',
        piece_id: piece ? String(piece._id) : null,
        article_id: article ? String(article._id) : null,
        article_name: article ? article.name : null,
        article_metal: article ? article.metal : null,
        description: b.description || '',
        estimated_weight: b.estimated_weight !== undefined && b.estimated_weight !== '' ? Number(b.estimated_weight) : null,
        estimated_amount: round2(estimatedAmount),
        advance_amount: advanceAmount,
        advance_payment_mode: b.advance_payment_mode || 'Cash',
        advance_date: new Date().toISOString(),
        final_invoice_id: null,
        final_invoice_number: null,
        created_at: new Date().toISOString(),
        completed_at: null,
        cancelled_at: null,
      };

      const result = await db.collection('orders').insertOne(orderDoc, { session });

      if (piece) {
        await db.collection('pieces').updateOne(
          { _id: piece._id },
          { $set: { status: 'reserved', reserved_for_order_id: String(result.insertedId) } },
          { session }
        );
      }

      await db.collection('settings').updateOne({ _id: SETTINGS_ID }, { $inc: { next_order_no: 1 } }, { session });

      responseOrder = withId({ _id: result.insertedId, ...orderDoc });
    });

    res.status(201).json(responseOrder);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create order' });
  } finally {
    await session.endSession();
  }
});

// Cancel a pending order: releases any reserved piece back to in_stock.
router.post('/:id/cancel', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
  const db = await getDb();
  const order = await db.collection('orders').findOne({ _id: toObjectId(req.params.id) });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') return res.status(400).json({ error: `Order is already ${order.status}` });

  const client = await getClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      if (order.piece_id && isValidObjectId(order.piece_id)) {
        await db.collection('pieces').updateOne(
          { _id: toObjectId(order.piece_id) },
          { $set: { status: 'in_stock' }, $unset: { reserved_for_order_id: '' } },
          { session }
        );
      }
      await db.collection('orders').updateOne(
        { _id: toObjectId(req.params.id) },
        { $set: { status: 'cancelled', cancelled_at: new Date().toISOString() } },
        { session }
      );
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
});

/**
 * Complete a pending order: creates the final Tax Invoice / Estimate,
 * automatically deducting the advance already paid, and marks any
 * reserved/used pieces as sold.
 * body: same shape as POST /api/invoices, minus customer defaults to the
 * order's customer if not overridden.
 */
router.post('/:id/complete', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
  const b = req.body || {};
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required to complete the order' });
  }

  const db = await getDb();
  const client = await getClient();
  const session = client.startSession();

  try {
    let responseInvoice;
    await session.withTransaction(async () => {
      const order = await db.collection('orders').findOne({ _id: toObjectId(req.params.id) }, { session });
      if (!order) throw { status: 404, message: 'Order not found' };
      if (order.status !== 'pending') throw { status: 400, message: `Order is already ${order.status}` };

      const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID }, { session });
      const customer = b.customer || {
        id: order.customer_id,
        name: order.customer_name,
        phone: order.customer_phone,
        address: order.customer_address,
        state: order.customer_state,
        gstin: order.customer_gstin,
      };

      const calc = await computeInvoiceLines(db, session, settings, {
        document_type: b.document_type,
        customer,
        items: b.items,
        allowReservedForOrderId: String(order._id),
      });

      const customerId = await ensureCustomer(db, session, customer);

      const invoiceDoc = buildInvoiceDoc(settings, calc, {
        customer,
        customerId,
        payment_mode: b.payment_mode,
        discount: b.discount,
        old_gold_exchange_value: b.old_gold_exchange_value,
        old_silver_exchange_value: b.old_silver_exchange_value,
        advance_paid: order.advance_amount,
        orderId: String(order._id),
        orderNumber: order.order_number,
      });

      const invoiceResult = await db.collection('invoices').insertOne(invoiceDoc, { session });

      await db.collection('pieces').updateMany(
        { _id: { $in: calc.pieceIds } },
        { $set: { status: 'sold', sold_at: new Date().toISOString() }, $unset: { reserved_for_order_id: '' } },
        { session }
      );

      await db.collection('settings').updateOne(
        { _id: SETTINGS_ID },
        { $inc: { [invoiceCounterField(calc.documentType)]: 1 } },
        { session }
      );

      await db.collection('orders').updateOne(
        { _id: order._id },
        {
          $set: {
            status: 'completed',
            completed_at: new Date().toISOString(),
            final_invoice_id: String(invoiceResult.insertedId),
            final_invoice_number: invoiceDoc.invoice_number,
          },
        },
        { session }
      );

      responseInvoice = withId({ _id: invoiceResult.insertedId, ...invoiceDoc });
    });

    res.status(201).json(responseInvoice);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to complete order' });
  } finally {
    await session.endSession();
  }
});

export default router;
