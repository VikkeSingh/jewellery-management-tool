import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import LogoLJ from '../components/LogoLJ.jsx';

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

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

  if (!data) return <p>Loading...</p>;
  const { settings, items } = data;
  const isCancelled = data.status === 'cancelled';
  const documentType = data.document_type || 'tax_invoice';
  const isEstimate = documentType === 'estimate';

  return (
    <div>
      <div className="print-actions no-print">
        <button className="secondary" onClick={() => navigate('/invoices')}>← All Invoices</button>
        <div className="spacer" />
        {!isCancelled && <button className="danger" onClick={cancelInvoice}>Cancel Invoice</button>}
        <button onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div className="invoice-sheet">
        {isCancelled && <div className="badge sold" style={{ marginBottom: 10 }}>CANCELLED</div>}
        <div className="invoice-logo">
          <LogoLJ size={120} />
        </div>
        <div className="invoice-head">
          <div>
            <div className="shop-name">{settings.shop_name}</div>
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
            <col style={{ width: isEstimate ? '20%' : '14%' }} />
            {!isEstimate && <col style={{ width: '6%' }} />}
            <col style={{ width: isEstimate ? '7%' : '6%' }} />
            <col style={{ width: isEstimate ? '8%' : '7%' }} />
            <col style={{ width: isEstimate ? '8%' : '7%' }} />
            <col style={{ width: isEstimate ? '9%' : '8%' }} />
            <col style={{ width: isEstimate ? '10%' : '9%' }} />
            <col style={{ width: isEstimate ? '9%' : '8%' }} />
            <col style={{ width: isEstimate ? '8%' : '7%' }} />
            <col style={{ width: isEstimate ? '10%' : '9%' }} />
            {!isEstimate && <col style={{ width: '5%' }} />}
            <col style={{ width: isEstimate ? '8%' : '11%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th><th>Description</th>
              {!isEstimate && <th>HSN</th>}
              <th>Purity</th>
              <th>Gross (g)</th><th>Net (g)</th><th>Rate/g</th><th>Metal Val.</th>
              <th>Making</th><th>Stone</th><th>{isEstimate ? 'Amount' : 'Taxable'}</th>
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
                <td>{it.purity}</td>
                <td>{it.gross_weight.toFixed(3)}</td>
                <td>{it.net_weight.toFixed(3)}</td>
                <td>₹{it.metal_rate_per_gram.toFixed(2)}</td>
                <td>₹{it.metal_value.toFixed(2)}</td>
                <td>₹{it.making_charge.toFixed(2)}</td>
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
          <div className="row"><span>Round off</span><span>₹{data.round_off.toFixed(2)}</span></div>
          <div className="row grand"><span>Grand Total</span><span>₹{data.grand_total.toLocaleString('en-IN')}</span></div>
        </div>

        <div className="invoice-footer-note">
          {settings.invoice_footer}<br />
          {isEstimate ? 'This is an estimate only, not a GST tax invoice.' : 'This is a computer-generated GST tax invoice.'}
        </div>
      </div>
    </div>
  );
}
