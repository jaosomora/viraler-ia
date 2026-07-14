/**
 * Obtiene un JWT de sesión para un usuario de prueba y arma el snippet de login
 * por token para el navegador — SIN teclear la contraseña en la UI.
 *
 *   npm run test:token                                  # test.owner@algosentido.dev
 *   npm run test:token test.cliente@algosentido.dev
 *   BASE=https://as-tools.algosentido.com npm run test:token …   # contra otro entorno
 *
 * El token lo firma el propio backend (POST /api/auth/login), así que SIEMPRE valida
 * contra ese backend — sin depender de cómo cargue el JWT_SECRET. Requiere el backend
 * arriba (en QA local siempre lo está: npm run dev).
 *
 * Nota: test.expirado@algosentido.dev NO obtiene token a propósito (su acceso está
 * vencido). Para probar el camino "acceso expirado" usa el formulario de login con ese
 * email; el backend debe rechazarlo con el mensaje de expiración.
 */
import { TEST_PASSWORD } from './seed-test-users.js';

const BASE = process.env.BASE || 'http://localhost:3000';
const email = process.argv[2] || 'test.owner@algosentido.dev';

const origin = BASE.replace(/\/$/, '');

try {
  const res = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`\n✗ Login falló (HTTP ${res.status}): ${data.error || 'error desconocido'}`);
    if (email.includes('expirado')) {
      console.error('  (Es esperado: ese usuario tiene el acceso vencido a propósito.)');
    } else {
      console.error('  ¿Sembraste los usuarios? → npm run seed:test   ¿Backend arriba? → npm run dev');
    }
    process.exit(1);
  }

  console.log(`\n${data.user.email}  [${data.user.role}]`);
  console.log(`\nJWT:\n${data.token}`);
  console.log(`\nLogin por token — pegar en la consola del navegador en el origen de la app:`);
  console.log(`localStorage.setItem('token','${data.token}');location.reload()\n`);
} catch (e) {
  console.error(`\n✗ No pude contactar el backend en ${origin}: ${e.message}`);
  console.error('  Levanta el entorno con: npm run dev\n');
  process.exit(1);
}
