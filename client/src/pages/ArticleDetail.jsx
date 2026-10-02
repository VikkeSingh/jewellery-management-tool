import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Modal from '../components/Modal.jsx';

const METALS = ['Gold', 'Silver', 'Platinum', 'Diamond'];
const emptyPiece = { tag_number: '', huid: '', gross_weight: '', stone_weight: '', stone_charge: '', cost_price: '' };

function purityPlaceholder(metal) {
  if (metal === 'Gold') return '22K / 18K / 916 / 999';
  if (metal === 'Silver') return '925 / 999 (optional)';
  if (metal === 'Platinum') return '950 (optional)';
  return 'Optional — leave blank if not applicable';
}

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [piece, setPiece] = useState(emptyPiece);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');

  function load() {
    api.articles.get(id).then(setArticle);
  }
  useEffect(load, [id]);

  async function addPiece(e) {
    e.preventDefault();
    setError('');
    try {
      const gross = Number(piece.gross_weight || 0);
      const stone = Number(piece.stone_weight || 0);
      await api.pieces.create({
        article_id: id,
        tag_number: piece.tag_number || undefined,
        huid: piece.huid,
        gross_weight: gross,
        stone_weight: stone,
        net_weight: Math.max(gross - stone, 0),
        stone_charge: Number(piece.stone_charge || 0),
        cost_price: Number(piece.cost_price || 0),
      });
      setShowAdd(false);
      setPiece(emptyPiece);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removePiece(pieceId) {
    if (!confirm('Remove this piece from stock?')) return;
    try {
      await api.pieces.remove(pieceId);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteArticle() {
    if (!confirm('Delete this article? Only possible if it has no stock.')) return;
    try {
      await api.articles.remove(id);
      navigate('/inventory');
    } catch (err) {
      alert(err.message);
    }
  }

  function openEdit() {
    setEditForm({
      name: article.name,
      category: article.category || '',
      metal: article.metal,
      purity: article.purity || '',
      hsn_code: article.hsn_code || '',
      gst_rate: article.gst_rate,
      sku: article.sku || '',
      notes: article.notes || '',
      show_purity: article.show_purity !== false,
    });
    setEditError('');
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError('');
    try {
      await api.articles.update(id, editForm);
      setShowEdit(false);
      load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  if (!article) return <p>Loading...</p>;

  const inStock = article.pieces.filter((p) => p.status === 'in_stock');
  const reserved = article.pieces.filter((p) => p.status === 'reserved');
  const sold = article.pieces.filter((p) => p.status === 'sold');

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/inventory" className="hint">← Back to inventory</Link>
          <h2 style={{ margin: '4px 0 0' }}>{article.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="secondary" onClick={openEdit}>Edit Article</button>
          <button onClick={() => setShowAdd(true)}>+ Add Stock (Piece)</button>
          <button className="danger" onClick={deleteArticle}>Delete Article</button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="value">{article.metal}</div>
          <div className="label">
            Metal / {article.purity || '—'}
            {article.purity && article.show_purity === false && <div className="hint">hidden on invoices</div>}
          </div>
        </div>
        <div className="card stat"><div className="value">{inStock.length}</div><div className="label">Pieces in stock{reserved.length > 0 ? ` (+${reserved.length} reserved)` : ''}</div></div>
        <div className="card stat"><div className="value">{article.gst_rate}%</div><div className="label">GST rate</div></div>
        <div className="card stat"><div className="value">{article.making_charge_type === 'per_gram' ? `₹${article.making_charge_value}/g` : article.making_charge_type === 'percentage' ? `${article.making_charge_value}%` : `₹${article.making_charge_value}`}</div><div className="label">Making charge</div></div>
      </div>

      <div className="card">
        <h3>In stock ({inStock.length})</h3>
        {inStock.length === 0 ? <p className="hint">No pieces in stock. Add stock above.</p> : (
          <table>
            <thead><tr><th>Tag</th><th>HUID</th><th>Gross (g)</th><th>Stone (g)</th><th>Net (g)</th><th>Stone charge</th><th></th></tr></thead>
            <tbody>
              {inStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.tag_number || '—'}</td>
                  <td>{p.huid || '—'}</td>
                  <td>{p.gross_weight.toFixed(3)}</td>
                  <td>{p.stone_weight.toFixed(3)}</td>
                  <td>{p.net_weight.toFixed(3)}</td>
                  <td>₹{p.stone_charge}</td>
                  <td><button className="danger small" onClick={() => removePiece(p.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reserved.length > 0 && (
        <div className="card">
          <h3>Reserved for pending orders ({reserved.length})</h3>
          <p className="hint">These pieces are held against an order's advance payment and can't be sold or edited until the order is completed or cancelled.</p>
          <table>
            <thead><tr><th>Tag</th><th>HUID</th><th>Net (g)</th></tr></thead>
            <tbody>
              {reserved.map((p) => (
                <tr key={p.id}>
                  <td>{p.tag_number || '—'}</td>
                  <td>{p.huid || '—'}</td>
                  <td>{p.net_weight.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sold.length > 0 && (
        <div className="card">
          <h3>Sold history ({sold.length})</h3>
          <table>
            <thead><tr><th>Tag</th><th>HUID</th><th>Net (g)</th><th>Sold at</th></tr></thead>
            <tbody>
              {sold.map((p) => (
                <tr key={p.id}>
                  <td>{p.tag_number || '—'}</td>
                  <td>{p.huid || '—'}</td>
                  <td>{p.net_weight.toFixed(3)}</td>
                  <td>{p.sold_at?.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title={`Add stock — ${article.name}`} onClose={() => setShowAdd(false)}>
          <form onSubmit={addPiece}>
            <div className="grid cols-2">
              <div className="field"><label>Tag / Item number</label><input value={piece.tag_number} onChange={(e) => setPiece({ ...piece, tag_number: e.target.value })} /></div>
              <div className="field"><label>HUID (hallmark, if any)</label><input value={piece.huid} onChange={(e) => setPiece({ ...piece, huid: e.target.value })} /></div>
              <div className="field"><label>Gross weight (g) *</label><input required type="number" step="0.001" value={piece.gross_weight} onChange={(e) => setPiece({ ...piece, gross_weight: e.target.value })} /></div>
              <div className="field"><label>Stone weight (g)</label><input type="number" step="0.001" value={piece.stone_weight} onChange={(e) => setPiece({ ...piece, stone_weight: e.target.value })} /></div>
              <div className="field"><label>Stone charge (₹)</label><input type="number" step="0.01" value={piece.stone_charge} onChange={(e) => setPiece({ ...piece, stone_charge: e.target.value })} /></div>
              <div className="field"><label>Cost price (₹, optional)</label><input type="number" step="0.01" value={piece.cost_price} onChange={(e) => setPiece({ ...piece, cost_price: e.target.value })} /></div>
            </div>
            <p className="hint">Net weight = gross − stone weight, calculated automatically.</p>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit">Add to Stock</button>
            </div>
          </form>
        </Modal>
      )}

      {showEdit && editForm && (
        <Modal title={`Edit — ${article.name}`} onClose={() => setShowEdit(false)}>
          <form onSubmit={saveEdit}>
            <div className="field">
              <label>Article name *</label>
              <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>Category</label>
                <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
              </div>
              <div className="field">
                <label>SKU (optional)</label>
                <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
              </div>
              <div className="field">
                <label>Metal</label>
                <select
                  value={editForm.metal}
                  onChange={(e) => setEditForm({ ...editForm, metal: e.target.value })}
                >
                  {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Purity (optional)</label>
                <input value={editForm.purity} onChange={(e) => setEditForm({ ...editForm, purity: e.target.value })} placeholder={purityPlaceholder(editForm.metal)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.show_purity} onChange={(e) => setEditForm({ ...editForm, show_purity: e.target.checked })} style={{ width: 'auto' }} />
                  <span className="hint" style={{ margin: 0 }}>Show purity on invoices</span>
                </label>
              </div>
              <div className="field">
                <label>HSN code</label>
                <input value={editForm.hsn_code} onChange={(e) => setEditForm({ ...editForm, hsn_code: e.target.value })} />
              </div>
              <div className="field">
                <label>GST rate (%)</label>
                <input type="number" step="0.01" value={editForm.gst_rate} onChange={(e) => setEditForm({ ...editForm, gst_rate: Number(e.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <p className="hint">Changes apply going forward — already-issued invoices keep whatever purity they were printed with.</p>
            {editError && <div className="error-text">{editError}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
