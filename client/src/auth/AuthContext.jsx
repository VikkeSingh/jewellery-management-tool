import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [error, setError] = useState('');

  const checkSession = useCallback(() => {
    api.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    checkSession();
    const onUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [checkSession]);

  async function login(username, password) {
    setError('');
    try {
      const u = await api.auth.login(username, password);
      setUser(u);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function logout() {
    await api.auth.logout().catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
