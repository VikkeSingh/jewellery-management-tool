import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Modal from '../components/Modal.jsx';

const emptyForm = { name: '', phone: '', address: '', state: '', gstin: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  function load() {
    api.customers.list().then(setCustomers);
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.customers.create(form);
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <h2>Customers</h2>
        <button onClick={() => setShowForm(true)}>+ New Customer</button>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {filtered.length === 0 ? <div className="empty-state">No customers yet.</div> : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>State</th><th>GSTIN</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td><td>{c.phone}</td><td>{c.state}</td><td>{c.gstin || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Modal title="New Customer" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <div className="field"><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid cols-2">
              <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div className="field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="field"><label>GSTIN (optional)</label><input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit">Save Customer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
