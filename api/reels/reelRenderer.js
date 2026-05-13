// api/reels/reelRenderer.js
// Pipeline ffmpeg para Reels Cleaner en DOS pasadas (modelo Clips: base + burn-in):
//   1) renderReelBase: cuts + concat + crop 9:16 + scale → base.mp4 SIN subs.
//      Pasada cara, una sola vez tras aprobar silencios.
//   2) burnSubsOnBase: toma base.mp4 + ASS y quema subs encima → final.mp4.
//      Pasada barata, re-ejecutable cuando el usuario cambia fuente/color/texto.
//
// renderReel (legacy, una sola pasada) se mantiene por compatibilidad de imports antiguos.

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUTPUT_W = 1080;
const OUTPUT_H = 1920; // 9:16

function runFfmpeg(args, errLabel) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const p = spawn(ffmpeg, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${errLabel} exit ${code}: ${stderr.slice(-1500)}`));
    });
    p.on('error', reject);
  });
}

/**
 * Pass 1: cuts + concat + crop 9:16 + scale. Sin subs.
 *
 * Rotación: ffmpeg autorrota por defecto al decodificar y entrega frames ya
 * orientados al filter graph (los píxeles salen bien). PERO cuando hay múltiples
 * segmentos vía concat, el `displaymatrix` side_data del input se cuela al output
 * y el navegador lo rota OTRA VEZ → video sideways en el player.
 *
 * Fix: tras el render, re-mux `-c copy -display_rotation:v 0` para reescribir el
 * contenedor sin esa metadata. Es prácticamente gratis (no re-encodea), <1s.
 */
export async function renderReelBase({ sourceVideo, keepSegments, outputPath }) {
  if (!keepSegments || keepSegments.length === 0) {
    throw new Error('No hay segmentos para renderizar (todo está marcado para cortar)');
  }

  const parts = [];
  const concatInputs = [];
  keepSegments.forEach((seg, i) => {
    const s = seg.start.toFixed(3);
    const e = seg.end.toFixed(3);
    parts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
    concatInputs.push(`[v${i}][a${i}]`);
  });
  const n = keepSegments.length;
  parts.push(`${concatInputs.join('')}concat=n=${n}:v=1:a=1[vc][ac]`);
  parts.push(`[vc]crop='min(iw,ih*9/16)':'ih':'(iw-min(iw,ih*9/16))/2':0,scale=${OUTPUT_W}:${OUTPUT_H},setsar=1[vo]`);

  const tmpPath = outputPath.replace(/\.mp4$/, '.tmp.mp4');

  // Pass 1: render con cuts + crop a tmp.
  await runFfmpeg([
    '-y',
    '-i', sourceVideo,
    '-filter_complex', parts.join(';'),
    '-map', '[vo]', '-map', '[ac]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    tmpPath,
  ], 'reel base render');

  // Pass 2: re-mux barato para limpiar el displaymatrix side_data heredado del concat.
  await runFfmpeg([
    '-y',
    '-display_rotation:v', '0',
    '-i', tmpPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ], 'reel base remux');

  try { fs.unlinkSync(tmpPath); } catch {}

  if (!fs.existsSync(outputPath)) throw new Error('renderReelBase: output no existe tras remux');
  return outputPath;
}

/**
 * Pass 2: quema un .ass sobre el base.mp4. Mucho más rápido que renderReelBase.
 */
export function burnSubsOnBase({ baseVideo, assPath, outputPath }) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const fontsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/fonts');
    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const fontsArg = fs.existsSync(fontsDir)
      ? `:fontsdir='${fontsDir.replace(/:/g, '\\:')}'`
      : '';
    const vf = `subtitles='${escapedAss}'${fontsArg}`;

    const args = [
      '-y',
      '-i', baseVideo,
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ];

    const p = spawn(ffmpeg, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`ffmpeg reel burn exit ${code}: ${stderr.slice(-1500)}`));
    });
    p.on('error', reject);
  });
}

/**
 * @deprecated Combinación legacy de las dos pasadas. Prefiere base + burn por separado.
 */
export function renderReel({ sourceVideo, keepSegments, assPath, outputPath }) {
  return new Promise((resolve, reject) => {
    const tmpBase = outputPath.replace(/\.mp4$/, '.base.mp4');
    renderReelBase({ sourceVideo, keepSegments, outputPath: tmpBase })
      .then(() => {
        if (!assPath) { fs.renameSync(tmpBase, outputPath); return outputPath; }
        return burnSubsOnBase({ baseVideo: tmpBase, assPath, outputPath })
          .then(() => { try { fs.unlinkSync(tmpBase); } catch {} return outputPath; });
      })
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Duración real con ffprobe.
 */
export function probeDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
    const p = spawn(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ]);
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', code => {
      if (code === 0) {
        const dur = parseFloat(out.trim());
        if (isNaN(dur)) reject(new Error('ffprobe no devolvió duración'));
        else resolve(dur);
      } else {
        reject(new Error(`ffprobe exit ${code}`));
      }
    });
    p.on('error', reject);
  });
}
