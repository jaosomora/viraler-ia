// api/downloadVideo.js
import { spawn } from 'child_process';
import { detectPlatform } from './utils/platformDetector.js';
import { facebookCookiesArgs } from './utils/ytdlpCookies.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAX_DURATION_SECONDS = 60 * 60; // 60 minutos

const getCookieArgs = () => {
  if (process.env.INSTAGRAM_COOKIES_FILE && fs.existsSync(process.env.INSTAGRAM_COOKIES_FILE)) {
    return ['--cookies', process.env.INSTAGRAM_COOKIES_FILE];
  }
  const cookiePaths = [
    path.join(__dirname, '../config/instagram_cookies.txt'),
    '/app/config/instagram_cookies.txt',
    path.join(process.cwd(), 'config/instagram_cookies.txt')
  ];
  for (const cookiePath of cookiePaths) {
    if (fs.existsSync(cookiePath)) {
      return ['--cookies', cookiePath];
    }
  }
  return [];
};

const sanitizeFilename = (name) => {
  return (name || 'video')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'video';
};

const getVideoInfo = (url, platform) => new Promise((resolve, reject) => {
  const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
  const args = ['--dump-json', '--no-warnings', '--no-check-certificate', '--no-playlist'];
  if (platform === 'instagram') {
    const cookieArgs = getCookieArgs();
    if (cookieArgs.length > 0) args.push(...cookieArgs);
  }
  if (platform === 'facebook') {
    args.push(...facebookCookiesArgs(url));
  }
  args.push(
    '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    url
  );

  const p = spawn(ytDlpPath, args);
  let out = '';
  let err = '';
  p.stdout.on('data', (d) => { out += d.toString(); });
  p.stderr.on('data', (d) => { err += d.toString(); });
  p.on('close', (code) => {
    if (code !== 0) return reject(new Error(`No se pudo obtener información del video: ${err || 'error desconocido'}`));
    try {
      const info = JSON.parse(out);
      resolve(info);
    } catch (e) {
      reject(new Error('No se pudo parsear la información del video'));
    }
  });
  p.on('error', (e) => reject(new Error(`Error al ejecutar yt-dlp: ${e.message}`)));
});

export default async function downloadVideo(req, res) {
  let tempPath = null;
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL requerida' });
    }

    const platform = detectPlatform(url);
    if (platform === 'unknown') {
      return res.status(400).json({ error: 'URL no soportada' });
    }

    // Validar duración antes de descargar
    const info = await getVideoInfo(url, platform);
    const duration = Number(info.duration) || 0;
    if (duration > MAX_DURATION_SECONDS) {
      const mins = Math.ceil(duration / 60);
      return res.status(400).json({
        error: `El video dura ${mins} min. Máximo permitido: 60 min.`
      });
    }

    const tempDir = os.tmpdir();
    const baseName = `video-${Date.now()}`;
    tempPath = path.join(tempDir, `${baseName}.mp4`);

    const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    const args = [
      '-f', 'bv*+ba/b',
      '--merge-output-format', 'mp4',
      '--output', tempPath,
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist'
    ];

    if (process.env.FFMPEG_PATH) {
      args.push('--ffmpeg-location', process.env.FFMPEG_PATH);
    }

    if (platform === 'instagram') {
      const cookieArgs = getCookieArgs();
      if (cookieArgs.length > 0) args.push(...cookieArgs);
    }
    if (platform === 'facebook') {
      args.push(...facebookCookiesArgs(url));
    }

    args.push(
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    if (platform === 'instagram' || platform === 'tiktok' || platform === 'facebook') {
      args.push(
        '--add-header', 'Accept-Language:es-ES,es;q=0.9,en;q=0.8',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      );
    }

    args.push(url);

    await new Promise((resolve, reject) => {
      const p = spawn(ytDlpPath, args);
      let stderrData = '';
      p.stderr.on('data', (d) => { stderrData += d.toString(); console.error(`yt-dlp stderr: ${d}`); });
      p.stdout.on('data', (d) => { console.log(`yt-dlp stdout: ${d}`); });
      p.on('close', (code) => {
        if (code !== 0) return reject(new Error(stderrData || 'Error al descargar video'));
        if (!fs.existsSync(tempPath)) return reject(new Error('Archivo de video no generado'));
        resolve();
      });
      p.on('error', (e) => reject(e));
    });

    const filename = `${sanitizeFilename(info.title)}.mp4`;
    res.download(tempPath, filename, (err) => {
      // Limpieza siempre
      try { if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      if (err) console.error('Error al enviar archivo:', err);
    });
  } catch (error) {
    console.error('Error en downloadVideo:', error);
    try { if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Error al descargar el video' });
    }
  }
}
