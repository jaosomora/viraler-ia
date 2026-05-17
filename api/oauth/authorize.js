// api/oauth/authorize.js
// GET /oauth/authorize  → valida params, muestra login o consent.
// POST /oauth/login     → valida credenciales, set cookie de sesión, vuelve a GET /authorize.
// POST /oauth/decision  → emite authorization_code y redirige al cliente.
//
// Errores OAuth: si redirect_uri ya está validada, errores se devuelven REDIRIGIENDO al cliente
// con ?error=...&state=... (RFC 6749 §4.1.2.1). Si redirect_uri es inválida, error directo en HTML.

import db from '../database/schema.js';
import {
  randomToken,
  getClient,
  createAuthCode,
  touchClient,
} from './storage.js';
import {
  readSessionCookie,
  setSessionCookie,
  clearSessionCookie,
} from './session.js';
import { renderLogin, renderConsent, renderError } from './views.js';
import { comparePassword } from '../auth.js';

const SUPPORTED_SCOPES = ['transcribe:read', 'transcribe:write', 'analyze:write'];
const DEFAULT_SCOPES = ['transcribe:read', 'transcribe:write', 'analyze:write'];

function isAccessExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// Redirige al cliente con error (cuando redirect_uri ya es confiable).
function redirectError(res, redirectUri, error, description, state) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  if (description) url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  res.redirect(302, url.toString());
}

// Extrae los params OAuth de query (GET) o body (POST). Sanea tipos.
function extractParams(src) {
  const get = (k) => (typeof src[k] === 'string' ? src[k] : undefined);
  return {
    response_type: get('response_type'),
    client_id: get('client_id'),
    redirect_uri: get('redirect_uri'),
    code_challenge: get('code_challenge'),
    code_challenge_method: get('code_challenge_method'),
    scope: get('scope'),
    state: get('state'),
    resource: get('resource'),
  };
}

// Valida y normaliza. Devuelve { ok: true, client, params } o { ok: false, status, message, htmlError }.
async function validateAndLoad(rawParams) {
  const p = rawParams;
  if (!p.client_id) return { ok: false, htmlError: { title: 'Error', message: 'Falta client_id.' } };

  const client = await getClient(p.client_id);
  if (!client) return { ok: false, htmlError: { title: 'Cliente desconocido', message: 'El client_id no está registrado.' } };

  if (!p.redirect_uri || !client.redirect_uris.includes(p.redirect_uri)) {
    return { ok: false, htmlError: { title: 'redirect_uri inválida', message: 'La redirect_uri no coincide con ninguna registrada para este cliente.' } };
  }

  // A partir de aquí redirect_uri es confiable → cualquier error subsiguiente se devuelve por redirect.
  if (p.response_type !== 'code') {
    return { ok: false, redirect: { error: 'unsupported_response_type', description: 'Solo response_type=code está soportado' } };
  }
  if (!p.code_challenge) {
    return { ok: false, redirect: { error: 'invalid_request', description: 'PKCE requerido: falta code_challenge' } };
  }
  if (p.code_challenge_method && p.code_challenge_method !== 'S256') {
    return { ok: false, redirect: { error: 'invalid_request', description: 'PKCE S256 requerido' } };
  }

  // Scopes: filtrar a los soportados. Si no se pidieron, usar default.
  let scopes;
  if (p.scope) {
    scopes = p.scope.split(/\s+/).filter(s => SUPPORTED_SCOPES.includes(s));
    if (scopes.length === 0) {
      return { ok: false, redirect: { error: 'invalid_scope', description: 'Ningún scope solicitado es soportado' } };
    }
  } else {
    scopes = DEFAULT_SCOPES;
  }

  return { ok: true, client, params: { ...p, code_challenge_method: 'S256' }, scopes };
}

