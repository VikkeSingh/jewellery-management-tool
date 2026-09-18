import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings.get().then(setForm);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const updated = await api.settings.update(form);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!form) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header"><h2>Settings</h2></div>

      <form onSubmit={submit}>
        <div className="card">
          <h3>Today's metal rates</h3>
          <p className="hint">Update these daily — they're used to auto-price items during billing (you can still override per sale).</p>
          <div className="grid cols-2">
            <div className="field"><label>Gold rate (₹ per gram)</label><input type="number" step="0.01" value={form.gold_rate_per_gram} onChange={(e) => setForm({ ...form, gold_rate_per_gram: Number(e.target.value) })} /></div>
            <div className="field"><label>Silver rate (₹ per gram)</label><input type="number" step="0.01" value={form.silver_rate_per_gram} onChange={(e) => setForm({ ...form, silver_rate_per_gram: Number(e.target.value) })} /></div>
          </div>
        </div>

        <div className="card">
          <h3>Shop details (appear on every invoice)</h3>
          <div className="grid cols-2">
            <div className="field"><label>Shop name</label><input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} /></div>
            <div className="field"><label>GSTIN</label><input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            <div className="field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="field"><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Used to decide CGST/SGST vs IGST" /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
        </div>

        <div className="card">
          <h3>Numbering & footer</h3>
          <p className="hint">Tax Invoices and Estimates are numbered separately, like separate books.</p>
          <div className="grid cols-2">
            <div className="field"><label>Tax Invoice number prefix</label><input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} /></div>
            <div className="field"><label>Next Tax Invoice number</label><input readOnly value={form.next_invoice_no} /></div>
            <div className="field"><label>Estimate number prefix</label><input value={form.estimate_prefix || ''} onChange={(e) => setForm({ ...form, estimate_prefix: e.target.value })} /></div>
            <div className="field"><label>Next Estimate number</label><input readOnly value={form.next_estimate_no ?? 1} /></div>
          </div>
          <div className="field"><label>Invoice footer note</label><textarea rows={2} value={form.invoice_footer} onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })} /></div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit">Save Settings</button>
          {saved && <span style={{ color: 'var(--success)', alignSelf: 'center' }}>Saved!</span>}
        </div>
      </form>
    </div>
  );
}
