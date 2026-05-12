// Detección de cookies.txt para yt-dlp. Algunos videos de Facebook requieren
// cookies de sesión para que yt-dlp pueda parsear el manifest de reproducción
// (errores tipo "Cannot parse data"). En Render se sube el archivo como Secret
// File y se monta en /etc/secrets/<nombre>. Override por env FB_COOKIES_PATH.
import fs from 'fs';
import os from 'os';
import path from 'path';

// yt-dlp reescribe el cookies file después de usarlo (refresh tokens, nuevas
// cookies). /etc/secrets/ en Render es read-only → falla con OSError 30.
// Copiamos el source a una ruta escribible (/tmp) en el primer uso y
// devolvemos esa copia. Solo recopiamos si el source es más nuevo que la copia.
function ensureWritableCopy(sourcePath) {
  try {
    const writableDir = os.tmpdir();
    const writablePath = path.join(writableDir, `ytdlp-${path.basename(sourcePath)}`);
    const srcStat = fs.statSync(sourcePath);
    let needsCopy = true;
    if (fs.existsSync(writablePath)) {
      const dstStat = fs.statSync(writablePath);
      if (dstStat.mtimeMs >= srcStat.mtimeMs) needsCopy = false;
    }
    if (needsCopy) {
      fs.copyFileSync(sourcePath, writablePath);
      fs.chmodSync(writablePath, 0o600);
    }
    return writablePath;
  } catch (err) {
    console.warn(`[ytdlpCookies] no se pudo copiar ${sourcePath} a ruta escribible: ${err.message}`);
    return sourcePath; // último recurso: usar el original (puede fallar en write)
  }
}

export function getFacebookCookiesPath() {
  if (process.env.FB_COOKIES_PATH && fs.existsSync(process.env.FB_COOKIES_PATH)) {
    return ensureWritableCopy(process.env.FB_COOKIES_PATH);
  }
  const candidates = [
    '/etc/secrets/www.facebook.com_cookies.txt',
    '/etc/secrets/fb-cookies.txt',
    '/etc/secrets/cookies.txt',
    '/app/config/fb-cookies.txt',
    '/app/config/cookies.txt',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return ensureWritableCopy(p);
  }
  return null;
}

export function isFacebookUrl(url) {
  return /(?:^|\/\/)(?:www\.|m\.|web\.|business\.)?facebook\.com\//i.test(url)
    || /(?:^|\/\/)fb\.watch\//i.test(url);
}

// Si la url es de Facebook y existe un cookies.txt, devuelve ['--cookies', path].
// Si no, devuelve [] para inserción inocua en args de yt-dlp.
export function facebookCookiesArgs(url) {
  if (!isFacebookUrl(url)) return [];
  const p = getFacebookCookiesPath();
  return p ? ['--cookies', p] : [];
}
