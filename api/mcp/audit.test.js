// Tests del módulo de audit + cuotas del MCP.
// Las funciones puras (summarizeArgs, isQuotaApplicable) se testean directo.
// checkQuota se testea mockeando el módulo db para no tocar el disco.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock del DB ANTES de importar audit.js ───────────────────────────────
// Reemplazamos el módulo schema.js completo. Cada test puede sobreescribir
// las implementaciones de db.get/run usando mockGet/mockRun.
const mockGet = vi.fn();
const mockRun = vi.fn();
vi.mock('../database/schema.js', () => ({
  default: {
    get: (...args) => mockGet(...args),
    run: (...args) => mockRun(...args),
  },
}));

import { checkQuota, isQuotaApplicable } from './audit.js';

beforeEach(() => {
  mockGet.mockReset();
  mockRun.mockReset();
});

describe('isQuotaApplicable', () => {
  it('aplica a transcribe_video_url (cuesta dinero)', () => {
    expect(isQuotaApplicable('transcribe_video_url')).toBe(true);
  });

  it('NO aplica a list_my_transcriptions (read-only)', () => {
    expect(isQuotaApplicable('list_my_transcriptions')).toBe(false);
  });

  it('NO aplica a get_transcription (read-only)', () => {
    expect(isQuotaApplicable('get_transcription')).toBe(false);
  });

  it('NO aplica a analyze_ideas (delega a Claude, sin costo en server)', () => {
    expect(isQuotaApplicable('analyze_ideas')).toBe(false);
  });

  it('NO aplica a tool desconocida', () => {
    expect(isQuotaApplicable('alguna_tool_random')).toBe(false);
  });
});

// Helper: el db real usa callbacks. Nuestro mock necesita simular eso.
function mockGetReturns(row) {
  mockGet.mockImplementation((sql, params, cb) => {
    // db.get(sql, callback) o db.get(sql, params, callback)
    const callback = typeof params === 'function' ? params : cb;
    callback(null, row);
  });
}

describe('checkQuota', () => {
  it('tool sin cuota aplicable → allowed sin tocar DB', async () => {
    const result = await checkQuota({ id: 1, role: 'member' }, 'list_my_transcriptions');
    expect(result).toEqual({ allowed: true });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('owner siempre allowed sin importar cuota', async () => {
    const result = await checkQuota({ id: 1, role: 'owner' }, 'transcribe_video_url');
    expect(result).toEqual({ allowed: true });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('usuario sin cuota (NULL) → allowed', async () => {
    mockGetReturns({ mcp_quota_transcriptions_per_day: null });
    const result = await checkQuota({ id: 2, role: 'member' }, 'transcribe_video_url');
    expect(result).toEqual({ allowed: true });
  });

  it('usuario con cuota 10, usó 3 → allowed con metadata', async () => {
    // db.get se llama dos veces: 1ra para la cuota del user, 2da para contar uso.
    let calls = 0;
    mockGet.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      calls++;
      if (calls === 1) return callback(null, { mcp_quota_transcriptions_per_day: 10 });
      return callback(null, { used: 3 });
    });
    const result = await checkQuota({ id: 2, role: 'member' }, 'transcribe_video_url');
    expect(result).toEqual({ allowed: true, quota: 10, used: 3 });
  });

  it('usuario con cuota 10, usó 10 (justo en el límite) → rechazado', async () => {
    let calls = 0;
    mockGet.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      calls++;
      if (calls === 1) return callback(null, { mcp_quota_transcriptions_per_day: 10 });
      return callback(null, { used: 10 });
    });
    const result = await checkQuota({ id: 2, role: 'member' }, 'transcribe_video_url');
    expect(result.allowed).toBe(false);
    expect(result.quota).toBe(10);
    expect(result.used).toBe(10);
    expect(result.reason).toMatch(/excedida/i);
  });

  it('usuario con cuota 5, usó 7 (sobre el límite) → rechazado', async () => {
    let calls = 0;
    mockGet.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      calls++;
      if (calls === 1) return callback(null, { mcp_quota_transcriptions_per_day: 5 });
      return callback(null, { used: 7 });
    });
    const result = await checkQuota({ id: 2, role: 'member' }, 'transcribe_video_url');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('7/5');
  });

  it('cuota 0 (explícitamente bloqueado) → rechazado siempre', async () => {
    let calls = 0;
    mockGet.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      calls++;
      if (calls === 1) return callback(null, { mcp_quota_transcriptions_per_day: 0 });
      return callback(null, { used: 0 });
    });
    const result = await checkQuota({ id: 2, role: 'member' }, 'transcribe_video_url');
    expect(result.allowed).toBe(false);
  });

  it('error de DB en chequeo de cuota se propaga', async () => {
    mockGet.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      callback(new Error('DB down'), null);
    });
    await expect(checkQuota({ id: 2, role: 'member' }, 'transcribe_video_url'))
      .rejects.toThrow('DB down');
  });
});
