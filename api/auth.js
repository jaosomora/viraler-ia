// api/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'viralai-dev-secret-change-in-production';

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
    { expiresIn: '7d' }
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
