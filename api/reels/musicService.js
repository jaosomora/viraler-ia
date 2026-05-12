// api/reels/musicService.js
// CRUD del catálogo de música.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../database/schema.js';
import { probeDuration } from './reelRenderer.js';
import { validateTags, MUSIC_TAGS } from './musicTags.js';

const isProd = process.env.NODE_ENV === 'production';
const MUSIC_ROOT = isProd ? '/opt/data/music' : path.resolve(process.cwd(), 'data/music');
fs.mkdirSync(MUSIC_ROOT, { recursive: true });

const run = (sql, params = []) => new Promise((res, rej) => {
  db.run(sql, params, function (err) { err ? rej(err) : res(this); });
});
const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});
const all = (sql, params = []) => new Promise((res, rej) => {
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []));
});

function newId() { return crypto.randomBytes(8).toString('hex'); }

function parseTrack(row) {
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}

/**
 * Sube un track al catálogo. tempPath viene de multer (req.file.path).
 * Mueve el archivo a /opt/data/music/<id>.<ext> y guarda metadata.
 */
export async function uploadTrack({ userId, tempPath, originalName, name, artist, tags, source, license, bpm }) {
  const id = newId();
  const ext = (path.extname(originalName) || '.mp3').toLowerCase();
  const finalPath = path.join(MUSIC_ROOT, `${id}${ext}`);
  fs.copyFileSync(tempPath, finalPath);
  try { fs.unlinkSync(tempPath); } catch {}

  let duration = 0;
  try { duration = await probeDuration(finalPath); } catch { duration = 0; }

  await run(
    `INSERT INTO music_tracks
       (id, name, artist, tags, bpm, duration_seconds, file_path, source, license, uploaded_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      (name || originalName.replace(/\.[^.]+$/, '')).slice(0, 200),
      (artist || '').slice(0, 120) || null,
      JSON.stringify(validateTags(tags || [])),
      bpm ? parseInt(bpm, 10) : null,
      duration,
      finalPath,
      (source || 'subido_por_ti').slice(0, 60),
      (license || '').slice(0, 200) || null,
      userId,
    ]
  );
  return parseTrack(await get('SELECT * FROM music_tracks WHERE id=?', [id]));
}

/**
 * Lista tracks con búsqueda y filtros.
 *
 * @param {object} opts
 * @param {string} opts.query    — texto libre (name/artist)
 * @param {Array}  opts.tags     — array de tag ids; track debe tener AL MENOS UNO de los pedidos
 */
export async function listTracks({ query, tags } = {}) {
  let sql = 'SELECT * FROM music_tracks';
  const params = [];
  const where = [];
  if (query && query.trim()) {
    where.push('(LOWER(name) LIKE ? OR LOWER(IFNULL(artist,\'\')) LIKE ?)');
    const q = `%${query.trim().toLowerCase()}%`;
    params.push(q, q);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  const rows = await all(sql, params);
  const parsed = rows.map(parseTrack);
  if (!tags || tags.length === 0) return parsed;
  const wantedTags = new Set(validateTags(tags));
  return parsed.filter(t => t.tags.some(tag => wantedTags.has(tag)));
}

export async function getTrack(id) {
  return parseTrack(await get('SELECT * FROM music_tracks WHERE id=?', [id]));
}

export async function deleteTrack(id) {
  const t = await getTrack(id);
  if (!t) return { success: false };
  try { if (fs.existsSync(t.file_path)) fs.unlinkSync(t.file_path); } catch {}
  await run('DELETE FROM music_tracks WHERE id=?', [id]);
  // Limpieza: cualquier reel_job que apuntaba a este track pierde la referencia.
  await run('UPDATE reel_jobs SET music_track_id=NULL WHERE music_track_id=?', [id]);
  return { success: true };
}

export async function updateTrack(id, patch) {
  const t = await getTrack(id);
  if (!t) throw new Error('Track no encontrado');
  const fields = [];
  const values = [];
  if (patch.name !== undefined) { fields.push('name=?'); values.push(patch.name.slice(0, 200)); }
  if (patch.artist !== undefined) { fields.push('artist=?'); values.push(patch.artist.slice(0, 120) || null); }
  if (patch.bpm !== undefined) { fields.push('bpm=?'); values.push(patch.bpm ? parseInt(patch.bpm, 10) : null); }
  if (patch.source !== undefined) { fields.push('source=?'); values.push(patch.source); }
  if (patch.license !== undefined) { fields.push('license=?'); values.push(patch.license || null); }
  if (patch.tags !== undefined) { fields.push('tags=?'); values.push(JSON.stringify(validateTags(patch.tags))); }
  if (!fields.length) return t;
  values.push(id);
  await run(`UPDATE music_tracks SET ${fields.join(', ')} WHERE id=?`, values);
  return getTrack(id);
}

export { MUSIC_TAGS };
