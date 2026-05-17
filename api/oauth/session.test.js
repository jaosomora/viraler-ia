// Tests de la cookie HMAC del flujo OAuth.
// Estas funciones son la frontera de seguridad: si la verificación falla,
// un atacante podría montar tokens válidos sin firmar. Tests críticos.

import { describe, it, expect, beforeAll } from 'vitest';
import { issueSession, verifySession } from './session.js';

beforeAll(() => {
  // Asegurar un secret determinístico para los tests (en CI no hay env)
  process.env.OAUTH_SESSION_SECRET = 'test-secret-do-not-use-in-prod';
});

describe('issueSession + verifySession', () => {
  it('round-trip: token emitido se verifica y devuelve el userId', () => {
    const token = issueSession(42);
    const result = verifySession(token);
    expect(result).toEqual({ userId: 42 });
  });

  it('userId 0 devuelve null (no es válido en este sistema)', () => {
    // parseInt('0') === 0, que en condición es falsy → tratado como inválido.
    const token = issueSession(0);
    const result = verifySession(token);
    expect(result).toBeNull();
  });

  it('userId grande funciona (BIGINT-friendly)', () => {
    const token = issueSession(999999999);
    expect(verifySession(token)).toEqual({ userId: 999999999 });
  });
});

describe('verifySession rechaza tokens inválidos', () => {
  it('null/undefined/string vacío → null', () => {
    expect(verifySession(null)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession('')).toBeNull();
  });

  it('formato sin punto → null', () => {
    expect(verifySession('sin-punto')).toBeNull();
  });

  it('formato con muchos puntos → null', () => {
    expect(verifySession('a.b.c.d')).toBeNull();
  });

  it('firma manipulada → null', () => {
    const real = issueSession(7);
    const [payload, sig] = real.split('.');
    // flip un char de la firma
    const flippedSig = sig.charAt(0) === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
    expect(verifySession(`${payload}.${flippedSig}`)).toBeNull();
  });

  it('payload manipulado (mismo formato, otro userId) → null', () => {
    const real = issueSession(7);
    const [, sig] = real.split('.');
    // forjar payload diferente con misma firma
    const fakePayload = Buffer.from('99.9999999999999').toString('base64url');
    expect(verifySession(`${fakePayload}.${sig}`)).toBeNull();
  });

  it('payload con base64 inválido → null', () => {
    expect(verifySession('!!!notbase64!!!.sig')).toBeNull();
  });
});

describe('verifySession respeta expiración', () => {
  it('token expirado (Date.now() avanzado) → null', () => {
    const token = issueSession(5);
    // Avanzar el tiempo 11 minutos (TTL es 10)
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 11 * 60 * 1000;
      expect(verifySession(token)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  it('token aún válido (5 min después) → ok', () => {
    const token = issueSession(5);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 5 * 60 * 1000;
      expect(verifySession(token)).toEqual({ userId: 5 });
    } finally {
      Date.now = realNow;
    }
  });
});

describe('firmas con secret distinto no validan', () => {
  it('cambiar el secret invalida todos los tokens previos', async () => {
    const token = issueSession(99);
    expect(verifySession(token)).toEqual({ userId: 99 });

    // simular rotación del secret
    process.env.OAUTH_SESSION_SECRET = 'OTRO-secret-diferente';
    expect(verifySession(token)).toBeNull();

    // restaurar
    process.env.OAUTH_SESSION_SECRET = 'test-secret-do-not-use-in-prod';
  });
});
