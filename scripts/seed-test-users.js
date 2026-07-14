/**
 * Siembra usuarios de prueba deterministas para QA local.
 *
 *   npm run seed:test
 *
 * Idempotente: si un usuario ya existe, le restablece password/rol/expiración a los
 * valores conocidos de abajo (así las pruebas siempre parten del mismo estado).
 *
 * SOLO desarrollo: aborta si NODE_ENV=production. Nunca toca la BD de producción.
 * Los usuarios y la contraseña son fixtures desechables (no dan acceso a nada sensible:
 * viven en el SQLite local ./data/as-transcribe.db).
 *
 * Para obtener un token de sesión (login sin teclear contraseña), usa después:
 *   npm run test:token <email>
 * (el token lo firma el backend, así siempre valida — ver docs/TESTING.md).
 */
import 'dotenv/config';
import { fileURLToPath } from 'url';

// Contraseña compartida — fixture desechable, documentada en docs/TESTING.md.
// Exportada para que otros scripts (test-token.js) la importen sin arrastrar la siembra.
export const TEST_PASSWORD = 'Prueba1234';

const DAY = 24 * 60 * 60 * 1000;

// access: null = sin límite · '+1y' = cliente activo · 'expired' = acceso vencido (para
// probar el camino de "acceso expirado" sin esperar).
const TEST_USERS = [
  { email: 'test.owner@algosentido.dev',    name: 'Test Owner',    role: 'owner',  access: null },
  { email: 'test.cliente@algosentido.dev',  name: 'Test Cliente',  role: 'member', access: '+1y' },
  { email: 'test.expirado@algosentido.dev', name: 'Test Expirado', role: 'member', access: 'expired' },
];

function accessValue(a) {
  if (a === 'expired') return new Date(Date.now() - DAY).toISOString();
  if (a === '+1y') return new Date(Date.now() + 365 * DAY).toISOString();
  return null;
}

async function runSeed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('✋ seed-test-users no corre en producción. Abortado.');
    process.exit(1);
  }

  const { default: db } = await import('../api/database/schema.js');
  const { hashPassword } = await import('../api/auth.js');

  const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
  const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

  async function upsert(u) {
    const hash = hashPassword(TEST_PASSWORD);
    const access = accessValue(u.access);
    const existing = await get('SELECT id FROM users WHERE email = ?', [u.email]);

    let id;
    if (existing) {
      id = existing.id;
      await run('UPDATE users SET password_hash = ?, name = ?, role = ? WHERE id = ?', [hash, u.name, u.role, id]);
    } else {
      const r = await run(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        [u.email, hash, u.name, u.role]
      );
      id = r.lastID;
    }
    // access_expires_at se agrega por ALTER (schema.js); protegido por si acaso.
    try {
      await run('UPDATE users SET access_expires_at = ? WHERE id = ?', [access, id]);
    } catch { /* columna ausente en un schema muy viejo: ignorar */ }

    return { ...u, id, access };
  }

  const results = [];
  for (const u of TEST_USERS) results.push(await upsert(u));

  console.log('\n✓ Usuarios de prueba listos (contraseña común: ' + TEST_PASSWORD + ')\n');
  for (const r of results) {
    const estado = r.access === null ? 'sin límite'
      : new Date(r.access) < new Date() ? 'ACCESO VENCIDO (a propósito)'
      : 'activo hasta ' + r.access.slice(0, 10);
    console.log(`• ${r.name} — ${r.email}  [${r.role} · ${estado}]`);
  }
  console.log('\nToken de sesión (login sin teclear contraseña):  npm run test:token <email>');
  console.log('Método completo en docs/TESTING.md.\n');
  db.close();
}

// Sembrar solo al ejecutar el script directamente, no al importar TEST_PASSWORD.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runSeed().catch((e) => { console.error('Error sembrando usuarios de prueba:', e); process.exit(1); });
}
