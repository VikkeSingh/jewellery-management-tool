import { toObjectId, isValidObjectId } from '../db/mongo.js';

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Validates items and computes per-line + aggregate GST amounts. Does not
 * write anything to the database.
 *
 * @param {object} opts
 * @param {string} opts.document_type 'tax_invoice' | 'estimate'
 * @param {object} opts.customer
 * @param {Array} opts.items [{ piece_id, metal_rate_per_gram, making_charge, stone_charge, gst_rate_override }]
 * @param {string|null} opts.allowReservedForOrderId if set, a piece reserved
 *   for this exact order id may also be sold (used when completing an order);
 *   a piece reserved for any other order is always rejected.
 */
export async function computeInvoiceLines(db, session, settings, opts) {
  const documentType = opts.document_type === 'estimate' ? 'estimate' : 'tax_invoice';
  const customer = opts.customer || {};
  const isInterstate = documentType === 'tax_invoice' && !!customer.state && !!settings.state &&
    customer.state.trim().toLowerCase() !== settings.state.trim().toLowerCase();

  let taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
  const lineItems = [];
  const pieceIds = [];

  for (const item of opts.items) {
    if (!isValidObjectId(item.piece_id)) throw { status: 400, message: `Invalid piece id ${item.piece_id}` };
    const piece = await db.collection('pieces').findOne({ _id: toObjectId(item.piece_id) }, { session });
    if (!piece) throw { status: 404, message: `Piece ${item.piece_id} not found` };

    const isReservedForThisOrder = piece.status === 'reserved' &&
      opts.allowReservedForOrderId && piece.reserved_for_order_id === opts.allowReservedForOrderId;
    if (piece.status !== 'in_stock' && !isReservedForThisOrder) {
      throw { status: 400, message: `Piece ${item.piece_id} is not available for sale (already sold, or reserved for a different order)` };
    }

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
    const gstRate = documentType === 'estimate' ? 0 : Number(item.gst_rate_override ?? article.gst_rate);

    let cgst = 0, sgst = 0, igst = 0;
    if (documentType === 'tax_invoice') {
      if (isInterstate) {
        igst = round2(taxableValue * (gstRate / 100));
      } else {
        cgst = round2(taxableValue * (gstRate / 200));
        sgst = round2(taxableValue * (gstRate / 200));
      }
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
    pieceIds.push(piece._id);
  }

  return {
    documentType,
    isInterstate,
    lineItems,
    pieceIds,
    taxableTotal: round2(taxableTotal),
    cgstTotal: round2(cgstTotal),
    sgstTotal: round2(sgstTotal),
    igstTotal: round2(igstTotal),
  };
}

/**
 * Builds the invoice document (does not insert it). `calc` is the result of
 * computeInvoiceLines. Does not mutate settings' counters.
 */
export function buildInvoiceDoc(settings, calc, opts) {
  const customer = opts.customer || {};
  const discount = round2(Number(opts.discount ?? 0));
  const oldGoldValue = round2(Number(opts.old_gold_exchange_value ?? 0));
  const advancePaid = round2(Number(opts.advance_paid ?? 0));
  const preRoundTotal = round2(
    calc.taxableTotal + calc.cgstTotal + calc.sgstTotal + calc.igstTotal - discount - oldGoldValue - advancePaid
  );
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = round2(grandTotal - preRoundTotal);

  const prefix = calc.documentType === 'estimate' ? (settings.estimate_prefix || 'EST') : settings.invoice_prefix;
  const nextNo = calc.documentType === 'estimate' ? (settings.next_estimate_no || 1) : settings.next_invoice_no;
  const invoiceNumber = `${prefix}-${String(nextNo).padStart(4, '0')}`;

  return {
    invoice_number: invoiceNumber,
    document_type: calc.documentType,
    invoice_date: new Date().toISOString(),
    customer_id: opts.customerId || null,
    customer_name: customer.name || '',
    customer_phone: customer.phone || '',
    customer_address: customer.address || '',
    customer_state: customer.state || '',
    customer_gstin: calc.documentType === 'estimate' ? '' : (customer.gstin || ''),
    place_of_supply: customer.state || settings.state,
    is_interstate: calc.isInterstate,
    discount,
    taxable_value: calc.taxableTotal,
    cgst_amount: calc.cgstTotal,
    sgst_amount: calc.sgstTotal,
    igst_amount: calc.igstTotal,
    round_off: roundOff,
    grand_total: grandTotal,
    payment_mode: opts.payment_mode || 'Cash',
    old_gold_exchange_value: oldGoldValue,
    advance_paid: advancePaid,
    order_id: opts.orderId || null,
    order_number: opts.orderNumber || null,
    status: 'completed',
    items: calc.lineItems,
    created_at: new Date().toISOString(),
  };
}

export function invoiceCounterField(documentType) {
  return documentType === 'estimate' ? 'next_estimate_no' : 'next_invoice_no';
}

export async function ensureCustomer(db, session, customer) {
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
  return customerId;
}
