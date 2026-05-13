// Tests de la lógica núcleo de cortes de Reels Cleaner.
// Captura el comportamiento actual (padding, snap, merge, remap) para que cualquier
// cambio futuro lo rompa explícitamente.

import { describe, it, expect } from 'vitest';
import { detectGaps, buildKeepSegments, remapWords } from './silenceDetector.js';

describe('detectGaps', () => {
  it('returns [] when there are fewer than 2 words', () => {
    expect(detectGaps({ words: [] })).toEqual([]);
    expect(detectGaps({ words: [{ word: 'hola', start: 0, end: 0.5 }] })).toEqual([]);
    expect(detectGaps(null)).toEqual([]);
  });

  it('detects internal gaps larger than 0.15s only', () => {
    const gaps = detectGaps({
      words: [
        { word: 'a', start: 0, end: 0.5 },
        { word: 'b', start: 0.6, end: 1.0 },   // gap 0.10 → ignorado
        { word: 'c', start: 1.5, end: 2.0 },   // gap 0.50 → detectado
      ],
      duration: 2.0,
    });
    expect(gaps.filter(g => g.position === 'internal')).toHaveLength(1);
    expect(gaps[0].start).toBeCloseTo(1.0);
    expect(gaps[0].end).toBeCloseTo(1.5);
  });

  it('detects leading gap when first word starts after 0.15s', () => {
    const gaps = detectGaps({
      words: [
        { word: 'a', start: 1.2, end: 1.5 },
        { word: 'b', start: 1.6, end: 2.0 },
      ],
      duration: 2.0,
    });
    const leading = gaps.find(g => g.position === 'leading');
    expect(leading).toBeDefined();
    expect(leading.start).toBe(0);
    expect(leading.end).toBeCloseTo(1.2);
  });

  it('detects trailing gap when duration exceeds last word end', () => {
    const gaps = detectGaps({
      words: [
        { word: 'a', start: 0, end: 0.5 },
        { word: 'b', start: 0.6, end: 1.0 },
      ],
      duration: 5.0,
    });
    const trailing = gaps.find(g => g.position === 'trailing');
    expect(trailing).toBeDefined();
    expect(trailing.start).toBeCloseTo(1.0);
    expect(trailing.end).toBe(5.0);
  });

  it('skips words missing start/end timestamps', () => {
    const gaps = detectGaps({
      words: [
        { word: 'a', start: 0, end: 0.5 },
        { word: 'b' },
        { word: 'c', start: 2.0, end: 2.5 },
      ],
      duration: 3.0,
    });
    // a y c son válidas → un único gap interno entre ellas.
    expect(gaps.filter(g => g.position === 'internal')).toHaveLength(1);
  });
});

