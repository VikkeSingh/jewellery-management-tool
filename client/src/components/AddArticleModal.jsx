import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';

const METALS = ['Gold', 'Silver', 'Platinum', 'Diamond'];

const emptyForm = {
  name: '', category: '', metal: 'Gold', purity: '', hsn_code: '7113', gst_rate: 3, sku: '', notes: '',
  show_purity: true,
  tag_number: '', huid: '', gross_weight: '', stone_weight: '', stone_charge: '', cost_price: '',
};

function purityPlaceholder(metal) {
  if (metal === 'Gold') return '22K / 18K / 916 / 999';
  if (metal === 'Silver') return '925 / 999 (optional)';
  if (metal === 'Platinum') return '950 (optional)';
  return 'Optional — leave blank if not applicable';
}

/**
 * Either creates a brand-new article AND its first physical piece, or adds
 * a new piece of stock to an article the shop already has — either way it's
 * immediately pickable in a New Sale / New Order cart without a trip to
 * Inventory first.
 *
 * @param onClose  called to dismiss the modal
 * @param onCreated({ article, piece }) called once the piece exists; the
 *   returned article carries a fresh quantity (re-fetched from the server)
 *   so it passes the usual `quantity > 0` filter used in article pickers.
 */
export default function AddArticleModal({ onClose, onCreated }) {
  const [mode, setMode] = useState('new'); // 'new' | 'existing'
  const [existingArticles, setExistingArticles] = useState([]);
  const [articleQuery, setArticleQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.articles.list().then(setExistingArticles);
  }, []);

  const matches = articleQuery.trim().length < 1 ? [] : existingArticles.filter((a) => {
    const q = articleQuery.trim().toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.sku || '').toLowerCase().includes(q);
  });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'existing' && !selectedArticle) { setError('Search for and select an existing article.'); return; }
    if (mode === 'new' && !form.name.trim()) { setError('Article name is required.'); return; }
    if (!(Number(form.gross_weight) > 0)) { setError('Enter the gross weight of the piece.'); return; }

    setSubmitting(true);
    try {
      let articleId;
      if (mode === 'existing') {
        articleId = selectedArticle.id;
      } else {
        const article = await api.articles.create({
          name: form.name,
          category: form.category,
          metal: form.metal,
          purity: form.purity,
          hsn_code: form.hsn_code,
          gst_rate: form.gst_rate,
          sku: form.sku,
          notes: form.notes,
          show_purity: form.show_purity,
        });
        articleId = article.id;
      }

      const gross = Number(form.gross_weight || 0);
      const stone = Number(form.stone_weight || 0);
      const piece = await api.pieces.create({
        article_id: articleId,
        tag_number: form.tag_number || undefined,
        huid: form.huid,
        gross_weight: gross,
        stone_weight: stone,
        net_weight: Math.max(gross - stone, 0),
        stone_charge: Number(form.stone_charge || 0),
        cost_price: Number(form.cost_price || 0),
      });

      // Re-fetch so quantity/reserved_quantity/total_net_weight are accurate
      // whether this was a brand-new article or an existing one gaining stock.
      const freshArticles = await api.articles.list();
      const freshArticle = freshArticles.find((a) => a.id === articleId) || { id: articleId, quantity: 1 };

      onCreated({ article: freshArticle, piece });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={mode === 'existing' ? 'Add Stock to Existing Article' : 'New Article'} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="addArticleMode" checked={mode === 'new'} onChange={() => setMode('new')} style={{ width: 'auto' }} />
            Create a new article
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="addArticleMode" checked={mode === 'existing'} onChange={() => setMode('existing')} style={{ width: 'auto' }} />
            Add stock to an existing article
          </label>
        </div>

        {mode === 'existing' ? (
          <div className="field">
            <label>Search article (name or SKU)</label>
            <input
              value={selectedArticle ? `${selectedArticle.name} (${selectedArticle.metal}${selectedArticle.purity ? `, ${selectedArticle.purity}` : ''})` : articleQuery}
              onChange={(e) => { setSelectedArticle(null); setArticleQuery(e.target.value); }}
              placeholder="Start typing an article name..."
            />
            {!selectedArticle && matches.length > 0 && (
              <div className="card" style={{ marginTop: 6, padding: 8 }}>
                {matches.map((a) => (
                  <div key={a.id} style={{ padding: '4px 0', cursor: 'pointer' }}
                    onClick={() => { setSelectedArticle(a); setArticleQuery(''); }}>
                    {a.name} — {a.metal}{a.purity ? `, ${a.purity}` : ''} ({a.quantity} in stock)
                  </div>
                ))}
              </div>
            )}
            {selectedArticle && (
              <button type="button" className="link" style={{ marginTop: 6 }} onClick={() => setSelectedArticle(null)}>
                Change article
              </button>
            )}
          </div>
        ) : (
          <>
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
                <select
                  value={form.metal}
                  onChange={(e) => setForm({ ...form, metal: e.target.value, show_purity: e.target.value !== 'Silver' })}
                >
                  {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Purity (optional)</label>
                <input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} placeholder={purityPlaceholder(form.metal)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.show_purity} onChange={(e) => setForm({ ...form, show_purity: e.target.checked })} style={{ width: 'auto' }} />
                  <span className="hint" style={{ margin: 0 }}>Show purity on invoices</span>
                </label>
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
          </>
        )}

        <h4 style={{ margin: '18px 0 4px' }}>{mode === 'existing' ? 'New piece (stock)' : 'First piece (stock)'}</h4>
        <p className="hint" style={{ marginTop: 0 }}>
          {mode === 'existing'
            ? 'Adds one more physical piece to this article, ready to pick below.'
            : "Adds one physical piece now so it's ready to pick below — add more stock any time from Inventory."}
        </p>
        <div className="grid cols-2">
          <div className="field"><label>Tag / Item number</label><input value={form.tag_number} onChange={(e) => setForm({ ...form, tag_number: e.target.value })} /></div>
          <div className="field"><label>HUID (hallmark, if any)</label><input value={form.huid} onChange={(e) => setForm({ ...form, huid: e.target.value })} /></div>
          <div className="field"><label>Gross weight (g) *</label><input required type="number" step="0.001" value={form.gross_weight} onChange={(e) => setForm({ ...form, gross_weight: e.target.value })} /></div>
          <div className="field"><label>Stone weight (g)</label><input type="number" step="0.001" value={form.stone_weight} onChange={(e) => setForm({ ...form, stone_weight: e.target.value })} /></div>
          <div className="field"><label>Stone charge (₹)</label><input type="number" step="0.01" value={form.stone_charge} onChange={(e) => setForm({ ...form, stone_charge: e.target.value })} /></div>
          <div className="field"><label>Cost price (₹, optional)</label><input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : mode === 'existing' ? 'Add Stock' : 'Create Article & Add Stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
