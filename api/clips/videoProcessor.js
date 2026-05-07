// api/clips/videoProcessor.js
// Pipeline ffmpeg por clip: cut → crop 9:16 → ken-burns zoom → burn-in subs ASS.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export function downloadVideoToPath(url, outputPath) {
  return new Promise((resolve, reject) => {
    const ytDlp = process.env.YTDLP_PATH || 'yt-dlp';
    const args = [
      '-f', 'bv*[height<=1080]+ba/b[height<=1080]',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist',
      url,
    ];
    if (process.env.FFMPEG_PATH) args.splice(args.length - 1, 0, '--ffmpeg-location', process.env.FFMPEG_PATH);
    const p = spawn(ytDlp, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(-500)}`));
    });
    p.on('error', reject);
  });
}

export function getVideoMetadata(url) {
  return new Promise((resolve) => {
    const ytDlp = process.env.YTDLP_PATH || 'yt-dlp';
    const p = spawn(ytDlp, ['--dump-json', '--no-check-certificate', url]);
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

export function extractAudioFromVideo(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const p = spawn(ffmpeg, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audioPath]);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0) resolve(audioPath);
      else reject(new Error(`ffmpeg audio extract exit ${code}: ${stderr.slice(-500)}`));
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

/**
 * Renderiza un clip individual.
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

    // Crop expression según aspect ratio: tomamos del centro la proporción correcta.
    // Para 9:16 vertical desde 16:9 fuente: crop=ih*9/16:ih (recorta laterales).
    // Para 1:1 cuadrado: crop=ih:ih (centro cuadrado).
    // Para 4:5: crop=ih*4/5:ih (cuadrado ligeramente alto).
    let cropExpr;
    if (aspect === '9:16') cropExpr = 'crop=ih*9/16:ih';
    else if (aspect === '1:1') cropExpr = 'crop=ih:ih';
    else if (aspect === '4:5') cropExpr = 'crop=ih*4/5:ih';
    else cropExpr = 'crop=ih*9/16:ih';

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