// ── GET /oauth/authorize ──────────────────────────────────────────────────
export async function authorizeGet(req, res) {
  const raw = extractParams(req.query);
  const v = await validateAndLoad(raw);
  if (!v.ok) {
    if (v.redirect) return redirectError(res, raw.redirect_uri, v.redirect.error, v.redirect.description, raw.state);
    return res.status(400).send(renderError(v.htmlError));
  }

  const session = readSessionCookie(req);
  const formParams = {
    response_type: v.params.response_type,
    client_id: v.params.client_id,
    redirect_uri: v.params.redirect_uri,
    code_challenge: v.params.code_challenge,
    code_challenge_method: v.params.code_challenge_method,
    scope: v.scopes.join(' '),
    state: v.params.state,
    resource: v.params.resource,
  };

  // Sin sesión → login.
  if (!session) {
    return res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(
      renderLogin({ clientName: v.client.client_name, params: formParams })
    );
  }

  // Sesión válida → cargar user y verificar que sigue con acceso vigente.
  db.get('SELECT id, email, role, access_expires_at FROM users WHERE id = ?', [session.userId], (err, user) => {
    if (err) return res.status(500).send(renderError({ title: 'Error', message: 'No se pudo cargar tu cuenta.' }));
    if (!user) {
      clearSessionCookie(res);
      return res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(
        renderLogin({ clientName: v.client.client_name, params: formParams, error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' })
      );
    }
    if (user.role !== 'owner' && isAccessExpired(user.access_expires_at)) {
      return res.status(403).send(renderError({
        title: 'Acceso expirado',
        message: 'Tu acceso a AS Tools expiró. Contacta al administrador para extenderlo.'
      }));
    }
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(
      renderConsent({
        clientName: v.client.client_name,
        userEmail: user.email,
        scopes: v.scopes,
        params: formParams,
      })
    );
  });
}

// ── POST /oauth/login ─────────────────────────────────────────────────────
export async function authorizeLogin(req, res) {
  const raw = extractParams(req.body);
  const v = await validateAndLoad(raw);
  if (!v.ok) {
    if (v.redirect) return redirectError(res, raw.redirect_uri, v.redirect.error, v.redirect.description, raw.state);
    return res.status(400).send(renderError(v.htmlError));
  }

  const { email, password } = req.body || {};
  const formParams = {
    response_type: v.params.response_type,
    client_id: v.params.client_id,
    redirect_uri: v.params.redirect_uri,
    code_challenge: v.params.code_challenge,
    code_challenge_method: v.params.code_challenge_method,
    scope: v.scopes.join(' '),
    state: v.params.state,
    resource: v.params.resource,
  };

  if (!email || !password) {
    return res.status(400).set('Content-Type', 'text/html; charset=utf-8').send(
      renderLogin({ clientName: v.client.client_name, params: formParams, error: 'Email y contraseña son requeridos.' })
    );
  }

  db.get('SELECT id, email, password_hash, role, access_expires_at FROM users WHERE email = ?', [email.trim().toLowerCase()], (err, user) => {
    if (err) return res.status(500).send(renderError({ title: 'Error', message: 'Error de servidor.' }));
    const invalid = !user || !comparePassword(password, user.password_hash);
    if (invalid) {
      return res.status(401).set('Content-Type', 'text/html; charset=utf-8').send(
        renderLogin({ clientName: v.client.client_name, params: formParams, error: 'Email o contraseña incorrectos.' })
      );
    }
    if (user.role !== 'owner' && isAccessExpired(user.access_expires_at)) {
      return res.status(403).send(renderError({
        title: 'Acceso expirado',
        message: 'Tu acceso a AS Tools expiró. Contacta al administrador.'
      }));
    }

    setSessionCookie(res, user.id);

    // Redirigir de vuelta a GET /authorize con los mismos params → mostrará consent.
    const url = new URL('/oauth/authorize', `${req.protocol}://${req.get('host')}`);
    for (const [k, val] of Object.entries(formParams)) {
      if (val !== undefined && val !== null && val !== '') url.searchParams.set(k, val);
    }
    res.redirect(303, url.pathname + url.search);
  });
}

// ── POST /oauth/decision ──────────────────────────────────────────────────
export async function authorizeDecision(req, res) {
  const raw = extractParams(req.body);
  const v = await validateAndLoad(raw);
  if (!v.ok) {
    if (v.redirect) return redirectError(res, raw.redirect_uri, v.redirect.error, v.redirect.description, raw.state);
    return res.status(400).send(renderError(v.htmlError));
  }

  const session = readSessionCookie(req);
  if (!session) {
    // Sesión expirada durante el consent. Redirigir al login OAuth otra vez.
    const url = new URL('/oauth/authorize', `${req.protocol}://${req.get('host')}`);
    for (const [k, val] of Object.entries({
      response_type: v.params.response_type,
      client_id: v.params.client_id,
      redirect_uri: v.params.redirect_uri,
      code_challenge: v.params.code_challenge,
      code_challenge_method: v.params.code_challenge_method,
      scope: v.scopes.join(' '),
      state: v.params.state,
      resource: v.params.resource,
    })) {
      if (val !== undefined && val !== null && val !== '') url.searchParams.set(k, val);
    }
    return res.redirect(303, url.pathname + url.search);
  }

  const decision = (req.body || {}).decision;
  if (decision === 'deny') {
    return redirectError(res, v.params.redirect_uri, 'access_denied', 'El usuario denegó la autorización', v.params.state);
  }
  if (decision !== 'authorize') {
    return redirectError(res, v.params.redirect_uri, 'invalid_request', 'decision inválida', v.params.state);
  }

  // Emitir authorization_code (single-use, 10 min).
  const code = randomToken(32);
  try {
    await createAuthCode({
      code,
      clientId: v.params.client_id,
      userId: session.userId,
      redirectUri: v.params.redirect_uri,
      codeChallenge: v.params.code_challenge,
      codeChallengeMethod: 'S256',
      scope: v.scopes.join(' '),
      resource: v.params.resource || null,
    });
  } catch (err) {
    console.error('[oauth] createAuthCode failed', err.message);
    return redirectError(res, v.params.redirect_uri, 'server_error', 'No se pudo emitir el code', v.params.state);
  }

  touchClient(v.params.client_id);
  console.log(`[oauth] code issued client=${v.params.client_id} user=${session.userId} scope="${v.scopes.join(' ')}"`);

  // Limpiar la cookie de sesión OAuth — su único trabajo era llevar este flujo a este momento.
  clearSessionCookie(res);

  const url = new URL(v.params.redirect_uri);
  url.searchParams.set('code', code);
  if (v.params.state) url.searchParams.set('state', v.params.state);
  res.redirect(302, url.toString());
}
