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

const RESOLUTION_MAP = {
  '720': { w: 720, h: 1280, fontScale: 0.67 },
  '1080': { w: 1080, h: 1920, fontScale: 1 },
  '2k': { w: 1440, h: 2560, fontScale: 1.33 },
  '4k': { w: 2160, h: 3840, fontScale: 2 },
};

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
    const r = RESOLUTION_MAP[resolution] || RESOLUTION_MAP['1080'];
    const dur = clip.end_seconds - clip.start_seconds;

    // Camera motion: zoom-in / zoom-out / static via zoompan filter
    const fps = 30;
    const totalFrames = Math.ceil(dur * fps);
    let zoomFilter = '';
    if (clip.camera_motion === 'zoom-in') {
      zoomFilter = `,zoompan=z='min(1.0+${(0.08/totalFrames).toFixed(6)}*on,1.08)':d=1:s=${r.w}x${r.h}:fps=${fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    } else if (clip.camera_motion === 'zoom-out') {
      zoomFilter = `,zoompan=z='max(1.08-${(0.08/totalFrames).toFixed(6)}*on,1.0)':d=1:s=${r.w}x${r.h}:fps=${fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    }

    // ASS subtitles filter — escape colon and backslash in path for ffmpeg filtergraph
    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const fontsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/fonts');
    const fontsArg = fs.existsSync(fontsDir) ? `:fontsdir='${fontsDir.replace(/:/g, '\\:')}'` : '';

    const vf = `crop=ih*9/16:ih,scale=${r.w}:${r.h}${zoomFilter},subtitles='${escapedAss}'${fontsArg}`;

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
