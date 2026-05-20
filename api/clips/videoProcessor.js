// api/clips/videoProcessor.js
// Pipeline ffmpeg por clip: cut → crop 9:16 → ken-burns zoom → burn-in subs ASS.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { facebookCookiesArgs } from '../utils/ytdlpCookies.js';

// Una sola corrida de yt-dlp. Resuelve con outputPath o rechaza con el stderr.
function _downloadOnce(url, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const ytDlp = process.env.YTDLP_PATH || 'yt-dlp';
    // Format selector con fallback chain:
    // 1) Stream de video ≤1080p + mejor audio
    // 2) Mejor combinado ≤1080p
    // 3) "best" sin filtros (último recurso para extractores que no exponen height/formato esperado,
    //    p.ej. algunos videos de Facebook con "Cannot parse data" en yt-dlp).
    const args = [
      '-f', 'bv*[height<=1080]+ba/b[height<=1080]/best',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist',
      '--newline', // fuerza una línea por update de progreso (más fácil de parsear)
      url,
    ];
    if (process.env.FFMPEG_PATH) args.splice(args.length - 1, 0, '--ffmpeg-location', process.env.FFMPEG_PATH);
    const cookieArgs = facebookCookiesArgs(url);
    if (cookieArgs.length) args.splice(args.length - 1, 0, ...cookieArgs);
    const p = spawn(ytDlp, args);
    let stderr = '';
    let lastReportedPct = -10; // reportar cada 10% para no spammear

    const parseProgress = (text) => {
      // yt-dlp formato: "[download]  23.5% of  150.00MiB at 3.20MiB/s ETA 00:30"
      const m = text.match(/\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\w+)/);
      if (m && onProgress) {
        const pct = parseFloat(m[1]);
        if (pct - lastReportedPct >= 10 || pct >= 99) {
          lastReportedPct = pct;
          onProgress({ pct, size: m[2] });
        }
      }
    };

    // yt-dlp puede enviar progreso a stdout o stderr según versión — escuchar ambos
    p.stdout.on('data', d => parseProgress(d.toString()));
    p.stderr.on('data', d => {
      const text = d.toString();
      stderr += text;
      parseProgress(text);
    });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(-500)}`));
    });
    p.on('error', reject);
  });
}

// Descarga con retry automático. Algunos extractores (notable: Facebook) fallan en la
// primera petición con "Cannot parse data" pero la siguiente petición funciona — patrón
// reproducible que el usuario verifica empíricamente. Costo bajo (2s extra en peor caso).
// Si el outputPath quedó parcial tras fallar, se borra antes del retry para evitar conflictos.
export async function downloadVideoToPath(url, outputPath, onProgress, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 2000;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await _downloadOnce(url, outputPath, onProgress);
    } catch (err) {
      lastErr = err;
      // Limpia archivo parcial si quedó
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
      if (attempt < maxAttempts) {
        console.warn(`[videoProcessor] yt-dlp intento ${attempt}/${maxAttempts} falló, reintentando en ${retryDelayMs}ms…`);
        await new Promise(r => setTimeout(r, retryDelayMs));
      }
    }
  }
  throw lastErr;
}

export function getVideoMetadata(url) {
  return new Promise((resolve) => {
    const ytDlp = process.env.YTDLP_PATH || 'yt-dlp';
    const metaArgs = ['--dump-json', '--no-check-certificate', ...facebookCookiesArgs(url), url];
    const p = spawn(ytDlp, metaArgs);
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', () => {
      try {
        const info = JSON.parse(out);
        resolve({
          title: info.title || 'Sin título',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || null,
          width: info.width || 0,
          height: info.height || 0,
        });
      } catch {
        resolve({ title: 'Sin título', duration: 0, thumbnail: null, width: 0, height: 0 });
      }
    });
    p.on('error', () => resolve({ title: 'Sin título', duration: 0, thumbnail: null, width: 0, height: 0 }));
  });
}

// Traduce errores comunes de ffmpeg a mensajes que el usuario pueda entender.
// Devuelve null si no reconoce el error (el caller usa el stderr crudo).
export function describeFfmpegError(stderr) {
  if (/moov atom not found/i.test(stderr)) {
    return 'Este archivo de video está dañado: le falta la tabla de índices interna (moov atom). Suele pasar cuando la grabación se cortó antes de cerrarse (apagón, app que crasheó, descarga incompleta). Pedile a quien te lo envió que lo reexporte desde el dispositivo original, o intentá repararlo con una herramienta como "untrunc" o restore.media antes de volver a subirlo.';
  }
  if (/Invalid data found when processing input/i.test(stderr)) {
    return 'El archivo no parece ser un video válido. Verificá que sea un MP4, MOV, MKV o WEBM real y no esté corrupto.';
  }
  if (/No such file or directory/i.test(stderr)) {
    return 'No se encontró el archivo del video en el servidor. Volvé a subirlo.';
  }
  return null;
}

export function extractAudioFromVideo(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const p = spawn(ffmpeg, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audioPath]);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0) return resolve(audioPath);
      const friendly = describeFfmpegError(stderr);
      reject(new Error(friendly || `ffmpeg audio extract exit ${code}: ${stderr.slice(-500)}`));
    });
    p.on('error', reject);
  });
}

// Resoluciones definidas en formato 9:16. Para 1:1 y 4:5 escalamos proporcionalmente.
const RESOLUTION_MAP = {
  '720': { base: 720 },
  '1080': { base: 1080 },
  '2k': { base: 1440 },
  '4k': { base: 2160 },
};

// Aspect ratios soportados (width:height). El height se calcula desde base*ratio.
const ASPECT_RATIOS = {
  '9:16': { wRatio: 9, hRatio: 16 },
  '1:1': { wRatio: 1, hRatio: 1 },
  '4:5': { wRatio: 4, hRatio: 5 },
};

function getOutputDimensions(resolution, aspectRatio) {
  const r = RESOLUTION_MAP[resolution] || RESOLUTION_MAP['1080'];
  const a = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['9:16'];
  // base = ancho. Calcular height manteniendo proporción.
  const w = r.base;
  const h = Math.round((w * a.hRatio) / a.wRatio);
  return { w, h: h % 2 === 0 ? h : h + 1 }; // h2v requiere par
}

// Construye la expresión `crop=...` de ffmpeg para un aspect determinado y un porcentaje
// horizontal del recorte sobre la fuente. cropXPct: 0=borde izq, 50=centro (default), 100=borde der.
// Útil para fuentes con dos personas lado a lado: el centro cae en el espacio entre ambas.
// Aplica solo si la fuente es más ancha que el crop (caso típico: 16:9 → 9:16). Si la fuente
// es vertical o el crop coincide con su ancho, el offset queda 0 y no afecta.
// Exportada para poder testearla en aislamiento (función pura).
export function buildCropExpr(aspectRatio, cropXPct = 50) {
  let widthExpr;
  if (aspectRatio === '1:1') widthExpr = 'ih';
  else if (aspectRatio === '4:5') widthExpr = 'ih*4/5';
  else widthExpr = 'ih*9/16'; // 9:16 default
  // null/undefined → default centro. Number(null) === 0 (no NaN), por eso el chequeo explícito.
  const raw = cropXPct === null || cropXPct === undefined ? 50 : Number(cropXPct);
  const pct = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 50)) / 100;
  const xExpr = `(iw-${widthExpr})*${pct.toFixed(4)}`;
  return `crop=${widthExpr}:ih:${xExpr}:0`;
}

// Hash de los parámetros que afectan al base.mp4 (cut + crop + zoom + transition). Si cambian → regenerar base.
export function baseParamsHash(clip, resolution) {
  const h = [
    clip.start_seconds, clip.end_seconds,
    clip.aspect_ratio || '9:16',
    clip.camera_motion || 'zoom-in',
    clip.transition || 'none',
    clip.crop_x_pct ?? 50,
    resolution,
  ].join('|');
  return Buffer.from(h).toString('base64').slice(0, 16);
}

// Construye los filtros de transición (fade in/out, zoom in/out en bordes) según clip.transition.
// El zoom de transición es DISTINTO del camera_motion: el motion es lento y abarca todo el clip;
// la transición es un "punch" en los primeros/últimos 0.5s.
function transitionFilters(clip) {
  const t = clip.transition || 'none';
  const dur = clip.end_seconds - clip.start_seconds;
  const fadeDur = 0.5;
  const fadeOutSt = Math.max(0, dur - fadeDur);
  const filters = [];

  if (t === 'fade-in' || t === 'fade-cross') {
    filters.push(`fade=t=in:st=0:d=${fadeDur}`);
  }
  if (t === 'fade-out' || t === 'fade-cross') {
    filters.push(`fade=t=out:st=${fadeOutSt.toFixed(3)}:d=${fadeDur}`);
  }
  return filters;
}

/**
 * Renderiza el base.mp4 SIN subtítulos: cut + crop al aspect ratio + zoompan.
 * Es el "video base" que se usa como capa de fondo en el preview con overlay HTML
 * y como input para burn-in en el export final.
 */
export function renderClipBase({ sourceVideo, clip, outputPath, resolution = '1080' }) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const aspect = clip.aspect_ratio || '9:16';
    const { w, h } = getOutputDimensions(resolution, aspect);
    const dur = clip.end_seconds - clip.start_seconds;

    const cropExpr = buildCropExpr(aspect, clip.crop_x_pct ?? 50);

    const fps = 30;
    const totalFrames = Math.ceil(dur * fps);
    const transitionFrames = Math.min(15, Math.floor(totalFrames / 4)); // 0.5s @ 30fps o 25% del clip si es muy corto
    const t = clip.transition || 'none';
    const isZoomTrans = t === 'zoom-in' || t === 'zoom-out' || t === 'zoom-cross';

    // Componemos UNA sola expresión de zoom que cubre camera_motion + transition.
    // Si la transición es zoom-*, su efecto en los bordes pisa al camera_motion en esos frames.
    let zoomExpr;
    if (isZoomTrans) {
      const exitStart = totalFrames - transitionFrames;
      const motionExpr = clip.camera_motion === 'zoom-in'
        ? `min(1.0+${(0.08/totalFrames).toFixed(6)}*on,1.08)`
        : clip.camera_motion === 'zoom-out'
          ? `max(1.08-${(0.08/totalFrames).toFixed(6)}*on,1.0)`
          : '1.0';
      const entryExpr = `(1.3-(on/${transitionFrames})*0.3)`;          // 1.3 → 1.0 en transitionFrames
      const exitExpr  = `(1.0+((on-${exitStart})/${transitionFrames})*0.3)`; // 1.0 → 1.3 en transitionFrames

      if (t === 'zoom-in') {
        zoomExpr = `if(lt(on,${transitionFrames}),${entryExpr},${motionExpr})`;
      } else if (t === 'zoom-out') {
        zoomExpr = `if(gt(on,${exitStart}),${exitExpr},${motionExpr})`;
      } else { // zoom-cross
        zoomExpr = `if(lt(on,${transitionFrames}),${entryExpr},if(gt(on,${exitStart}),${exitExpr},${motionExpr}))`;
      }
    } else if (clip.camera_motion === 'zoom-in') {
      zoomExpr = `min(1.0+${(0.08/totalFrames).toFixed(6)}*on,1.08)`;
    } else if (clip.camera_motion === 'zoom-out') {
      zoomExpr = `max(1.08-${(0.08/totalFrames).toFixed(6)}*on,1.0)`;
    } else {
      zoomExpr = null;
    }

    const zoomFilter = zoomExpr
      ? `,zoompan=z='${zoomExpr}':d=1:s=${w}x${h}:fps=${fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`
      : '';

    const fades = transitionFilters(clip);
    const fadeChain = fades.length ? ',' + fades.join(',') : '';

    const vf = `${cropExpr},scale=${w}:${h}${zoomFilter}${fadeChain}`;

    const args = [
      '-y',
      '-ss', String(clip.start_seconds),
      '-i', sourceVideo,
      '-t', String(dur),
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ];

    const p = spawn(ffmpeg, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`ffmpeg base render exit ${code}: ${stderr.slice(-1000)}`));
    });
    p.on('error', reject);
  });
}

/**
 * Burn-in rápido: toma el base.mp4 (ya cropeado, escalado, con zoom) y le quema el .ass encima.
 * Mucho más rápido que renderClip porque no recodifica el filtro complejo, solo subtitles + reencode.
 */
export function burnSubtitlesOnBase({ baseVideo, assPath, outputPath }) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const fontsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/fonts');
    const fontsArg = fs.existsSync(fontsDir) ? `:fontsdir='${fontsDir.replace(/:/g, '\\:')}'` : '';
    const vf = `subtitles='${escapedAss}'${fontsArg}`;

    const args = [
      '-y',
      '-i', baseVideo,
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ];

    const p = spawn(ffmpeg, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`ffmpeg burn exit ${code}: ${stderr.slice(-1000)}`));
    });
    p.on('error', reject);
  });
}

/**
 * Renderiza un clip individual (legacy/burned). Mantenido para compatibilidad.
 * Hace cut + crop + zoom + burn-in subs en una sola pasada.
 * @param {object} opts
 * @param {string} opts.sourceVideo — ruta al video fuente
 * @param {object} opts.clip — fila de clips de DB
 * @param {string} opts.assPath — ruta al .ass generado
 * @param {string} opts.outputPath — destino .mp4
 * @param {string} opts.resolution — '720' | '1080' | '2k' | '4k'
 */
export function renderClip({ sourceVideo, clip, assPath, outputPath, resolution = '1080' }) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const aspect = clip.aspect_ratio || '9:16';
    const { w, h } = getOutputDimensions(resolution, aspect);
    const dur = clip.end_seconds - clip.start_seconds;

    // Crop expression según aspect ratio. El offset horizontal viene de clip.crop_x_pct
    // (0=izq, 50=centro/default, 100=der) — clave para fuentes con dos personas lado a lado.
    const cropExpr = buildCropExpr(aspect, clip.crop_x_pct ?? 50);

    // Camera motion: zoom-in / zoom-out / static via zoompan filter
    const fps = 30;
    const totalFrames = Math.ceil(dur * fps);
    let zoomFilter = '';
    if (clip.camera_motion === 'zoom-in') {
      zoomFilter = `,zoompan=z='min(1.0+${(0.08/totalFrames).toFixed(6)}*on,1.08)':d=1:s=${w}x${h}:fps=${fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    } else if (clip.camera_motion === 'zoom-out') {
      zoomFilter = `,zoompan=z='max(1.08-${(0.08/totalFrames).toFixed(6)}*on,1.0)':d=1:s=${w}x${h}:fps=${fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    }

    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const fontsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/fonts');
    const fontsArg = fs.existsSync(fontsDir) ? `:fontsdir='${fontsDir.replace(/:/g, '\\:')}'` : '';

    const vf = `${cropExpr},scale=${w}:${h}${zoomFilter},subtitles='${escapedAss}'${fontsArg}`;

    const args = [
      '-y',
      '-ss', String(clip.start_seconds),
      '-i', sourceVideo,
      '-t', String(dur),
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ];

    const p = spawn(ffmpeg, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`ffmpeg render exit ${code}: ${stderr.slice(-1000)}`));
    });
    p.on('error', reject);
  });
}
