import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

const MAKING_MODES = [
  { value: 'per_gram', label: '₹/gram' },
  { value: 'percentage', label: '%' },
  { value: 'fixed', label: '₹ fixed' },
];

function computeMakingCharge(item, metalValue) {
  const value = Number(item.making_charge_input || 0);
  if (item.making_charge_mode === 'percentage') return round2((value / 100) * metalValue);
  if (item.making_charge_mode === 'per_gram') return round2(value * item.piece.net_weight);
  return round2(value);
}

function computeLine(item, isInterstate, documentType) {
  const rate = Number(item.metal_rate_per_gram);
  const quantity = item.pricing_unit === 'carat' ? Number(item.piece.carat_weight || 0) : item.piece.net_weight;
  const metalValue = round2(rate * quantity);
  const makingCharge = computeMakingCharge(item, metalValue);
  const stoneCharge = Number(item.stone_charge);
  const taxableValue = round2(metalValue + makingCharge + stoneCharge);
  const gstRate = documentType === 'estimate' ? 0 : Number(item.gst_rate);
  let cgst = 0, sgst = 0, igst = 0;
  if (documentType === 'tax_invoice') {
    if (isInterstate) igst = round2(taxableValue * (gstRate / 100));
    else { cgst = round2(taxableValue * (gstRate / 200)); sgst = round2(taxableValue * (gstRate / 200)); }
  }
  const lineTotal = round2(taxableValue + cgst + sgst + igst);
  return { metalValue, makingCharge, taxableValue, cgst, sgst, igst, lineTotal };
}

