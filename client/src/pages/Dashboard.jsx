import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Local-day 'YYYY-MM-DD' strings, matching what <input type="date"> uses.
function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseLocalDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

// Start/end dates a preset fills into the date boxes (both inclusive).
function presetRange(period) {
  const now = new Date();
  const start = period === 'week'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)) // Monday
    : period === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), 0, 1);
  return { from: toYMD(start), to: toYMD(now) };
}

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salesPeriod, setSalesPeriod] = useState('month');
  const [salesFrom, setSalesFrom] = useState(() => presetRange('month').from);
  const [salesTo, setSalesTo] = useState(() => presetRange('month').to);

  function choosePeriod(period) {
    setSalesPeriod(period);
    if (period !== 'custom') {
      const r = presetRange(period);
      setSalesFrom(r.from);
      setSalesTo(r.to);
    }
  }

  useEffect(() => {
    Promise.all([api.articles.list(), api.invoices.list(), api.settings.get(), api.orders.list('pending')])
      .then(([a, i, s, o]) => { setArticles(a); setInvoices(i); setSettings(s); setPendingOrders(o); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  const totalPieces = articles.reduce((sum, a) => sum + a.quantity, 0);
  const totalWeight = articles.reduce((sum, a) => sum + a.total_net_weight, 0);

  function rateForMetal(metal) {
    if (metal === 'Gold') return settings?.gold_rate_per_gram || 0;
    if (metal === 'Silver') return settings?.silver_rate_per_gram || 0;
    return 0; // Platinum/Diamond have no plain per-gram rate to value stock by
  }

  const metalBreakdown = Object.values(
    articles.reduce((groups, a) => {
      const g = groups[a.metal] || { metal: a.metal, quantity: 0, reservedQuantity: 0, weight: 0 };
      g.quantity += a.quantity;
      g.reservedQuantity += a.reserved_quantity || 0;
      g.weight += a.total_net_weight;
      groups[a.metal] = g;
      return groups;
    }, {})
  ).sort((a, b) => a.metal.localeCompare(b.metal));

  const totalEstValue = metalBreakdown.reduce((sum, g) => sum + g.weight * rateForMetal(g.metal), 0);

  const today = new Date().toISOString().slice(0, 10);
  const todaysInvoices = invoices.filter((inv) => inv.invoice_date?.slice(0, 10) === today && inv.status !== 'cancelled');
  const todaysSales = todaysInvoices.reduce((sum, inv) => sum + inv.grand_total, 0);

  const lowStock = articles.filter((a) => a.quantity > 0 && a.quantity <= 2);
  const recentInvoices = invoices.slice(0, 6);
  const totalAdvanceHeld = pendingOrders.reduce((sum, o) => sum + o.advance_amount, 0);

  const pendingEstimates = invoices
    .filter((inv) => inv.document_type === 'estimate' && inv.status !== 'cancelled')
    .map((inv) => ({ ...inv, pending: round2(inv.grand_total - (inv.amount_paid ?? inv.grand_total)) }))
    .filter((inv) => inv.pending > 0);
  const totalPendingEstimates = pendingEstimates.reduce((sum, inv) => sum + inv.pending, 0);

  // Metal-wise sales for the selected period. Line items don't store the
  // metal themselves, so it's looked up from the line's article.
  // The date boxes are always the source of truth (presets just fill them).
  // The end date is inclusive, so the range runs to the next midnight.
  const periodStart = salesFrom ? parseLocalDate(salesFrom) : null;
  let periodEnd = null;
  if (salesTo) { periodEnd = parseLocalDate(salesTo); periodEnd.setDate(periodEnd.getDate() + 1); }
  const metalByArticleId = Object.fromEntries(articles.map((a) => [a.id, a.metal]));
  const periodInvoices = invoices.filter((inv) => {
    if (inv.status === 'cancelled') return false;
    const d = new Date(inv.invoice_date);
    return (!periodStart || d >= periodStart) && (!periodEnd || d < periodEnd);
  });
  const metalSalesGroups = periodInvoices.reduce((groups, inv) => {
    for (const it of inv.items || []) {
      const metal = metalByArticleId[it.article_id] || 'Other';
      const g = groups[metal] || { metal, amount: 0, weight: 0, pieces: 0 };
      g.amount += it.line_total || 0;
      g.weight += it.net_weight || 0;
      g.pieces += 1;
      groups[metal] = g;
    }
    return groups;
  }, {});
  for (const metal of ['Gold', 'Silver']) {
    if (!metalSalesGroups[metal]) metalSalesGroups[metal] = { metal, amount: 0, weight: 0, pieces: 0 };
  }
  const metalSales = Object.values(metalSalesGroups).sort((a, b) => a.metal.localeCompare(b.metal));
  const oldExchanges = [
    { metal: 'Gold', field: 'old_gold_exchange_value' },
    { metal: 'Silver', field: 'old_silver_exchange_value' },
  ].map(({ metal, field }) => {
    const bills = periodInvoices.filter((inv) => (inv[field] || 0) > 0);
    return { metal, bills: bills.length, amount: bills.reduce((sum, inv) => sum + inv[field], 0) };
  });
  const formatDay = (s) => parseLocalDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const periodLabel = salesPeriod !== 'custom'
    ? { week: 'this week', month: 'this month', year: 'this year' }[salesPeriod]
    : salesFrom && salesTo ? `${formatDay(salesFrom)} – ${formatDay(salesTo)}`
      : salesFrom ? `since ${formatDay(salesFrom)}`
        : salesTo ? `up to ${formatDay(salesTo)}`
          : 'all time';

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
          <div className="value">₹{totalEstValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="label">Est. stock value (at current rates)</div>
        </div>
        <div className="card stat">
          <div className="value">₹{todaysSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="label">Today's sales ({todaysInvoices.length} bills)</div>
        </div>
      </div>

      {metalBreakdown.length > 0 && (
        <div className="card">
          <h3>Stock by metal</h3>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(metalBreakdown.length, 4)}, 1fr)` }}>
            {metalBreakdown.map((g) => {
              const rate = rateForMetal(g.metal);
              const value = g.weight * rate;
              return (
                <div className="card stat" key={g.metal} style={{ marginBottom: 0 }}>
                  <div className="value">{g.quantity}</div>
                  <div className="label">
                    {g.metal} pieces ({g.weight.toFixed(2)} g)
                    {g.reservedQuantity > 0 ? ` · +${g.reservedQuantity} reserved` : ''}
                  </div>
                  {rate > 0 ? (
                    <div className="hint">≈ ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} at today's rate</div>
                  ) : (
                    <div className="hint">No per-gram rate set for {g.metal}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Sales by metal</h3>
          <div style={{ flex: 1 }} />
          <span className="hint" style={{ margin: 0 }}>Start date</span>
          <input type="date" value={salesFrom} max={salesTo || undefined} onChange={(e) => { setSalesFrom(e.target.value); setSalesPeriod('custom'); }} style={{ width: 'auto' }} aria-label="Start date" />
          <span className="hint" style={{ margin: 0 }}>End date</span>
          <input type="date" value={salesTo} min={salesFrom || undefined} onChange={(e) => { setSalesTo(e.target.value); setSalesPeriod('custom'); }} style={{ width: 'auto' }} aria-label="End date" />
          <select value={salesPeriod} onChange={(e) => choosePeriod(e.target.value)} style={{ width: 'auto' }}>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
            <option value="custom">Custom dates</option>
          </select>
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(metalSales.length, 4)}, 1fr)` }}>
          {metalSales.map((g) => (
            <div className="card stat" key={g.metal} style={{ marginBottom: 0 }}>
              <div className="value">₹{g.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="label">{g.metal} sales {periodLabel}</div>
              <div className="hint">{g.pieces} piece{g.pieces === 1 ? '' : 's'} · {g.weight.toFixed(2)} g</div>
            </div>
          ))}
        </div>
        <p className="hint">Item totals incl. GST from {periodInvoices.length} non-cancelled bill{periodInvoices.length === 1 ? '' : 's'}, before bill-level discount and old gold/silver exchange.</p>

        <h3 style={{ marginTop: 18 }}>Old metal exchange received</h3>
        <div className="grid cols-2">
          {oldExchanges.map((x) => (
            <div className="card stat" key={x.metal} style={{ marginBottom: 0 }}>
              <div className="value">₹{x.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="label">Old {x.metal.toLowerCase()} exchange {periodLabel}</div>
              <div className="hint">From {x.bills} bill{x.bills === 1 ? '' : 's'}</div>
            </div>
          ))}
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
          <h3>Pending estimate payments</h3>
          {pendingEstimates.length === 0 ? (
            <p className="hint">No estimates with a balance pending.</p>
          ) : (
            <>
              <p className="hint">{pendingEstimates.length} estimate{pendingEstimates.length === 1 ? '' : 's'} · ₹{totalPendingEstimates.toLocaleString('en-IN')} pending</p>
              <table>
                <thead><tr><th>Estimate</th><th>Customer</th><th>Pending</th></tr></thead>
                <tbody>
                  {pendingEstimates.slice(0, 5).map((inv) => (
                    <tr key={inv.id}>
                      <td><Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
                      <td>{inv.customer_name || '—'}</td>
                      <td>₹{inv.pending.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingEstimates.length > 5 && <p className="hint"><Link to="/invoices">View all in Invoices →</Link></p>}
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
