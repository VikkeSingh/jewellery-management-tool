import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import LogoLJ from '../components/LogoLJ.jsx';

function makingPercent(it) {
  if (!it.metal_value) return '—';
  return `${((it.making_charge / it.metal_value) * 100).toFixed(2)}%`;
}

// Base % width of every always-present column (everything except
// Description, Purity, and the two Diamond columns), per document type.
function descriptionWidth(isEstimate, anyDiamondItem, anyPurityItem) {
  const base = isEstimate ? 58 : 68;
  const extra = (anyPurityItem ? 6 : 0) + (anyDiamondItem ? 14 : 0);
  return `${100 - base - extra}%`;
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [makingDisplay, setMakingDisplay] = useState('percent'); // 'percent' | 'amount'
  const [purityOverride, setPurityOverride] = useState(null); // null = use each item's own default; true/false = force all
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  function load() {
    api.invoices.get(id).then(setData);
  }
  useEffect(load, [id]);

  async function cancelInvoice() {
    if (!confirm(`Cancel this ${data.document_type === 'estimate' ? 'estimate' : 'invoice'}? Pieces will be returned to stock. It stays on record, marked as cancelled.`)) return;
    try {
      await api.invoices.cancel(id);
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
      await api.invoices.recordPayment(id, amount);
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
  const { settings, items } = data;
  const isCancelled = data.status === 'cancelled';
  const documentType = data.document_type || 'tax_invoice';
  const isEstimate = documentType === 'estimate';
  // Older estimates predate this field — treat them as paid in full, same
  // as how they always behaved before partial-payment tracking existed.
  const amountPaid = data.amount_paid ?? data.grand_total;
  const pendingAmount = Math.round((data.grand_total - amountPaid + Number.EPSILON) * 100) / 100;
  const anyDiamondItem = items.some((it) => it.diamond_carat > 0);
  // Each item defaults from the article's own "show purity on invoices"
  // preference (Silver defaults to hidden, others to shown) — the page
  // button below overrides that default for every line at once, without
  // discarding the underlying purity value either way.
  const purityVisible = (it) => (purityOverride !== null ? purityOverride : it.show_purity !== false);
  const anyPurityValue = items.some((it) => it.purity);
  const anyPurityShownNow = items.some((it) => it.purity && purityVisible(it));
  const purityButtonState = purityOverride !== null ? purityOverride : anyPurityShownNow;

  return (
    <div>
      <div className="print-actions no-print">
        <button className="secondary" onClick={() => navigate('/invoices')}>← All Invoices</button>
        <div className="spacer" />
        <button
          className="secondary"
          onClick={() => setMakingDisplay((m) => (m === 'percent' ? 'amount' : 'percent'))}
        >
          Making charge: {makingDisplay === 'percent' ? '%' : '₹'} (click to show {makingDisplay === 'percent' ? '₹' : '%'})
        </button>
        {anyPurityValue && (
          <button className="secondary" onClick={() => setPurityOverride(!purityButtonState)}>
            Purity: {purityButtonState ? 'Shown' : 'Hidden'} (click to {purityButtonState ? 'hide' : 'show'})
          </button>
        )}
        {isEstimate && !isCancelled && pendingAmount > 0 && (
          <button className="secondary" onClick={() => setShowPaymentForm((v) => !v)}>Record Payment</button>
        )}
        {!isCancelled && <button className="danger" onClick={cancelInvoice}>Cancel Invoice</button>}
        <button onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      {showPaymentForm && (
        <div className="card no-print" style={{ maxWidth: 800, margin: '0 auto 14px' }}>
          <form onSubmit={recordPayment} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Payment received now (₹) — pending is ₹{pendingAmount.toFixed(2)}</label>
              <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} autoFocus />
            </div>
            <button type="submit" disabled={recordingPayment}>{recordingPayment ? 'Saving...' : 'Save Payment'}</button>
            <button type="button" className="secondary" onClick={() => { setShowPaymentForm(false); setPaymentError(''); }}>Cancel</button>
          </form>
          {paymentError && <div className="error-text">{paymentError}</div>}
        </div>
      )}

      <div className="invoice-sheet">
        {isCancelled && <div className="badge sold" style={{ marginBottom: 10 }}>CANCELLED</div>}
        {isEstimate && !isCancelled && (
          <div className={`badge ${pendingAmount > 0 ? 'low' : 'in_stock'}`} style={{ marginBottom: 10 }}>
            {pendingAmount > 0 ? `PARTIALLY PAID — ₹${pendingAmount.toFixed(2)} PENDING` : 'PAID IN FULL'}
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
            {!isEstimate && <div><strong>GSTIN: {settings.gstin || '—'}</strong></div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2>{isEstimate ? 'ESTIMATE' : 'TAX INVOICE'}</h2>
            <div>{isEstimate ? 'Estimate' : 'Invoice'} No: <strong>{data.invoice_number}</strong></div>
            <div>Date: {data.invoice_date?.slice(0, 16).replace('T', ' ')}</div>
            <div>Payment: {data.payment_mode}</div>
            {data.order_number && <div>Against order: {data.order_number}</div>}
          </div>
        </div>

        <div className="invoice-parties">
          <div className="box">
            <strong>Billed to</strong>
            {data.customer_name}<br />
            {data.customer_address}<br />
            {data.customer_state}<br />
            {data.customer_phone && <>Phone: {data.customer_phone}<br /></>}
            {!isEstimate && data.customer_gstin && <>GSTIN: {data.customer_gstin}<br /></>}
          </div>
          {!isEstimate && (
            <div className="box" style={{ textAlign: 'right' }}>
              <strong>Place of supply</strong>
              {data.place_of_supply || '—'}<br />
              {data.is_interstate ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)'}
            </div>
          )}
        </div>

        <table className="invoice-items-table">
          <colgroup>
            <col style={{ width: '3%' }} />
            <col style={{ width: descriptionWidth(isEstimate, anyDiamondItem, anyPurityShownNow) }} />
            {!isEstimate && <col style={{ width: '5%' }} />}
            {anyPurityShownNow && <col style={{ width: '6%' }} />}
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '7%' }} />
            {anyDiamondItem && <><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /></>}
            <col style={{ width: '7%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '8%' }} />
            {!isEstimate && <col style={{ width: '5%' }} />}
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th><th>Description</th>
              {!isEstimate && <th>HSN</th>}
              {anyPurityShownNow && <th>Purity</th>}
              <th>Gross (g)</th><th>Net (g)</th><th>Rate/g</th>
              {anyDiamondItem && <><th>Diamond Rate</th><th>Diamond Ct/Kt</th></>}
              <th>Metal Val.</th>
              <th>Making {makingDisplay === 'percent' ? '%' : '(₹)'}</th><th>Stone</th><th>{isEstimate ? 'Amount' : 'Taxable'}</th>
              {!isEstimate && <th>GST%</th>}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id}>
                <td>{idx + 1}</td>
                <td>{it.description}</td>
                {!isEstimate && <td>{it.hsn_code}</td>}
                {anyPurityShownNow && <td>{purityVisible(it) ? it.purity : ''}</td>}
                <td>{it.gross_weight.toFixed(3)}</td>
                <td>{it.net_weight.toFixed(3)}</td>
                <td>₹{it.metal_rate_per_gram.toFixed(2)}</td>
                {anyDiamondItem && (
                  <>
                    <td>{it.diamond_carat > 0 ? `₹${it.diamond_rate_per_carat.toFixed(2)}` : '—'}</td>
                    <td>{it.diamond_carat > 0 ? `${it.diamond_carat}ct${it.diamond_kt ? ` / ${it.diamond_kt}` : ''}` : '—'}</td>
                  </>
                )}
                <td>₹{it.metal_value.toFixed(2)}</td>
                <td>{makingDisplay === 'percent' ? makingPercent(it) : `₹${it.making_charge.toFixed(2)}`}</td>
                <td>₹{it.stone_charge.toFixed(2)}</td>
                <td>₹{it.taxable_value.toFixed(2)}</td>
                {!isEstimate && <td>{it.gst_rate}%</td>}
                <td>₹{it.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-box">
          <div className="row"><span>{isEstimate ? 'Amount' : 'Taxable value'}</span><span>₹{data.taxable_value.toFixed(2)}</span></div>
          {!isEstimate && (data.is_interstate ? (
            <div className="row"><span>IGST</span><span>₹{data.igst_amount.toFixed(2)}</span></div>
          ) : (
            <>
              <div className="row"><span>CGST</span><span>₹{data.cgst_amount.toFixed(2)}</span></div>
              <div className="row"><span>SGST</span><span>₹{data.sgst_amount.toFixed(2)}</span></div>
            </>
          ))}
          {data.discount > 0 && <div className="row"><span>Discount</span><span>−₹{data.discount.toFixed(2)}</span></div>}
          {data.old_gold_exchange_value > 0 && <div className="row"><span>Old gold exchange</span><span>−₹{data.old_gold_exchange_value.toFixed(2)}</span></div>}
          {data.old_silver_exchange_value > 0 && <div className="row"><span>Old silver exchange</span><span>−₹{data.old_silver_exchange_value.toFixed(2)}</span></div>}
          {data.advance_paid > 0 && <div className="row"><span>Advance paid ({data.order_number})</span><span>−₹{data.advance_paid.toFixed(2)}</span></div>}
          <div className="row"><span>Round off</span><span>₹{data.round_off.toFixed(2)}</span></div>
          <div className="row grand"><span>Grand Total</span><span>₹{data.grand_total.toLocaleString('en-IN')}</span></div>
          {isEstimate && pendingAmount > 0 && (
            <>
              <div className="row"><span>Amount paid</span><span>₹{amountPaid.toFixed(2)}</span></div>
              <div className="row" style={{ fontWeight: 700 }}><span>Pending (to collect later)</span><span>₹{pendingAmount.toFixed(2)}</span></div>
            </>
          )}
        </div>

        <div className="invoice-footer-note">
          {settings.invoice_footer}<br />
          {isEstimate ? 'This is an estimate only, not a GST tax invoice.' : 'This is a computer-generated GST tax invoice.'}
          {isEstimate && <><br />Software Provider: 8287612427</>}
        </div>
      </div>
    </div>
  );
}