describe('buildKeepSegments', () => {
  it('returns the full video as a single keep segment when there are no cuts', () => {
    const keeps = buildKeepSegments([], 10);
    expect(keeps).toEqual([
      { start: 0, end: 10, durationOriginal: 10, newStart: 0, newEnd: 10 },
    ]);
  });

  it('shrinks each cut symmetrically by the pad (default 100ms each side)', () => {
    // Corte [2,4] con pad 0.1 → cut efectivo [2.1, 3.9]
    // Keeps esperados: [0, 2.1] y [3.9, 10]
    const keeps = buildKeepSegments([{ start: 2, end: 4 }], 10);
    expect(keeps).toHaveLength(2);
    expect(keeps[0].start).toBe(0);
    expect(keeps[0].end).toBeCloseTo(2.1);
    expect(keeps[1].start).toBeCloseTo(3.9);
    expect(keeps[1].end).toBe(10);
  });

  it('discards cuts that become too small after padding', () => {
    // Corte de 0.15s con pad 0.1 → quedaría 0s (descartado).
    const keeps = buildKeepSegments([{ start: 1, end: 1.15 }], 5);
    expect(keeps).toEqual([
      { start: 0, end: 5, durationOriginal: 5, newStart: 0, newEnd: 5 },
    ]);
  });

  it('sorts cuts regardless of input order', () => {
    const a = buildKeepSegments([{ start: 6, end: 7 }, { start: 2, end: 3 }], 10);
    const b = buildKeepSegments([{ start: 2, end: 3 }, { start: 6, end: 7 }], 10);
    expect(a).toEqual(b);
  });

  it('merges overlapping cuts', () => {
    // Dos cortes solapados [2,4] y [3.5,6] → uno solo [2,6]
    // Con pad efectivos: [2.1, 3.9] y [3.6, 5.9]. Solapan → mergean a [2.1, 5.9]
    const keeps = buildKeepSegments([{ start: 2, end: 4 }, { start: 3.5, end: 6 }], 10);
    expect(keeps).toHaveLength(2);
    expect(keeps[0].end).toBeCloseTo(2.1);
    expect(keeps[1].start).toBeCloseTo(5.9);
  });

  it('a cut anchored at 0 (head trim) is fully exact — zero pad both sides', () => {
    // Recorte de cabeza: "los primeros 5s sobran" → corta exacto 0..5.
    // Razón: el lado izquierdo no tiene nada que proteger; el lado derecho el
    // arranque de la siguiente palabra (whisper preciso a ~10ms, no necesitamos pad).
    const keeps = buildKeepSegments([{ start: 0, end: 5 }], 30);
    expect(keeps).toHaveLength(1);
    expect(keeps[0].start).toBe(5);
    expect(keeps[0].end).toBe(30);
  });

  it('a cut anchored at duration (tail trim) is fully exact — zero pad both sides', () => {
    const keeps = buildKeepSegments([{ start: 25, end: 30 }], 30);
    expect(keeps).toHaveLength(1);
    expect(keeps[0].start).toBe(0);
    expect(keeps[0].end).toBe(25);
  });

  it('handles head + tail + internal cuts together', () => {
    const keeps = buildKeepSegments([
      { start: 0, end: 3 },     // head: anclado a 0, cero pad
      { start: 10, end: 12 },   // internal: pad ambos lados
      { start: 28, end: 30 },   // tail: anclado a duration, cero pad
    ], 30);
    // Internos padded = [10.1, 11.9]; head/tail exactos.
    // Keeps: [3, 10.1], [11.9, 28]. Sin micro-keeps en bordes.
    expect(keeps).toHaveLength(2);
    expect(keeps[0].start).toBe(3);
    expect(keeps[0].end).toBeCloseTo(10.1);
    expect(keeps[1].start).toBeCloseTo(11.9);
    expect(keeps[1].end).toBe(28);
  });

  it('produces continuous newStart/newEnd timestamps for the final timeline', () => {
    const keeps = buildKeepSegments([{ start: 5, end: 7 }], 10);
    // Keep[0] dura 5.1s en original (0→5.1), keep[1] dura 3.1s (6.9→10).
    // En timeline final: [0, 5.1] y [5.1, 8.2].
    expect(keeps[0].newStart).toBe(0);
    expect(keeps[0].newEnd).toBeCloseTo(5.1);
    expect(keeps[1].newStart).toBeCloseTo(5.1);
    expect(keeps[1].newEnd).toBeCloseTo(8.2);
  });

  it('clamps cuts that go beyond totalDuration', () => {
    // Si la UI manda end > duration (puede pasar con trim tail), no debe romper.
    const keeps = buildKeepSegments([{ start: 25, end: 999 }], 30);
    expect(keeps[0].start).toBe(0);
    // end >= duration → cut anclado a borde → cero pad → keep termina exacto en 25.
    expect(keeps[0].end).toBe(25);
    // No hay keep después porque el cut llega al final.
    expect(keeps).toHaveLength(1);
  });
});

describe('remapWords', () => {
  it('drops words that fall inside a cut', () => {
    // Keep segments: [0, 2] y [4, 10] (tras un cut en [2,4]).
    const keeps = [
      { start: 0, end: 2, newStart: 0, newEnd: 2 },
      { start: 4, end: 10, newStart: 2, newEnd: 8 },
    ];
    const words = [
      { word: 'a', start: 0.5, end: 1.0 },   // keep
      { word: 'b', start: 2.5, end: 3.5 },   // dentro del cut → drop
      { word: 'c', start: 5.0, end: 5.5 },   // keep, remapeada
    ];
    const out = remapWords(words, keeps);
    expect(out).toHaveLength(2);
    expect(out[0].word).toBe('a');
    expect(out[1].word).toBe('c');
  });

  it('shifts timestamps by (newStart - start) for each keep segment', () => {
    const keeps = [
      { start: 0, end: 2, newStart: 0, newEnd: 2 },
      { start: 4, end: 10, newStart: 2, newEnd: 8 },
    ];
    const words = [
      { word: 'a', start: 0.5, end: 1.0 },
      { word: 'c', start: 5.0, end: 5.5 },
    ];
    const out = remapWords(words, keeps);
    // 'a' está en seg[0] (offset 0) → mismos timestamps.
    expect(out[0].start).toBeCloseTo(0.5);
    expect(out[0].end).toBeCloseTo(1.0);
    // 'c' está en seg[1] (offset = 2 - 4 = -2) → 5.0→3.0, 5.5→3.5.
    expect(out[1].start).toBeCloseTo(3.0);
    expect(out[1].end).toBeCloseTo(3.5);
  });

  it('tolerates words that touch segment boundaries within ±0.02s', () => {
    const keeps = [{ start: 0, end: 2, newStart: 0, newEnd: 2 }];
    // Palabra que termina justo en 2.01 (1ms más allá del segmento) — debe entrar.
    const out = remapWords([{ word: 'borderline', start: 1.5, end: 2.01 }], keeps);
    expect(out).toHaveLength(1);
  });

  it('skips words missing start/end timestamps', () => {
    const keeps = [{ start: 0, end: 10, newStart: 0, newEnd: 10 }];
    const out = remapWords([{ word: 'broken' }], keeps);
    expect(out).toEqual([]);
  });
});
