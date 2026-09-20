import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

const TABS = [
  { value: 'tax_invoice', label: 'Tax Invoices' },
  { value: 'estimate', label: 'Estimates' },
  { value: 'all', label: 'All' },
];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tax_invoice');

  useEffect(() => {
    api.invoices.list().then(setInvoices).finally(() => setLoading(false));
  }, []);

  // Invoices created before the Estimate type existed have no document_type
  // and are tax invoices.
  const typeOf = (inv) => (inv.document_type === 'estimate' ? 'estimate' : 'tax_invoice');
  const visible = tab === 'all' ? invoices : invoices.filter((inv) => typeOf(inv) === tab);

  return (
    <div>
      <div className="page-header"><h2>Invoices</h2></div>

      <div className="toolbar">
        {TABS.map((t) => (
          <button
            key={t.value}
            className={tab === t.value ? '' : 'secondary'}
            onClick={() => setTab(t.value)}
          >
            {t.label} ({t.value === 'all' ? invoices.length : invoices.filter((inv) => typeOf(inv) === t.value).length})
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <p>Loading...</p> : visible.length === 0 ? (
          <div className="empty-state">
            {invoices.length === 0 ? 'No invoices yet.' : `No ${tab === 'estimate' ? 'estimates' : 'tax invoices'} yet.`}
          </div>
        ) : (
          <table>
            <thead><tr><th>No.</th>{tab === 'all' && <th>Type</th>}<th>Date</th><th>Customer</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {visible.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
                  {tab === 'all' && (
                    <td><span className={`badge ${typeOf(inv) === 'estimate' ? 'low' : 'in_stock'}`}>{typeOf(inv) === 'estimate' ? 'Estimate' : 'Tax Invoice'}</span></td>
                  )}
                  <td>{inv.invoice_date?.slice(0, 16).replace('T', ' ')}</td>
                  <td>{inv.customer_name || '—'}</td>
                  <td>{inv.payment_mode}</td>
                  <td>₹{inv.grand_total.toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${inv.status === 'cancelled' ? 'sold' : 'in_stock'}`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
