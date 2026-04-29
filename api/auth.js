// api/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from './database/schema.js';
import { sendMagicLinkEmail } from './services/emailService.js';

const MAGIC_LINK_TTL_MINUTES = 15;

const JWT_SECRET = process.env.JWT_SECRET || 'as-transcribe-dev-secret-change-in-production';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function ownerOnly(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
}

export function registerUser(name, email, password) {
  return new Promise((resolve, reject) => {
    // Check if this is the first user (becomes owner)
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) return reject(err);

      const role = row.count === 0 ? 'owner' : 'member';
      const password_hash = hashPassword(password);

      db.run(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, password_hash, role],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              return reject(new Error('Ya existe una cuenta con ese email'));
            }
            return reject(err);
          }
          const user = { id: this.lastID, name, email, role };
          resolve({ user, token: generateToken(user) });
        }
      );
    });
  });
}

export function listUsers() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC',
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

export function generateTempPassword() {
  return Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
}

export function adminResetPassword(userId, newPassword) {
  return new Promise((resolve, reject) => {
    const password_hash = hashPassword(newPassword);
    db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, userId],
      function (err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error('Usuario no encontrado'));
        resolve({ success: true });
      }
    );
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Enmascara emails para logs: "info@julianosoriom.com" -> "i***@julianosoriom.com"
function maskEmail(e) {
  if (!e || typeof e !== 'string' || !e.includes('@')) return '***';
  const [user, domain] = e.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
}

// Genera un magic link y lo envía por email. Siempre resuelve con éxito (aunque
// el email no exista) para no permitir enumeración de usuarios.
export function requestMagicLink(email, baseUrl) {
  const masked = maskEmail(email);
  return new Promise((resolve) => {
    db.get('SELECT id, email FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error(`[auth] magic-link db_error email=${masked} err=${err.message}`);
        return resolve({ sent: true });
      }
      if (!user) {
        console.log(`[auth] magic-link user_not_found email=${masked}`);
        return resolve({ sent: true });
      }

      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000).toISOString();

      db.run(
        'INSERT INTO magic_link_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, tokenHash, expiresAt],
        async function (insertErr) {
          if (insertErr) {
            console.error(`[auth] magic-link token_insert_failed email=${masked} err=${insertErr.message}`);
            return resolve({ sent: true });
          }
          const link = `${baseUrl.replace(/\/$/, '')}/magic/${rawToken}`;
          try {
            const result = await sendMagicLinkEmail({
              to: user.email,
              link,
              expiresMinutes: MAGIC_LINK_TTL_MINUTES
            });
            const channel = result?.devMode ? 'console' : `resend id=${result?.id || '?'}`;
            console.log(`[auth] magic-link sent email=${masked} via=${channel} expires=${MAGIC_LINK_TTL_MINUTES}m`);
          } catch (e) {
            console.error(`[auth] magic-link send_failed email=${masked} err=${e.message}`);
          }
          resolve({ sent: true });
        }
      );
    });
  });
}

// Verifica un magic link. Si es válido, lo marca como usado y devuelve { user, token }.
export function verifyMagicLink(rawToken) {
  return new Promise((resolve, reject) => {
    if (!rawToken || typeof rawToken !== 'string') {
      console.warn('[auth] magic-link verify_invalid_input');
      return reject(new Error('Token inválido'));
    }
    const tokenHash = hashToken(rawToken);
    db.get(
      `SELECT t.*, u.id AS u_id, u.email AS u_email, u.name AS u_name, u.role AS u_role
       FROM magic_link_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`,
      [tokenHash],
      (err, row) => {
        if (err) {
          console.error(`[auth] magic-link verify_db_error err=${err.message}`);
          return reject(err);
        }
        if (!row) {
          console.warn('[auth] magic-link verify_not_found');
          return reject(new Error('Link inválido'));
        }
        const masked = maskEmail(row.u_email);
        if (row.used_at) {
          console.warn(`[auth] magic-link verify_already_used email=${masked}`);
          return reject(new Error('Este link ya fue utilizado'));
        }
        if (new Date(row.expires_at) < new Date()) {
          console.warn(`[auth] magic-link verify_expired email=${masked}`);
          return reject(new Error('Link expirado'));
        }

        db.run(
          'UPDATE magic_link_tokens SET used_at = datetime(\'now\') WHERE id = ?',
          [row.id],
          (updErr) => {
            if (updErr) return reject(updErr);
            console.log(`[auth] magic-link verify_success email=${masked}`);
            const userData = { id: row.u_id, name: row.u_name, email: row.u_email, role: row.u_role };
            resolve({ user: userData, token: generateToken(userData) });
          }
        );
      }
    );
  });
}

export function loginUser(email, password) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) return reject(err);
      if (!user) return reject(new Error('Email o contraseña incorrectos'));

      if (!comparePassword(password, user.password_hash)) {
        return reject(new Error('Email o contraseña incorrectos'));
      }

      const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
      resolve({ user: userData, token: generateToken(userData) });
    });
  });
}
