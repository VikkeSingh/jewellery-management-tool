import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const COOKIE_NAME = 'shop_session';
const TOKEN_TTL = '12h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export async function verifyCredentials(username, password) {
  const expectedUsername = process.env.APP_USERNAME;
  const expectedHash = process.env.APP_PASSWORD_HASH;
  if (!expectedUsername || !expectedHash) {
    throw new Error('APP_USERNAME / APP_PASSWORD_HASH environment variables are not set');
  }
  if (username !== expectedUsername) return false;
  return bcrypt.compare(password, expectedHash);
}

export function issueToken(username) {
  return jwt.sign({ sub: username }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = { username: payload.sub };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

export function getSessionUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    return { username: payload.sub };
  } catch {
    return null;
  }
}
