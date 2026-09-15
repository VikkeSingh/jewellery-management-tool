import { NavLink, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import ArticleDetail from './pages/ArticleDetail.jsx';
import NewSale from './pages/NewSale.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Customers from './pages/Customers.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './auth/AuthContext.jsx';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/inventory', label: 'Inventory' },
  { to: '/sale', label: 'New Sale' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/customers', label: 'Customers' },
  { to: '/settings', label: 'Settings' },
];

export default function App() {
  const { user, logout } = useAuth();

  if (user === undefined) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <h1>✦ Jewel Manager</h1>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '10px 12px', fontSize: 13, opacity: 0.8 }}>Signed in as {user.username}</div>
        <button className="secondary small" onClick={logout} style={{ margin: '0 12px' }}>Log out</button>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/:id" element={<ArticleDetail />} />
          <Route path="/sale" element={<NewSale />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
