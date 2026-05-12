// api/reels/jamendoService.js
// Cliente del Jamendo Music API v3.0 — devuelve tracks Creative Commons listos para
// streaming/descarga. Requiere JAMENDO_CLIENT_ID en .env (registro gratis en
// devportal.jamendo.com).
//
// Mapeamos los "vibe tags" de Jamendo + acotamos por instrumentación cuando hace falta.
// Solo traemos tracks instrumentales (sin voz) — para no chocar con la voz del reel.

const JAMENDO_BASE = 'https://api.jamendo.com/v3.0';
const PAGE_LIMIT = 20;

function clientId() {
  const k = process.env.JAMENDO_CLIENT_ID;
  if (!k) throw new Error('JAMENDO_CLIENT_ID no configurada. Regístrate en devportal.jamendo.com y agrega el client_id a .env.');
  return k;
}

/**
 * Busca tracks en Jamendo. Filtros usados:
 *  - vocalinstrumental=instrumental  → sin voz (no choca con tu narración)
 *  - audioformat=mp32                → MP3 320kbps (calidad alta)
 *  - tags=...                        → tags de mood/genre (separados por +)
 *  - speed (vslow/slow/medium/high/vhigh) → energía
 *  - order=popularity_total          → primero los populares
 *
 * Devuelve array normalizado [{external_id, name, artist, duration, audio_url, preview_url, thumbnail, license_url, bpm, source_tags}]
 */
export async function searchJamendo({ tags = [], speed, limit = PAGE_LIMIT, offset = 0 } = {}) {
  const params = new URLSearchParams({
    client_id: clientId(),
    format: 'json',
    limit: String(limit),
    offset: String(offset),
    order: 'popularity_total',
    vocalinstrumental: 'instrumental',
    audioformat: 'mp32',
    include: 'musicinfo+licenses',
  });
  if (tags.length) params.append('tags', tags.join('+'));
  if (speed) params.append('speed', speed);

  const url = `${JAMENDO_BASE}/tracks/?${params}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Jamendo timeout');
    throw e;
  } finally { clearTimeout(t); }

  if (!res.ok) throw new Error(`Jamendo error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data.headers?.status !== 'success') {
    throw new Error(`Jamendo respondió error: ${data.headers?.error_message || 'desconocido'}`);
  }
  return (data.results || []).map(normalizeTrack);
}

function normalizeTrack(t) {
  return {
    external_provider: 'jamendo',
    external_id: String(t.id),
    name: t.name,
    artist: t.artist_name || '',
    duration_seconds: t.duration || 0,
    external_audio_url: t.audiodownload || t.audio,   // mp32 full track
    external_preview_url: t.audio,                    // streamable directo
    thumbnail_url: t.image || t.album_image || null,
    license_url: t.license_ccurl || null,
    bpm: t.musicinfo?.bpm ? Math.round(t.musicinfo.bpm) : null,
    source_tags: [
      ...(t.musicinfo?.tags?.vartags || []),
      ...(t.musicinfo?.tags?.genres || []),
      ...(t.musicinfo?.tags?.instruments || []),
    ],
  };
}
