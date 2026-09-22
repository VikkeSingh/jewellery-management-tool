import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Modal from '../components/Modal.jsx';

const METALS = ['Gold', 'Silver', 'Platinum', 'Diamond'];

const emptyForm = {
  name: '', category: '', metal: 'Gold', purity: '22K', hsn_code: '7113',
  gst_rate: 3, sku: '', notes: '',
};

export default function Inventory() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [metalFilter, setMetalFilter] = useState('');

  function load() {
    setLoading(true);
    api.articles.list().then(setArticles).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.articles.create(form);
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = articles.filter((a) => {
    if (metalFilter && a.metal !== metalFilter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.sku || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Inventory</h2>
        <button onClick={() => setShowForm(true)}>+ New Article</button>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={metalFilter} onChange={(e) => setMetalFilter(e.target.value)}>
          <option value="">All metals</option>
          {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <p>Loading...</p> : filtered.length === 0 ? (
          <div className="empty-state">No articles yet. Click "New Article" to add your first design.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>Metal</th><th>Purity</th>
                <th>GST %</th><th>Qty</th><th>Net Wt (g) / Carat (ct)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/inventory/${a.id}`}>{a.name}</Link>{a.sku ? <div className="hint">SKU: {a.sku}</div> : null}</td>
                  <td>{a.category || '—'}</td>
                  <td>{a.metal}</td>
                  <td>{a.purity || '—'}</td>
                  <td>{a.gst_rate}%</td>
                  <td>
                    <span className={`badge ${a.quantity > 2 ? 'in_stock' : a.quantity > 0 ? 'low' : 'sold'}`}>{a.quantity}</span>
                    {a.reserved_quantity > 0 && <div className="hint">+{a.reserved_quantity} reserved</div>}
                  </td>
                  <td>{a.metal === 'Diamond' ? `${(a.total_carat_weight || 0).toFixed(2)} ct` : `${a.total_net_weight.toFixed(2)} g`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Modal title="New Article" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <div className="field">
              <label>Article name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gold Floral Ring" />
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ring, Chain, Bangle..." />
              </div>
              <div className="field">
                <label>SKU (optional)</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="field">
                <label>Metal</label>
                <select value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })}>
                  {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Purity</label>
                <input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} placeholder="22K / 18K / 916 / 999" />
              </div>
              <div className="field">
                <label>HSN code</label>
                <input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
              </div>
              <div className="field">
                <label>GST rate (%)</label>
                <input type="number" step="0.01" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: Number(e.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <p className="hint">Making charge is set per piece when it's added to a bill in New Sale, not here.</p>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit">Save Article</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
