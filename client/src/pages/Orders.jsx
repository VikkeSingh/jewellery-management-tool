import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [counts, setCounts] = useState({});

  function load(status) {
    setLoading(true);
    api.orders.list(status).then(setOrders).finally(() => setLoading(false));
  }

  useEffect(() => { load(tab); }, [tab]);

  useEffect(() => {
    Promise.all(TABS.filter((t) => t.value !== 'all').map((t) => api.orders.list(t.value)))
      .then((results) => {
        const c = {};
        TABS.filter((t) => t.value !== 'all').forEach((t, i) => { c[t.value] = results[i].length; });
        c.all = Object.values(c).reduce((a, b) => a + b, 0);
        setCounts(c);
      });
  }, [orders]);

  async function cancelOrder(id) {
    if (!confirm('Cancel this order? Any reserved piece will be returned to stock.')) return;
    try {
      await api.orders.cancel(id);
      load(tab);
    } catch (err) {
      alert(err.message);
    }
  }

  function itemLabel(order) {
    if (order.article_name) return order.article_name;
    return order.description || '—';
  }

  return (
    <div>
      <div className="page-header">
        <h2>Orders</h2>
        <button onClick={() => navigate('/orders/new')}>+ New Order</button>
      </div>

      <div className="toolbar">
        {TABS.map((t) => (
          <button key={t.value} className={tab === t.value ? '' : 'secondary'} onClick={() => setTab(t.value)}>
            {t.label} {counts[t.value] !== undefined ? `(${counts[t.value]})` : ''}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <p>Loading...</p> : orders.length === 0 ? (
          <div className="empty-state">No {tab === 'all' ? '' : tab} orders.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order No.</th><th>Customer</th><th>Item</th><th>Estimated</th>
                <th>Advance Paid</th><th>Est. Balance</th><th>Date</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/orders/${o.id}`}>{o.order_number}</Link></td>
                  <td>{o.customer_name || '—'}</td>
                  <td>{itemLabel(o)}</td>
                  <td>₹{o.estimated_amount.toLocaleString('en-IN')}</td>
                  <td>₹{o.advance_amount.toLocaleString('en-IN')}</td>
                  <td>₹{(o.estimated_amount - o.advance_amount).toLocaleString('en-IN')}</td>
                  <td>{o.advance_date?.slice(0, 10)}</td>
                  <td>
                    <span className={`badge ${o.status === 'completed' ? 'in_stock' : o.status === 'cancelled' ? 'sold' : 'low'}`}>
                      {o.status}
                    </span>
                    {o.status === 'completed' && o.final_invoice_id && (
                      <div className="hint"><Link to={`/invoices/${o.final_invoice_id}`}>{o.final_invoice_number}</Link></div>
                    )}
                  </td>
                  <td>
                    {o.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="small" onClick={() => navigate(`/orders/${o.id}/complete`)}>Complete</button>
                        <button className="danger small" onClick={() => cancelOrder(o.id)}>Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
