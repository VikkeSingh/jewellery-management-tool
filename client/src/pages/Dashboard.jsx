import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.articles.list(), api.invoices.list(), api.settings.get(), api.orders.list('pending')])
      .then(([a, i, s, o]) => { setArticles(a); setInvoices(i); setSettings(s); setPendingOrders(o); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  const totalPieces = articles.reduce((sum, a) => sum + a.quantity, 0);
  const totalWeight = articles.reduce((sum, a) => sum + a.total_net_weight, 0);
  const goldValue = articles
    .filter((a) => a.metal === 'Gold')
    .reduce((sum, a) => sum + a.total_net_weight * (settings?.gold_rate_per_gram || 0), 0);
  const silverValue = articles
    .filter((a) => a.metal === 'Silver')
    .reduce((sum, a) => sum + a.total_net_weight * (settings?.silver_rate_per_gram || 0), 0);
  const diamondValue = articles
    .filter((a) => a.metal === 'Diamond')
    .reduce((sum, a) => sum + (a.total_carat_weight || 0) * (settings?.diamond_rate_per_carat || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const todaysInvoices = invoices.filter((inv) => inv.invoice_date?.slice(0, 10) === today && inv.status !== 'cancelled');
  const todaysSales = todaysInvoices.reduce((sum, inv) => sum + inv.grand_total, 0);

  const lowStock = articles.filter((a) => a.quantity > 0 && a.quantity <= 2);
  const recentInvoices = invoices.slice(0, 6);
  const totalAdvanceHeld = pendingOrders.reduce((sum, o) => sum + o.advance_amount, 0);

  return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="value">{articles.length}</div>
          <div className="label">Article designs</div>
        </div>
        <div className="card stat">
          <div className="value">{totalPieces}</div>
          <div className="label">Pieces in stock ({totalWeight.toFixed(2)} g)</div>
        </div>
        <div className="card stat">
          <div className="value">₹{(goldValue + silverValue + diamondValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="label">Est. stock value (at current rates)</div>
        </div>
        <div className="card stat">
          <div className="value">₹{todaysSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="label">Today's sales ({todaysInvoices.length} bills)</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Pending orders</h3>
          {pendingOrders.length === 0 ? (
            <p className="hint">No orders awaiting completion.</p>
          ) : (
            <>
              <p className="hint">{pendingOrders.length} order{pendingOrders.length === 1 ? '' : 's'} · ₹{totalAdvanceHeld.toLocaleString('en-IN')} in advances held</p>
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th>Advance</th></tr></thead>
                <tbody>
                  {pendingOrders.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td><Link to={`/orders/${o.id}`}>{o.order_number}</Link></td>
                      <td>{o.customer_name}</td>
                      <td>₹{o.advance_amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingOrders.length > 5 && <p className="hint"><Link to="/orders">View all {pendingOrders.length} pending orders →</Link></p>}
            </>
          )}
        </div>

        <div className="card">
          <h3>Low stock (≤ 2 pieces)</h3>
          {lowStock.length === 0 ? (
            <p className="hint">No articles are running low.</p>
          ) : (
            <table>
              <thead><tr><th>Article</th><th>Qty</th></tr></thead>
              <tbody>
                {lowStock.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/inventory/${a.id}`}>{a.name}</Link></td>
                    <td><span className="badge low">{a.quantity} left</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Recent invoices</h3>
          {recentInvoices.length === 0 ? (
            <p className="hint">No sales yet. Create one from "New Sale".</p>
          ) : (
            <table>
              <thead><tr><th>No.</th><th>Customer</th><th>Total</th></tr></thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
                    <td>{inv.customer_name || '—'}</td>
                    <td>₹{inv.grand_total.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(!settings?.gold_rate_per_gram) && (
        <div className="card" style={{ borderColor: '#e0b24a' }}>
          <strong>Set today's gold rate</strong> in <Link to="/settings">Settings</Link> so billing can price items automatically.
        </div>
      )}
    </div>
  );
}
