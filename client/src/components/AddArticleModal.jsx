import { useState } from 'react';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';

const METALS = ['Gold', 'Silver', 'Platinum', 'Diamond'];

const emptyForm = {
  name: '', category: '', metal: 'Gold', purity: '22K', hsn_code: '7113', gst_rate: 3, sku: '', notes: '',
  tag_number: '', huid: '', gross_weight: '', stone_weight: '', stone_charge: '', cost_price: '',
};

/**
 * Creates a brand-new article AND its first physical piece in one step, so
 * it's immediately pickable in a New Sale / New Order cart without a trip
 * to Inventory first.
 *
 * @param onClose  called to dismiss the modal
 * @param onCreated({ article, piece }) called after both are created; the
 *   returned article carries quantity: 1 so it passes the usual
 *   `quantity > 0` filter used in article pickers.
 */
export default function AddArticleModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Article name is required.'); return; }
    if (!(Number(form.gross_weight) > 0)) { setError('Enter the gross weight of the first piece.'); return; }

    setSubmitting(true);
    try {
      const article = await api.articles.create({
        name: form.name,
        category: form.category,
        metal: form.metal,
        purity: form.purity,
        hsn_code: form.hsn_code,
        gst_rate: form.gst_rate,
        sku: form.sku,
        notes: form.notes,
      });

      const gross = Number(form.gross_weight || 0);
      const stone = Number(form.stone_weight || 0);
      const piece = await api.pieces.create({
        article_id: article.id,
        tag_number: form.tag_number || undefined,
        huid: form.huid,
        gross_weight: gross,
        stone_weight: stone,
        net_weight: Math.max(gross - stone, 0),
        stone_charge: Number(form.stone_charge || 0),
        cost_price: Number(form.cost_price || 0),
      });

      onCreated({
        article: { ...article, quantity: 1, reserved_quantity: 0, total_net_weight: piece.net_weight },
        piece,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Article" onClose={onClose}>
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

        <h4 style={{ margin: '18px 0 4px' }}>First piece (stock)</h4>
        <p className="hint" style={{ marginTop: 0 }}>Adds one physical piece now so it's ready to pick below — add more stock any time from Inventory.</p>
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
          <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Article & Add Stock'}</button>
        </div>
      </form>
    </Modal>
  );
}
