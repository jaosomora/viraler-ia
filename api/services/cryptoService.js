// api/services/cryptoService.js
// AES-256-GCM symmetric encryption for stored secrets.
// Key comes from SECRETS_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const hex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('SECRETS_ENCRYPTION_KEY no está configurada en .env');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('SECRETS_ENCRYPTION_KEY debe ser 64 caracteres hex (32 bytes)');
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

export function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload) {
  if (!payload) return null;
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Formato de cifrado inválido');
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

export function isConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
