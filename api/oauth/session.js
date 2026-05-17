// api/oauth/session.js
// Cookie de sesión OAuth (10 min). Solo existe durante el flujo authorize → login → consent.
// Formato: base64url("{userId}.{expiresMs}") + "." + HMAC-SHA256 truncado a 32 bytes.
// No es un JWT (overkill para 10 min y dos campos) y no toca el JWT_SECRET de la app
// principal — usa OAUTH_SESSION_SECRET (o lo deriva de JWT_SECRET si no está set).

import crypto from 'crypto';

const COOKIE_NAME = 'oauth_session';
const TTL_MS = 10 * 60 * 1000;

function secret() {
  return process.env.OAUTH_SESSION_SECRET || process.env.JWT_SECRET || 'as-tools-oauth-dev';
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function issueSession(userId) {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  let payload;
  try { payload = Buffer.from(b64, 'base64url').toString('utf8'); } catch { return null; }
  const expected = sign(payload);
  if (!timingSafeEq(sig, expected)) return null;
  const [userIdStr, expiresStr] = payload.split('.');
  const userId = parseInt(userIdStr, 10);
  const expiresAt = parseInt(expiresStr, 10);
  if (!userId || !expiresAt) return null;
  if (Date.now() > expiresAt) return null;
  return { userId };
}

// Parser minimalista de Cookie header (sin dep externa).
export function readSessionCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookies = header.split(';').map(s => s.trim());
  const found = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!found) return null;
  const value = decodeURIComponent(found.slice(COOKIE_NAME.length + 1));
  return verifySession(value);
}

export function setSessionCookie(res, userId) {
  const value = issueSession(userId);
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/oauth',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/oauth',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}
