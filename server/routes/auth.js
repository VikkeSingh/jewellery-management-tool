import { Router } from 'express';
import { verifyCredentials, issueToken, setSessionCookie, clearSessionCookie, getSessionUser } from '../auth/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  try {
    const ok = await verifyCredentials(username, password);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
    const token = issueToken(username);
    setSessionCookie(res, token);
    res.json({ username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(user);
});

export default router;
