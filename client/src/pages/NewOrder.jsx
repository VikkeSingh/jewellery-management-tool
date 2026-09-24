import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';

function computeEstimate(weight, rate, makingPct) {
  const w = Number(weight || 0);
  const r = Number(rate || 0);
  const pct = Number(makingPct || 0);
  if (!(w > 0) || !(r > 0)) return null;
  const metalValue = w * r;
  const making = metalValue * (pct / 100);
  return Math.round((metalValue + making) * 100) / 100;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [mode, setMode] = useState('existing'); // 'existing' | 'custom'
  const [articles, setArticles] = useState([]);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [availablePieces, setAvailablePieces] = useState([]);
  const [selectedPieceId, setSelectedPieceId] = useState('');

  const [description, setDescription] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customer, setCustomer] = useState({ id: null, name: '', phone: '', address: '', state: '', gstin: '' });

  const [rate, setRate] = useState('');
  const [makingPercent, setMakingPercent] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advancePaymentMode, setAdvancePaymentMode] = useState('Cash');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.articles.list().then(setArticles);
    api.settings.get().then(setSettings);
  }, []);

  useEffect(() => {
    if (!selectedArticleId) { setAvailablePieces([]); return; }
    api.pieces.list({ article_id: selectedArticleId, status: 'in_stock' }).then(setAvailablePieces);
  }, [selectedArticleId]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(() => api.customers.list(customerQuery).then(setCustomerResults), 250);
    return () => clearTimeout(t);
  }, [customerQuery]);

  const selectedArticle = articles.find((a) => String(a.id) === String(selectedArticleId));
  const selectedPiece = availablePieces.find((p) => String(p.id) === String(selectedPieceId));
  const rateUnit = selectedArticle?.metal === 'Diamond' ? 'ct' : 'g';

  function currentWeight() {
    if (mode === 'existing' && selectedPiece) return selectedPiece.net_weight;
    if (mode === 'custom' && estimatedWeight !== '') return Number(estimatedWeight);
    return null;
  }

  function recomputeEstimate(nextRate, nextMakingPercent) {
    const est = computeEstimate(currentWeight(), nextRate, nextMakingPercent);
    if (est !== null) setEstimatedAmount(est);
  }

  function handleRateChange(value) {
    setRate(value);
    recomputeEstimate(value, makingPercent);
  }

  function handleMakingPercentChange(value) {
    setMakingPercent(value);
    recomputeEstimate(rate, value);
  }

  // Prefill a sensible starting rate from today's settings once a piece/article
  // is picked, without clobbering a rate the user already typed in.
  useEffect(() => {
    if (rate !== '' || !settings || !selectedArticle) return;
    const defaultRate = selectedArticle.metal === 'Diamond'
      ? settings.diamond_rate_per_carat
      : (selectedArticle.metal === 'Silver' ? settings.silver_rate_per_gram : settings.gold_rate_per_gram);
    if (defaultRate) handleRateChange(defaultRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArticleId, settings]);

  // Keep the estimate in sync when the underlying weight changes (piece
  // switched, or custom weight edited), as long as a rate has been entered.
  useEffect(() => {
    if (rate === '') return;
    recomputeEstimate(rate, makingPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPieceId, estimatedWeight]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!customer.name.trim()) { setError('Customer name is required.'); return; }
    if (mode === 'existing' && !selectedPieceId) { setError('Select a piece to reserve.'); return; }
    if (mode === 'custom' && !description.trim()) { setError('Describe the custom item being ordered.'); return; }
    if (!(Number(estimatedAmount) > 0)) { setError('Enter an estimated total amount.'); return; }
    if (Number(advanceAmount) < 0) { setError('Advance amount cannot be negative.'); return; }

    setSubmitting(true);
    try {
      const order = await api.orders.create({
        customer,
        piece_id: mode === 'existing' ? selectedPieceId : undefined,
        description: mode === 'custom' ? description.trim() : '',
        estimated_weight: mode === 'custom' && estimatedWeight !== '' ? Number(estimatedWeight) : undefined,
        estimated_amount: Number(estimatedAmount),
        advance_amount: Number(advanceAmount || 0),
        advance_payment_mode: advancePaymentMode,
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header"><h2>New Order</h2></div>

      <div className="card">
        <h3>Customer</h3>
        <div className="grid cols-2">
          <div className="field">
            <label>Search existing customer (name or phone)</label>
            <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Type to search..." />
            {customerResults.length > 0 && (
              <div className="card" style={{ marginTop: 6, padding: 8 }}>
                {customerResults.map((c) => (
                  <div key={c.id} style={{ padding: '4px 0', cursor: 'pointer' }}
                    onClick={() => { setCustomer(c); setCustomerQuery(''); setCustomerResults([]); }}>
                    {c.name} — {c.phone}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Selected customer</label>
            <input readOnly value={customer.name ? `${customer.name} (${customer.phone || 'no phone'})` : 'None — fill details below'} />
          </div>
        </div>
        <div className="grid cols-3">
          <div className="field"><label>Name *</label><input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
          <div className="field"><label>State</label><input value={customer.state} onChange={(e) => setCustomer({ ...customer, state: e.target.value })} /></div>
          <div className="field"><label>Address</label><input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></div>
          <div className="field"><label>GSTIN (optional)</label><input value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <h3>What is being ordered?</h3>
        <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="mode" checked={mode === 'existing'} onChange={() => setMode('existing')} style={{ width: 'auto' }} />
            An existing piece in stock (hold it for this customer)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="mode" checked={mode === 'custom'} onChange={() => setMode('custom')} style={{ width: 'auto' }} />
            A custom / made-to-order item (not in stock yet)
          </label>
        </div>

        {mode === 'existing' ? (
          articles.length === 0 || articles.every((a) => a.quantity === 0) ? (
            <p className="hint">No articles have stock right now. Add stock in <Link to="/inventory">Inventory</Link>, or switch to a custom order above.</p>
          ) : (
            <div className="grid cols-2">
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
                    <option key={p.id} value={p.id}>{p.tag_number || `#${p.id}`} — {p.net_weight}g{p.huid ? ` (HUID ${p.huid})` : ''}</option>
                  ))}
                </select>
              </div>
              {selectedPiece && (
                <p className="hint" style={{ gridColumn: '1 / -1' }}>
                  This piece will be marked "reserved" and won't be available for another sale until this order is completed or cancelled.
                </p>
              )}
            </div>
          )
        ) : (
          <div>
            <div className="field">
              <label>Description *</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Gold chain, 10g approx, rope design" />
            </div>
            <div className="field" style={{ maxWidth: 240 }}>
              <label>Estimated weight (g, optional)</label>
              <input type="number" step="0.001" value={estimatedWeight} onChange={(e) => setEstimatedWeight(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Advance payment</h3>
        <div className="grid cols-2">
          <div className="field">
            <label>Rate (₹ per {rateUnit})</label>
            <input type="number" step="0.01" value={rate} onChange={(e) => handleRateChange(e.target.value)} />
            <p className="hint">Optional — fills in the estimate below from weight × rate + making %.</p>
          </div>
          <div className="field">
            <label>Making charge (%)</label>
            <input type="number" step="0.01" value={makingPercent} onChange={(e) => handleMakingPercentChange(e.target.value)} />
          </div>
        </div>
        <div className="grid cols-3">
          <div className="field">
            <label>Estimated total amount (₹) *</label>
            <input type="number" step="0.01" value={estimatedAmount} onChange={(e) => setEstimatedAmount(e.target.value)} />
            <p className="hint">Just an estimate for this receipt — the real price is set when the order is completed.</p>
          </div>
          <div className="field">
            <label>Advance amount (₹) *</label>
            <input type="number" step="0.01" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Payment mode</label>
            <select value={advancePaymentMode} onChange={(e) => setAdvancePaymentMode(e.target.value)}>
              <option>Cash</option><option>Card</option><option>UPI</option><option>Bank Transfer</option><option>Mixed</option>
            </select>
          </div>
        </div>
        {Number(estimatedAmount) > 0 && Number(advanceAmount) >= 0 && (
          <p className="hint">Estimated balance due later: ₹{(Number(estimatedAmount) - Number(advanceAmount)).toLocaleString('en-IN')}</p>
        )}
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button onClick={submit} disabled={submitting}>{submitting ? 'Creating...' : 'Create Order & Print Advance Receipt'}</button>
        </div>
      </div>
    </div>
  );
}
