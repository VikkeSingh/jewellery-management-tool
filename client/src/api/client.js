const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  auth: {
    login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  settings: {
    get: () => request('/settings'),
    update: (body) => request('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  },
  articles: {
    list: () => request('/articles'),
    get: (id) => request(`/articles/${id}`),
    create: (body) => request('/articles', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => request(`/articles/${id}`, { method: 'DELETE' }),
  },
  pieces: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/pieces${qs ? `?${qs}` : ''}`);
    },
    create: (body) => request('/pieces', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/pieces/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => request(`/pieces/${id}`, { method: 'DELETE' }),
  },
  customers: {
    list: (q) => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    create: (body) => request('/customers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  invoices: {
    list: () => request('/invoices'),
    get: (id) => request(`/invoices/${id}`),
    create: (body) => request('/invoices', { method: 'POST', body: JSON.stringify(body) }),
    cancel: (id) => request(`/invoices/${id}/cancel`, { method: 'POST' }),
  },
  orders: {
    list: (status) => request(`/orders${status ? `?status=${status}` : ''}`),
    get: (id) => request(`/orders/${id}`),
    create: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),
    cancel: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
    complete: (id, body) => request(`/orders/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),
  },
};
