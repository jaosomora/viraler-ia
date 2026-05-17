// api/oauth/views.js
// HTML server-rendered para el flujo OAuth. Sin React, sin framework, sin JS cliente
// más que un toggle visual. CSS inline matching el dark mode de AS Tools.
//
// CRÍTICO: cualquier valor dinámico que se inyecte en HTML pasa por esc() para evitar XSS.
// Los params OAuth vienen del cliente — nunca confiar en ellos.

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BASE_STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0a0a0a; color: #e5e5e5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 440px; background: #141414; border: 1px solid #262626;
    border-radius: 14px; padding: 32px;
  }
  h1 { font-size: 20px; margin: 0 0 8px; font-weight: 600; }
  .sub { color: #a3a3a3; font-size: 14px; margin: 0 0 24px; line-height: 1.5; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .brand-name { font-weight: 600; font-size: 16px; }
  .brand-arrow { color: #525252; font-size: 18px; }
  label { display: block; font-size: 13px; color: #d4d4d4; margin: 16px 0 6px; font-weight: 500; }
  input[type=email], input[type=password], input[type=text] {
    width: 100%; padding: 10px 12px; background: #0a0a0a; border: 1px solid #404040;
    border-radius: 8px; color: #fafafa; font-size: 14px; font-family: inherit;
  }
  input:focus { outline: none; border-color: #737373; }
  button {
    width: 100%; padding: 11px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;
    border: none; cursor: pointer; font-family: inherit; margin-top: 8px;
  }
  .btn-primary { background: #fafafa; color: #0a0a0a; }
  .btn-primary:hover { background: #e5e5e5; }
  .btn-secondary { background: transparent; color: #d4d4d4; border: 1px solid #404040; }
  .btn-secondary:hover { background: #1f1f1f; }
  .btn-danger { background: transparent; color: #f87171; border: 1px solid #525252; }
  .btn-danger:hover { background: #1f1f1f; }
  .row { display: flex; gap: 8px; margin-top: 16px; }
  .row > * { flex: 1; }
  .scope-list { list-style: none; padding: 0; margin: 16px 0 0; }
  .scope-list li {
    padding: 10px 12px; background: #0a0a0a; border: 1px solid #262626;
    border-radius: 6px; margin-bottom: 6px; font-size: 13px; color: #d4d4d4;
  }
  .scope-list li::before { content: '✓ '; color: #4ade80; margin-right: 4px; }
  .error { background: #2a0a0a; border: 1px solid #7f1d1d; color: #fca5a5;
           padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  .hint { color: #737373; font-size: 12px; margin-top: 12px; text-align: center; }
  a { color: #a3a3a3; text-decoration: underline; }
  a:hover { color: #fafafa; }
`;

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${esc(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

// Convierte los params OAuth en <input type=hidden> para reenviarlos en el POST.
function hiddenFields(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join('\n');
}

// ── Login (durante flujo OAuth) ───────────────────────────────────────────
export function renderLogin({ clientName, error, params }) {
  const body = `
    <div class="brand">
      <span class="brand-name">${esc(clientName || 'Aplicación externa')}</span>
      <span class="brand-arrow">→</span>
      <span class="brand-name">AS Tools</span>
    </div>
    <h1>Inicia sesión en AS Tools</h1>
    <p class="sub">Para autorizar a <strong>${esc(clientName || 'esta aplicación')}</strong> primero necesitamos verificar tu identidad.</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="POST" action="/oauth/login">
      ${hiddenFields(params)}
      <label for="email">Email</label>
      <input id="email" type="email" name="email" required autocomplete="email" autofocus>
      <label for="password">Contraseña</label>
      <input id="password" type="password" name="password" required autocomplete="current-password">
      <button type="submit" class="btn-primary">Entrar y continuar</button>
    </form>
    <p class="hint">¿No tienes cuenta? Pídele al administrador que te invite.</p>
  `;
  return layout('Iniciar sesión · AS Tools', body);
}

// ── Consent ───────────────────────────────────────────────────────────────
const SCOPE_LABELS = {
  'transcribe:read': 'Leer tus transcripciones y análisis guardados',
  'transcribe:write': 'Transcribir videos nuevos desde URL en tu nombre',
  'analyze:write': 'Generar análisis de ideas con IA (consume tu cuota mensual)',
  'ideas:write': 'Usar el Generador de Ideas (mapas de contraste + cruces) desde tu chat',
};

export function renderConsent({ clientName, userEmail, scopes, params }) {
  const scopeItems = scopes
    .map(s => `<li>${esc(SCOPE_LABELS[s] || s)}</li>`)
    .join('');

  const body = `
    <div class="brand">
      <span class="brand-name">${esc(clientName || 'Aplicación externa')}</span>
      <span class="brand-arrow">→</span>
      <span class="brand-name">AS Tools</span>
    </div>
    <h1>Autorizar conexión</h1>
    <p class="sub"><strong>${esc(clientName || 'Esta aplicación')}</strong> quiere conectarse a tu cuenta de AS Tools (<code>${esc(userEmail)}</code>).</p>
    <p class="sub" style="margin-bottom:8px;">Podrá:</p>
    <ul class="scope-list">${scopeItems}</ul>
    <form method="POST" action="/oauth/decision">
      ${hiddenFields(params)}
      <div class="row">
        <button type="submit" name="decision" value="deny" class="btn-danger">Cancelar</button>
        <button type="submit" name="decision" value="authorize" class="btn-primary">Autorizar</button>
      </div>
    </form>
    <p class="hint">Podrás revocar este acceso en cualquier momento desde el panel admin.</p>
  `;
  return layout('Autorizar acceso · AS Tools', body);
}

// ── Página de error final (cuando no podemos redirigir al cliente) ────────
export function renderError({ title, message }) {
  const body = `
    <h1>${esc(title)}</h1>
    <p class="sub">${esc(message)}</p>
    <p class="hint"><a href="/">Volver a AS Tools</a></p>
  `;
  return layout(`${title} · AS Tools`, body);
}
