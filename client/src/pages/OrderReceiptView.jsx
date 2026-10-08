import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import LogoLJ from '../components/LogoLJ.jsx';

export default function OrderReceiptView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentError, setPaymentError] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  function load() {
    api.orders.get(id).then(setData);
  }
  useEffect(load, [id]);

  async function cancelOrder() {
    if (!confirm('Cancel this order? Any reserved piece will be returned to stock.')) return;
    try {
      await api.orders.cancel(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function recordPayment(e) {
    e.preventDefault();
    setPaymentError('');
    const amount = Number(paymentAmount);
    if (!(amount > 0)) { setPaymentError('Enter an amount greater than 0.'); return; }
    setRecordingPayment(true);
    try {
      await api.orders.recordPayment(id, amount, paymentMode);
      setPaymentAmount('');
      setShowPaymentForm(false);
      load();
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setRecordingPayment(false);
    }
  }

  if (!data) return <p>Loading...</p>;
  const { settings, piece } = data;
  const balance = data.estimated_amount - data.advance_amount;
  // Older orders predate the payments history array — fall back to the
  // single advance recorded at creation so the timeline still shows something.
  const payments = data.payments && data.payments.length > 0
    ? data.payments
    : (data.advance_amount > 0 ? [{ amount: data.advance_amount, payment_mode: data.advance_payment_mode, date: data.advance_date }] : []);

  return (
    <div>
      <div className="print-actions no-print">
        <button className="secondary" onClick={() => navigate('/orders')}>← All Orders</button>
        <div className="spacer" />
        {data.status === 'pending' && (
          <>
            <button className="danger" onClick={cancelOrder}>Cancel Order</button>
            <button className="secondary" onClick={() => setShowPaymentForm((v) => !v)}>Record Payment</button>
            <button className="secondary" onClick={() => navigate(`/orders/${id}/complete`)}>Complete Order</button>
          </>
        )}
        <button onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      {showPaymentForm && (
        <div className="card no-print" style={{ maxWidth: 800, margin: '0 auto 14px' }}>
          <form onSubmit={recordPayment} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Payment received now (₹) — balance due is ₹{balance.toFixed(2)}</label>
              <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} autoFocus />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Payment mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option>Cash</option>
                <option>Card</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
              </select>
            </div>
            <button type="submit" disabled={recordingPayment}>{recordingPayment ? 'Saving...' : 'Save Payment'}</button>
            <button type="button" className="secondary" onClick={() => { setShowPaymentForm(false); setPaymentError(''); }}>Cancel</button>
          </form>
          {paymentError && <div className="error-text">{paymentError}</div>}
        </div>
      )}

      <div className="invoice-sheet">
        {data.status !== 'pending' && (
          <div className={`badge ${data.status === 'completed' ? 'in_stock' : 'sold'}`} style={{ marginBottom: 10 }}>
            {data.status === 'completed' ? `COMPLETED — see ${data.final_invoice_number}` : 'CANCELLED'}
          </div>
        )}
        <div className="invoice-logo">
          <LogoLJ size={120} />
          <div className="shop-name">{settings.shop_name}</div>
        </div>
        <div className="invoice-head">
          <div>
            <div>{settings.address}</div>
            <div>{settings.state}</div>
            <div>Phone: {settings.phone} {settings.email ? `| ${settings.email}` : ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2>ADVANCE RECEIPT</h2>
            <div>Order No: <strong>{data.order_number}</strong></div>
            <div>Date: {data.advance_date?.slice(0, 16).replace('T', ' ')}</div>
            <div>Payment: {data.advance_payment_mode}</div>
          </div>
        </div>

        <div className="invoice-parties">
          <div className="box">
            <strong>Customer</strong>
            {data.customer_name}<br />
            {data.customer_address}<br />
            {data.customer_state}<br />
            {data.customer_phone && <>Phone: {data.customer_phone}<br /></>}
          </div>
        </div>

        <table>
          <thead><tr><th>Item ordered</th><th>Purity</th><th>Est. Weight (g)</th></tr></thead>
          <tbody>
            <tr>
              <td>{piece ? data.article_name : data.description}</td>
              <td>{data.purity || '—'}</td>
              <td>{piece ? piece.net_weight.toFixed(3) : (data.estimated_weight != null ? data.estimated_weight : '—')}</td>
            </tr>
          </tbody>
        </table>
        {piece && piece.tag_number && <p className="hint">Reserved piece tag: {piece.tag_number}</p>}

        <div className="totals-box">
          <div className="row"><span>Estimated total amount</span><span>₹{data.estimated_amount.toFixed(2)}</span></div>
          <div className="row"><span>Total paid so far</span><span>−₹{data.advance_amount.toFixed(2)}</span></div>
          <div className="row grand"><span>Estimated balance due</span><span>₹{balance.toLocaleString('en-IN')}</span></div>
        </div>

        {payments.length > 0 && (
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Payment history</th><th>Mode</th><th>Amount</th></tr></thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={idx}>
                  <td>{p.date?.slice(0, 16).replace('T', ' ')}</td>
                  <td>{p.payment_mode}</td>
                  <td>₹{Number(p.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="invoice-footer-note">
          This is an advance receipt, not a tax invoice or final bill. The final amount will be settled — with GST as
          applicable — when the order is completed and this advance is adjusted against it.
        </div>
      </div>
    </div>
  );
}
