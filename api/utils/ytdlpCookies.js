// Detección de cookies.txt para yt-dlp. Algunos videos de Facebook requieren
// cookies de sesión para que yt-dlp pueda parsear el manifest de reproducción
// (errores tipo "Cannot parse data"). En Render se sube el archivo como Secret
// File y se monta en /etc/secrets/<nombre>. Override por env FB_COOKIES_PATH.
import fs from 'fs';

export function getFacebookCookiesPath() {
  if (process.env.FB_COOKIES_PATH && fs.existsSync(process.env.FB_COOKIES_PATH)) {
    return process.env.FB_COOKIES_PATH;
  }
  const candidates = [
    '/etc/secrets/www.facebook.com_cookies.txt',
    '/etc/secrets/fb-cookies.txt',
    '/etc/secrets/cookies.txt',
    '/app/config/fb-cookies.txt',
    '/app/config/cookies.txt',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
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