export default function CompleteOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState(null);
  const [documentType, setDocumentType] = useState('tax_invoice');
  const [articles, setArticles] = useState([]);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [availablePieces, setAvailablePieces] = useState([]);
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [cart, setCart] = useState([]);
  const [seeded, setSeeded] = useState(false);

  const [customer, setCustomer] = useState({ id: null, name: '', phone: '', address: '', state: '', gstin: '' });
  const [discount, setDiscount] = useState(0);
  const [oldGold, setOldGold] = useState(0);
  const [oldSilver, setOldSilver] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.orders.get(id).then((o) => {
      setOrder(o);
      setSettings(o.settings);
      setCustomer({
        id: o.customer_id, name: o.customer_name, phone: o.customer_phone,
        address: o.customer_address, state: o.customer_state, gstin: o.customer_gstin,
      });
    });
    api.articles.list().then(setArticles);
  }, [id]);

  // Pre-seed the cart with the order's reserved piece, once, after both the
  // order and article list have loaded.
  useEffect(() => {
    if (seeded || !order || !order.piece || articles.length === 0) return;
    const article = articles.find((a) => String(a.id) === String(order.article_id));
    if (article) {
      const pricingUnit = article.metal === 'Diamond' ? 'carat' : 'gram';
      const rate = pricingUnit === 'carat'
        ? settings.diamond_rate_per_carat
        : (article.metal === 'Silver' ? settings.silver_rate_per_gram : settings.gold_rate_per_gram);
      setCart([{
        key: `${order.piece.id}-seed`,
        piece: order.piece, article,
        pricing_unit: pricingUnit,
        metal_rate_per_gram: rate || 0,
        making_charge_mode: article.making_charge_type || 'per_gram',
        making_charge_input: article.making_charge_value || 0,
        stone_charge: order.piece.stone_charge || 0,
        gst_rate: article.gst_rate,
      }]);
    }
    setSeeded(true);
  }, [order, articles, settings, seeded]);

  useEffect(() => {
    if (!selectedArticleId) { setAvailablePieces([]); return; }
    api.pieces.list({ article_id: selectedArticleId, status: 'in_stock' }).then(setAvailablePieces);
  }, [selectedArticleId]);

  const selectedArticle = articles.find((a) => String(a.id) === String(selectedArticleId));

  function addToCart() {
    const piece = availablePieces.find((p) => String(p.id) === String(selectedPieceId));
    if (!piece || !selectedArticle) return;
    const pricingUnit = selectedArticle.metal === 'Diamond' ? 'carat' : 'gram';
    const rate = pricingUnit === 'carat'
      ? settings.diamond_rate_per_carat
      : (selectedArticle.metal === 'Silver' ? settings.silver_rate_per_gram : settings.gold_rate_per_gram);
    setCart([...cart, {
      key: `${piece.id}-${Date.now()}`,
      piece, article: selectedArticle,
      pricing_unit: pricingUnit,
      metal_rate_per_gram: rate || 0,
      making_charge_mode: selectedArticle.making_charge_type || 'per_gram',
      making_charge_input: selectedArticle.making_charge_value || 0,
      stone_charge: piece.stone_charge || 0,
      gst_rate: selectedArticle.gst_rate,
    }]);
    setSelectedArticleId('');
    setSelectedPieceId('');
  }

  function updateCartItem(key, field, value) {
    setCart(cart.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  function removeFromCart(key) {
    setCart(cart.filter((c) => c.key !== key));
  }

  const isInterstate = documentType === 'tax_invoice' && !!customer.state && !!settings?.state && customer.state.trim().toLowerCase() !== settings.state.trim().toLowerCase();
  const advanceAmount = order?.advance_amount || 0;

  const totals = useMemo(() => {
    if (!settings) return null;
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    for (const item of cart) {
      const line = computeLine(item, isInterstate, documentType);
      taxable += line.taxableValue; cgst += line.cgst; sgst += line.sgst; igst += line.igst;
    }
    const preRound = round2(taxable + cgst + sgst + igst - Number(discount || 0) - Number(oldGold || 0) - Number(oldSilver || 0) - advanceAmount);
    const grand = Math.round(preRound);
    return { taxable: round2(taxable), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst), grand, roundOff: round2(grand - preRound) };
  }, [cart, settings, isInterstate, documentType, discount, oldGold, oldSilver, advanceAmount]);

  async function submitCompletion() {
    setError('');
    if (cart.length === 0) { setError('Add at least one item.'); return; }
    if (!customer.name.trim()) { setError('Customer name is required.'); return; }
    setSubmitting(true);
    try {
      const invoice = await api.orders.complete(id, {
        document_type: documentType,
        customer,
        payment_mode: paymentMode,
        discount: Number(discount || 0),
        old_gold_exchange_value: Number(oldGold || 0),
        old_silver_exchange_value: Number(oldSilver || 0),
        items: cart.map((c) => {
          const line = computeLine(c, isInterstate, documentType);
          return {
            piece_id: c.piece.id,
            metal_rate_per_gram: Number(c.metal_rate_per_gram),
            making_charge: line.makingCharge,
            stone_charge: Number(c.stone_charge),
            gst_rate_override: Number(c.gst_rate),
          };
        }),
      });
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!order || !settings) return <p>Loading...</p>;

  if (order.status !== 'pending') {
    return (
      <div>
        <div className="page-header"><h2>Complete Order</h2></div>
        <div className="card">
          <p>Order {order.order_number} is already <strong>{order.status}</strong>.</p>
          <Link to={`/orders/${order.id}`}>View order</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Complete Order {order.order_number}</h2>
      </div>

      <div className="card">
        <p className="hint">
          Advance of ₹{advanceAmount.toLocaleString('en-IN')} already paid on {order.advance_date?.slice(0, 10)} will be
          automatically deducted from the final total below.
        </p>
      </div>

      <div className="card">
        <h3>Document type</h3>
        <div style={{ display: 'flex', gap: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="documentType" checked={documentType === 'tax_invoice'} onChange={() => setDocumentType('tax_invoice')} style={{ width: 'auto' }} />
            Tax Invoice (with GST)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="documentType" checked={documentType === 'estimate'} onChange={() => setDocumentType('estimate')} style={{ width: 'auto' }} />
            Estimate (without GST)
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Customer</h3>
        <div className="grid cols-3">
          <div className="field"><label>Name *</label><input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
          <div className="field"><label>State</label><input value={customer.state} onChange={(e) => setCustomer({ ...customer, state: e.target.value })} placeholder="For CGST/SGST vs IGST" /></div>
          <div className="field"><label>Address</label><input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></div>
          <div className="field"><label>GSTIN (optional, B2B)</label><input value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value })} /></div>
        </div>
        {isInterstate && <p className="hint">Customer state differs from shop state ({settings.state || 'not set'}) — IGST will be applied.</p>}
      </div>

      <div className="card">
        <h3>Add another item (optional)</h3>
        <div className="grid cols-3">
          <div className="field">
            <label>Article</label>
            <select value={selectedArticleId} onChange={(e) => { setSelectedArticleId(e.target.value); setSelectedPieceId(''); }}>
              <option value="">Select article...</option>
              {articles.filter((a) => a.quantity > 0).map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.quantity} in stock)</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Piece</label>
            <select value={selectedPieceId} onChange={(e) => setSelectedPieceId(e.target.value)} disabled={!selectedArticleId}>
              <option value="">Select piece...</option>
              {availablePieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tag_number || `#${p.id}`} — {selectedArticle?.metal === 'Diamond' ? `${p.carat_weight || 0}ct` : `${p.net_weight}g`}{p.huid ? ` (HUID ${p.huid})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button type="button" onClick={addToCart} disabled={!selectedPieceId}>Add to Bill</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Bill items ({cart.length})</h3>
        {cart.length === 0 ? <p className="hint">
          {order.piece ? 'Loading the reserved piece...' : 'This was a custom order — add the piece that was made for it (in Inventory first, if not added yet).'}
        </p> : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Item</th><th>Weight/Ct</th><th>Rate</th><th>Making</th><th>Stone chg</th>
                  {documentType === 'tax_invoice' && <th>GST%</th>}
                  <th>Taxable</th><th>Total</th><th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => {
                  const line = computeLine(item, isInterstate, documentType);
                  return (
                    <tr key={item.key}>
                      <td>{item.article.name}<div className="cart-meta">{item.piece.tag_number || `#${item.piece.id}`}</div></td>
                      <td>{item.pricing_unit === 'carat' ? `${(item.piece.carat_weight || 0).toFixed(3)} ct` : `${item.piece.net_weight.toFixed(3)} g`}</td>
                      <td>
                        <input type="number" step="0.01" style={{ width: 90 }} value={item.metal_rate_per_gram} onChange={(e) => updateCartItem(item.key, 'metal_rate_per_gram', e.target.value)} />
                        <div className="cart-meta">₹/{item.pricing_unit === 'carat' ? 'ct' : 'g'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="number" step="0.01" style={{ width: 60 }} value={item.making_charge_input} onChange={(e) => updateCartItem(item.key, 'making_charge_input', e.target.value)} />
                          <select style={{ width: 78 }} value={item.making_charge_mode} onChange={(e) => updateCartItem(item.key, 'making_charge_mode', e.target.value)}>
                            {MAKING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="cart-meta">= ₹{line.makingCharge.toFixed(2)}</div>
                      </td>
                      <td><input type="number" step="0.01" style={{ width: 90 }} value={item.stone_charge} onChange={(e) => updateCartItem(item.key, 'stone_charge', e.target.value)} /></td>
                      {documentType === 'tax_invoice' && (
                        <td><input type="number" step="0.01" style={{ width: 70 }} value={item.gst_rate} onChange={(e) => updateCartItem(item.key, 'gst_rate', e.target.value)} /></td>
                      )}
                      <td>₹{line.taxableValue.toFixed(2)}</td>
                      <td><strong>₹{line.lineTotal.toFixed(2)}</strong></td>
                      <td><button className="danger small" onClick={() => removeFromCart(item.key)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="grid cols-4" style={{ marginTop: 16 }}>
              <div className="field"><label>Discount (₹)</label><input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
              <div className="field"><label>Old gold exchange value (₹)</label><input type="number" step="0.01" value={oldGold} onChange={(e) => setOldGold(e.target.value)} /></div>
              <div className="field"><label>Old silver exchange value (₹)</label><input type="number" step="0.01" value={oldSilver} onChange={(e) => setOldSilver(e.target.value)} /></div>
              <div className="field">
                <label>Payment mode (for balance)</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option>Cash</option><option>Card</option><option>UPI</option><option>Bank Transfer</option><option>Mixed</option>
                </select>
              </div>
            </div>

            {totals && (
              <div className="totals-box">
                <div className="row"><span>{documentType === 'tax_invoice' ? 'Taxable value' : 'Amount'}</span><span>₹{totals.taxable.toFixed(2)}</span></div>
                {documentType === 'tax_invoice' && (isInterstate ? (
                  <div className="row"><span>IGST</span><span>₹{totals.igst.toFixed(2)}</span></div>
                ) : (
                  <>
                    <div className="row"><span>CGST</span><span>₹{totals.cgst.toFixed(2)}</span></div>
                    <div className="row"><span>SGST</span><span>₹{totals.sgst.toFixed(2)}</span></div>
                  </>
                ))}
                {Number(discount) > 0 && <div className="row"><span>Discount</span><span>−₹{Number(discount).toFixed(2)}</span></div>}
                {Number(oldGold) > 0 && <div className="row"><span>Old gold exchange</span><span>−₹{Number(oldGold).toFixed(2)}</span></div>}
                {Number(oldSilver) > 0 && <div className="row"><span>Old silver exchange</span><span>−₹{Number(oldSilver).toFixed(2)}</span></div>}
                <div className="row"><span>Advance already paid</span><span>−₹{advanceAmount.toFixed(2)}</span></div>
                <div className="row"><span>Round off</span><span>₹{totals.roundOff.toFixed(2)}</span></div>
                <div className="row grand"><span>Balance due now</span><span>₹{totals.grand.toLocaleString('en-IN')}</span></div>
              </div>
            )}
          </>
        )}
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button onClick={submitCompletion} disabled={submitting || cart.length === 0}>
            {submitting ? 'Completing...' : documentType === 'tax_invoice' ? 'Generate Final GST Invoice' : 'Generate Final Estimate'}
          </button>
        </div>
      </div>
    </div>
  );
}
