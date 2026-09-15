import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.invoices.list().then(setInvoices).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><h2>Invoices</h2></div>
      <div className="card">
        {loading ? <p>Loading...</p> : invoices.length === 0 ? (
          <div className="empty-state">No invoices yet.</div>
        ) : (
          <table>
            <thead><tr><th>Invoice No.</th><th>Date</th><th>Customer</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
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
