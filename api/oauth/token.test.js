// Tests del verificador PKCE S256.
// Spec: RFC 7636 §4.6 — challenge = base64url(SHA256(verifier))
// Si esta función falla en aceptar verifiers válidos: clientes legítimos no pueden completar el flujo.
// Si falla en rechazar verifiers inválidos: cualquiera con el code puede obtener token (vulnerabilidad crítica).

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyPkceS256 } from './token.js';

function makePair() {
  const verifier = crypto.randomBytes(32).toString('base64url'); // 43 chars
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

describe('verifyPkceS256', () => {
  it('acepta pair válido', () => {
    const { verifier, challenge } = makePair();
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('rechaza verifier que no produce ese challenge', () => {
    const { challenge } = makePair();
    const otroVerifier = crypto.randomBytes(32).toString('base64url');
    expect(verifyPkceS256(otroVerifier, challenge)).toBe(false);
  });

  it('rechaza verifier vacío', () => {
    const { challenge } = makePair();
    expect(verifyPkceS256('', challenge)).toBe(false);
  });

  it('rechaza verifier null/undefined', () => {
    const { challenge } = makePair();
    expect(verifyPkceS256(null, challenge)).toBe(false);
    expect(verifyPkceS256(undefined, challenge)).toBe(false);
  });

  it('rechaza verifier que no es string', () => {
    const { challenge } = makePair();
    expect(verifyPkceS256(12345, challenge)).toBe(false);
    expect(verifyPkceS256({}, challenge)).toBe(false);
  });

  it('rechaza verifier demasiado corto (<43 chars, viola spec)', () => {
    // RFC 7636: code_verifier debe ser 43-128 chars
    expect(verifyPkceS256('abc', 'whatever')).toBe(false);
  });

  it('rechaza verifier demasiado largo (>128 chars)', () => {
    const verifier = 'a'.repeat(129);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkceS256(verifier, challenge)).toBe(false);
  });

  it('verifier de exactamente 43 chars (mínimo) funciona', () => {
    const verifier = 'a'.repeat(43);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('verifier de exactamente 128 chars (máximo) funciona', () => {
    const verifier = 'b'.repeat(128);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('challenge con padding extra (=) no matchea (base64url no padding)', () => {
    const { verifier, challenge } = makePair();
    expect(verifyPkceS256(verifier, challenge + '=')).toBe(false);
  });

  it('challenges con bit-flip no validan', () => {
    const { verifier, challenge } = makePair();
    const flipped = (challenge.charAt(0) === 'A' ? 'B' : 'A') + challenge.slice(1);
    expect(verifyPkceS256(verifier, flipped)).toBe(false);
  });
});
