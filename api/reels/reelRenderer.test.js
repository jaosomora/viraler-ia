// Tests para buildVoiceAudioFilter — la lógica pura del procesamiento de voz.
// Capturamos el comportamiento esperado para que cualquier cambio futuro lo rompa explícitamente.

import { describe, it, expect } from 'vitest';
import { buildVoiceAudioFilter } from './reelRenderer.js';

describe('buildVoiceAudioFilter', () => {
  it('returns null when autolevel=false and gainDb=0 (passthrough)', () => {
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: 0 })).toBeNull();
  });

  it('returns null when called with no args', () => {
    expect(buildVoiceAudioFilter()).toBeNull();
  });

  it('only applies loudnorm when autolevel=true and gainDb=0', () => {
    expect(buildVoiceAudioFilter({ autolevel: true, gainDb: 0 }))
      .toBe('loudnorm=I=-16:TP=-1.5:LRA=11');
  });

  it('only applies volume when autolevel=false and gain non-zero', () => {
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: 6 })).toBe('volume=+6dB');
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: -3 })).toBe('volume=-3dB');
  });

  it('chains loudnorm + volume when both active (loudnorm first)', () => {
    // loudnorm tiene que ir antes para que el ajuste fino quede sobre el resultado nivelado.
    expect(buildVoiceAudioFilter({ autolevel: true, gainDb: 6 }))
      .toBe('loudnorm=I=-16:TP=-1.5:LRA=11,volume=+6dB');
  });

  it('uses + sign for positive gain and - for negative', () => {
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: 12 })).toContain('+12dB');
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: -6 })).toContain('-6dB');
  });

  it('clamps gain to [-12, 18] dB', () => {
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: 99 })).toBe('volume=+18dB');
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: -99 })).toBe('volume=-12dB');
  });

  it('treats non-numeric gain as 0 (passthrough if autolevel=false)', () => {
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: NaN })).toBeNull();
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: 'abc' })).toBeNull();
    expect(buildVoiceAudioFilter({ autolevel: false, gainDb: null })).toBeNull();
  });

  it('treats truthy autolevel values as true', () => {
    expect(buildVoiceAudioFilter({ autolevel: 1, gainDb: 0 }))
      .toBe('loudnorm=I=-16:TP=-1.5:LRA=11');
  });
});
