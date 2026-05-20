import { describe, it, expect } from 'vitest';
import { describeFfmpegError, buildCropExpr } from './videoProcessor.js';

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

describe('buildCropExpr', () => {
  it('9:16 con 50% (default centro) coincide con el comportamiento histórico', () => {
    // El crop antiguo era 'crop=ih*9/16:ih' (sin x/y → ffmpeg centra solo).
    // El nuevo, con 50%, debe dejar la cara centrada de forma equivalente.
    const expr = buildCropExpr('9:16', 50);
    expect(expr).toBe('crop=ih*9/16:ih:(iw-ih*9/16)*0.5000:0');
  });

  it('9:16 con 0% pega el recorte al borde izquierdo', () => {
    expect(buildCropExpr('9:16', 0)).toBe('crop=ih*9/16:ih:(iw-ih*9/16)*0.0000:0');
  });

  it('9:16 con 100% pega el recorte al borde derecho', () => {
    expect(buildCropExpr('9:16', 100)).toBe('crop=ih*9/16:ih:(iw-ih*9/16)*1.0000:0');
  });

  it('soporta valores intermedios para ajuste fino', () => {
    expect(buildCropExpr('9:16', 33)).toBe('crop=ih*9/16:ih:(iw-ih*9/16)*0.3300:0');
  });

  it('cambia el ancho según aspect ratio', () => {
    expect(buildCropExpr('1:1', 50)).toBe('crop=ih:ih:(iw-ih)*0.5000:0');
    expect(buildCropExpr('4:5', 50)).toBe('crop=ih*4/5:ih:(iw-ih*4/5)*0.5000:0');
  });

  it('clampea valores fuera de rango', () => {
    expect(buildCropExpr('9:16', -20)).toMatch(/\*0\.0000:0$/);
    expect(buildCropExpr('9:16', 250)).toMatch(/\*1\.0000:0$/);
  });

  it('default a 50% cuando crop_x_pct es null/undefined/NaN', () => {
    expect(buildCropExpr('9:16')).toMatch(/\*0\.5000:0$/);
    expect(buildCropExpr('9:16', null)).toMatch(/\*0\.5000:0$/);
    expect(buildCropExpr('9:16', NaN)).toMatch(/\*0\.5000:0$/);
    expect(buildCropExpr('9:16', 'foo')).toMatch(/\*0\.5000:0$/);
  });

  it('aspect ratio desconocido cae a 9:16', () => {
    expect(buildCropExpr('xyz', 50)).toMatch(/^crop=ih\*9\/16:ih:/);
  });
});
