import { describe, it, expect } from 'vitest';
import { describeFfmpegError } from './videoProcessor.js';

describe('describeFfmpegError', () => {
  it('detecta moov atom faltante y devuelve mensaje accionable', () => {
    const stderr = '[mov,mp4,m4a,3gp,3g2,mj2 @ 0x123] moov atom not found\n/tmp/x.mp4: Invalid data found when processing input';
    const msg = describeFfmpegError(stderr);
    expect(msg).toMatch(/dañado/);
    expect(msg).toMatch(/moov/);
    expect(msg).toMatch(/reexporte|untrunc|restore/);
  });

  it('detecta invalid data sin moov específico', () => {
    expect(describeFfmpegError('Invalid data found when processing input')).toMatch(/video válido/);
  });

  it('detecta archivo faltante', () => {
    expect(describeFfmpegError('foo.mp4: No such file or directory')).toMatch(/no se encontró/i);
  });

  it('devuelve null para errores no reconocidos', () => {
    expect(describeFfmpegError('Some random ffmpeg error blah blah')).toBeNull();
  });

  it('prioriza moov sobre invalid data (ambos suelen aparecer juntos)', () => {
    const stderr = 'moov atom not found\nInvalid data found when processing input';
    expect(describeFfmpegError(stderr)).toMatch(/moov/);
  });
});
