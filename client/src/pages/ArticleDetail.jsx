import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Modal from '../components/Modal.jsx';

const emptyPiece = { tag_number: '', huid: '', gross_weight: '', stone_weight: '', carat_weight: '', stone_charge: '', cost_price: '' };

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [piece, setPiece] = useState(emptyPiece);
  const [error, setError] = useState('');

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
        carat_weight: piece.carat_weight !== '' ? Number(piece.carat_weight) : undefined,
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

  if (!article) return <p>Loading...</p>;

  const isDiamond = article.metal === 'Diamond';
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
          <button onClick={() => setShowAdd(true)}>+ Add Stock (Piece)</button>
          <button className="danger" onClick={deleteArticle}>Delete Article</button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card stat"><div className="value">{article.metal}</div><div className="label">Metal / {article.purity || '—'}</div></div>
        <div className="card stat"><div className="value">{inStock.length}</div><div className="label">Pieces in stock{reserved.length > 0 ? ` (+${reserved.length} reserved)` : ''}</div></div>
        <div className="card stat"><div className="value">{article.gst_rate}%</div><div className="label">GST rate</div></div>
        <div className="card stat"><div className="value">{article.making_charge_type === 'per_gram' ? `₹${article.making_charge_value}/g` : article.making_charge_type === 'percentage' ? `${article.making_charge_value}%` : `₹${article.making_charge_value}`}</div><div className="label">Making charge</div></div>
      </div>

      <div className="card">
        <h3>In stock ({inStock.length})</h3>
        {inStock.length === 0 ? <p className="hint">No pieces in stock. Add stock above.</p> : (
          <table>
            <thead>
              <tr>
                <th>Tag</th><th>HUID</th><th>Gross (g)</th><th>Stone (g)</th><th>Net (g)</th>
                {isDiamond && <th>Carat (ct)</th>}
                <th>Stone charge</th><th></th>
              </tr>
            </thead>
            <tbody>
              {inStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.tag_number || '—'}</td>
                  <td>{p.huid || '—'}</td>
                  <td>{p.gross_weight.toFixed(3)}</td>
                  <td>{p.stone_weight.toFixed(3)}</td>
                  <td>{p.net_weight.toFixed(3)}</td>
                  {isDiamond && <td>{(p.carat_weight || 0).toFixed(3)}</td>}
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
            <thead><tr><th>Tag</th><th>HUID</th><th>Net (g)</th>{isDiamond && <th>Carat (ct)</th>}</tr></thead>
            <tbody>
              {reserved.map((p) => (
                <tr key={p.id}>
                  <td>{p.tag_number || '—'}</td>
                  <td>{p.huid || '—'}</td>
                  <td>{p.net_weight.toFixed(3)}</td>
                  {isDiamond && <td>{(p.carat_weight || 0).toFixed(3)}</td>}
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
            <thead><tr><th>Tag</th><th>HUID</th><th>Net (g)</th>{isDiamond && <th>Carat (ct)</th>}<th>Sold at</th></tr></thead>
            <tbody>
              {sold.map((p) => (
                <tr key={p.id}>
                  <td>{p.tag_number || '—'}</td>
                  <td>{p.huid || '—'}</td>
                  <td>{p.net_weight.toFixed(3)}</td>
                  {isDiamond && <td>{(p.carat_weight || 0).toFixed(3)}</td>}
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
              {isDiamond && (
                <div className="field">
                  <label>Diamond carat weight (ct) *</label>
                  <input required type="number" step="0.001" value={piece.carat_weight} onChange={(e) => setPiece({ ...piece, carat_weight: e.target.value })} />
                </div>
              )}
              <div className="field"><label>Stone charge (₹)</label><input type="number" step="0.01" value={piece.stone_charge} onChange={(e) => setPiece({ ...piece, stone_charge: e.target.value })} /></div>
              <div className="field"><label>Cost price (₹, optional)</label><input type="number" step="0.01" value={piece.cost_price} onChange={(e) => setPiece({ ...piece, cost_price: e.target.value })} /></div>
            </div>
            <p className="hint">Net weight = gross − stone weight, calculated automatically.{isDiamond ? ' Diamond carat weight is used to price this item at billing time, priced separately from gross/net weight.' : ''}</p>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit">Add to Stock</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
