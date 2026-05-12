// api/reels/curateService.js
// Pobla el catálogo de música con tracks variados de Jamendo. Una query por mood/genre
// con tags acotados + filtro de velocidad. Dedupea por (external_provider, external_id)
// para que llamadas repetidas no inserten duplicados.
import crypto from 'crypto';
import db from '../database/schema.js';
import { searchJamendo } from './jamendoService.js';

const run = (sql, params = []) => new Promise((res, rej) => {
  db.run(sql, params, function (err) { err ? rej(err) : res(this); });
});
const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});

// Plan completo de curaduría. Cada receta = un mood/genre con tags Jamendo + speed.
// Cubre los tags internos de musicTags.js para que filtrar por uno cualquiera dispare
// al menos una receta dedicada.
const CURATION_PLAN = [
  // Editorial calmo / reflexivo
  { internalTags: ['editorial_calmo', 'minimalista', 'energia_baja'], jamendoTags: ['calm', 'inspiring'], speed: 'low', count: 6 },
  { internalTags: ['editorial_calmo', 'piano', 'reflexivo'], jamendoTags: ['piano', 'calm'], speed: 'low', count: 6 },
  { internalTags: ['reflexivo', 'piano', 'energia_baja'], jamendoTags: ['contemplative', 'thoughtful'], speed: 'low', count: 6 },
  // Energético / uplifting
  { internalTags: ['energetico', 'uplifting', 'alegre', 'energia_alta'], jamendoTags: ['happy', 'positive'], speed: 'veryhigh', count: 6 },
  { internalTags: ['energetico', 'corporativo', 'energia_media'], jamendoTags: ['corporate', 'inspiring'], speed: 'medium', count: 6 },
  { internalTags: ['uplifting', 'alegre', 'energia_alta'], jamendoTags: ['uplifting', 'fun'], speed: 'high', count: 6 },
  // Cinemático / épico / dramático
  { internalTags: ['cinematico', 'epico', 'orquestal', 'energia_intensa'], jamendoTags: ['epic', 'cinematic'], speed: 'medium', count: 6 },
  { internalTags: ['cinematico', 'dramatico', 'orquestal'], jamendoTags: ['dramatic', 'soundtrack'], speed: 'medium', count: 6 },
  { internalTags: ['epico', 'orquestal', 'energia_intensa'], jamendoTags: ['epic', 'orchestral'], speed: 'high', count: 6 },
  // Narrativo / emocional / íntimo
  { internalTags: ['narrativo', 'reflexivo', 'piano', 'energia_baja'], jamendoTags: ['emotional', 'soft'], speed: 'low', count: 6 },
  { internalTags: ['narrativo', 'acustico', 'folk'], jamendoTags: ['acoustic', 'folk'], speed: 'medium', count: 6 },
  { internalTags: ['emocional', 'piano', 'energia_baja'], jamendoTags: ['emotional', 'piano'], speed: 'low', count: 6 },
  { internalTags: ['intimo', 'acustico', 'energia_baja'], jamendoTags: ['intimate', 'acoustic'], speed: 'low', count: 6 },
  // Melancólico / triste
  { internalTags: ['melancolico', 'piano', 'energia_baja'], jamendoTags: ['sad', 'melancholic'], speed: 'low', count: 6 },
  { internalTags: ['melancolico', 'reflexivo'], jamendoTags: ['melancholic', 'nostalgic'], speed: 'low', count: 6 },
  // Lo-fi / ambient / meditativo
  { internalTags: ['lofi', 'minimalista', 'meditativo', 'energia_baja'], jamendoTags: ['chillout', 'relaxing'], speed: 'low', count: 6 },
  { internalTags: ['ambient', 'meditativo', 'energia_baja'], jamendoTags: ['ambient', 'meditation'], speed: 'verylow', count: 6 },
  { internalTags: ['meditativo', 'ambient', 'energia_baja'], jamendoTags: ['meditation', 'spiritual'], speed: 'verylow', count: 6 },
  // Misterioso
  { internalTags: ['misterioso', 'cinematico', 'energia_media'], jamendoTags: ['mysterious', 'suspense'], speed: 'medium', count: 6 },
  // Electrónico / synthwave
  { internalTags: ['electronico', 'synthwave', 'energia_alta'], jamendoTags: ['electronic', 'retro'], speed: 'veryhigh', count: 6 },
  { internalTags: ['electronico', 'energia_media'], jamendoTags: ['electronic', 'background'], speed: 'medium', count: 6 },
  { internalTags: ['synthwave', 'electronico', 'energia_alta'], jamendoTags: ['synthwave', '80s'], speed: 'high', count: 6 },
  // Indie / acústico / romántico
  { internalTags: ['indie', 'acustico', 'romantico'], jamendoTags: ['indie', 'love'], speed: 'medium', count: 6 },
  { internalTags: ['romantico', 'piano', 'intimo'], jamendoTags: ['romantic', 'love'], speed: 'low', count: 6 },
  { internalTags: ['acustico', 'folk', 'energia_media'], jamendoTags: ['acoustic', 'guitar'], speed: 'medium', count: 6 },
  // Hip-hop / urbano
  { internalTags: ['hiphop', 'energia_media'], jamendoTags: ['hiphop', 'urban'], speed: 'medium', count: 6 },
  { internalTags: ['hiphop', 'energia_alta'], jamendoTags: ['hiphop', 'beat'], speed: 'high', count: 6 },
  // Motivacional / dramático
  { internalTags: ['motivacional', 'energia_alta', 'orquestal'], jamendoTags: ['motivational', 'powerful'], speed: 'veryhigh', count: 6 },
  { internalTags: ['motivacional', 'corporativo', 'energia_media'], jamendoTags: ['motivational', 'corporate'], speed: 'medium', count: 6 },
  { internalTags: ['dramatico', 'orquestal', 'energia_intensa'], jamendoTags: ['dramatic', 'tension'], speed: 'high', count: 6 },
  // Jazz / world / corporativo
  { internalTags: ['jazz', 'energia_baja', 'intimo'], jamendoTags: ['jazz', 'smooth'], speed: 'low', count: 6 },
  { internalTags: ['world', 'energia_media'], jamendoTags: ['world', 'ethnic'], speed: 'medium', count: 6 },
  { internalTags: ['corporativo', 'energia_media'], jamendoTags: ['corporate', 'business'], speed: 'medium', count: 6 },
  // Educacional / cómico
  { internalTags: ['educacional', 'corporativo', 'energia_media'], jamendoTags: ['background', 'documentary'], speed: 'medium', count: 6 },
  { internalTags: ['comico', 'alegre', 'energia_media'], jamendoTags: ['funny', 'comedy'], speed: 'medium', count: 6 },
];

function newId() { return crypto.randomBytes(8).toString('hex'); }

/**
 * Ejecuta la curaduría. Si se pasan activeTags, solo corre las recetas que cubren
 * esos tags (lo que el usuario filtró en la UI). Si no, corre el plan completo.
 *
 * Pagina automáticamente: cuenta cuántos tracks de cada provider+search-key ya tienes
 * y aplica offset para traer páginas nuevas en pulsadas repetidas.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @param {string[]} opts.activeTags — tags internos seleccionados en la UI (opcional)
 * @returns {{added: number, skipped: number, errors: string[], recipesRun: number}}
 */
export async function curateFromJamendo({ userId, activeTags = [] }) {
  if (!process.env.JAMENDO_CLIENT_ID) {
    throw new Error('JAMENDO_CLIENT_ID no configurada en .env. Regístrate gratis en devportal.jamendo.com y reinicia el server.');
  }

  // Filtrar recetas: si hay tags activos, solo correr las que incluyen al menos uno.
  let recipes = CURATION_PLAN;
  if (activeTags.length > 0) {
    const wantedSet = new Set(activeTags);
    recipes = CURATION_PLAN.filter(r => r.internalTags.some(t => wantedSet.has(t)));
    // Si ninguna receta cubre los tags exactos, fallback: una receta sintética usando
    // los activeTags como jamendoTags (best effort). Probablemente devuelva poco pero mejor que nada.
    if (recipes.length === 0) {
      recipes = [{ internalTags: activeTags, jamendoTags: activeTags, speed: undefined, count: 8 }];
    }
  }

  let added = 0, skipped = 0;
  const errors = [];

  // Concurrencia 3 para no hacer rate-limit (Jamendo permite ~1 req/s sostenido).
  const queue = [...recipes];
  const workers = Array(3).fill(null).map(async () => {
    while (queue.length) {
      const recipe = queue.shift();
      try {
        // Offset = cuántos tracks de Jamendo ya tienes con ESTOS internalTags exactos.
        // Así cada pulsada repetida con el mismo filtro trae la siguiente página.
        const tagKey = JSON.stringify(recipe.internalTags);
        const offsetRow = await get(
          `SELECT COUNT(*) AS n FROM music_tracks
           WHERE external_provider='jamendo' AND tags=?`,
          [tagKey]
        );
        const offset = offsetRow?.n || 0;

        const tracks = await searchJamendo({
          tags: recipe.jamendoTags,
          speed: recipe.speed,
          limit: recipe.count,
          offset,
        });
        for (const t of tracks) {
          const dup = await get(
            'SELECT id FROM music_tracks WHERE external_provider=? AND external_id=?',
            [t.external_provider, t.external_id]
          );
          if (dup) { skipped++; continue; }
          const id = newId();
          await run(
            `INSERT INTO music_tracks
              (id, name, artist, tags, bpm, duration_seconds, file_path, source, license,
               uploaded_by_user_id,
               external_provider, external_id, external_audio_url, external_preview_url,
               thumbnail_url, license_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              id,
              t.name.slice(0, 200),
              (t.artist || '').slice(0, 120) || null,
              JSON.stringify(recipe.internalTags),
              t.bpm,
              t.duration_seconds,
              '', // file_path vacío hasta lazy download
              'jamendo',
              'CC (revisar license_url)',
              userId,
              t.external_provider,
              t.external_id,
              t.external_audio_url,
              t.external_preview_url,
              t.thumbnail_url,
              t.license_url,
            ]
          );
          added++;
        }
      } catch (err) {
        errors.push(`${recipe.jamendoTags.join('+')} (${recipe.speed}): ${err.message}`);
      }
      // Pausa pequeña entre recetas para ser amable con Jamendo
      await new Promise(r => setTimeout(r, 300));
    }
  });
  await Promise.all(workers);

  return { added, skipped, errors, recipesRun: recipes.length };
}

/**
 * Descarga el audio de un track remoto a disco. Idempotente: si ya existe, no re-descarga.
 * Devuelve el path local del archivo.
 */
import fs from 'fs';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
const MUSIC_ROOT = isProd ? '/opt/data/music' : path.resolve(process.cwd(), 'data/music');
fs.mkdirSync(MUSIC_ROOT, { recursive: true });

export async function ensureLocalFile(track) {
  if (track.file_path && fs.existsSync(track.file_path)) return track.file_path;
  if (!track.external_audio_url) throw new Error('Track sin archivo local ni URL remota');

  const localPath = path.join(MUSIC_ROOT, `${track.id}.mp3`);
  const res = await fetch(track.external_audio_url);
  if (!res.ok) throw new Error(`Descarga falló (${res.status}) para track ${track.name}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
  await run('UPDATE music_tracks SET file_path=? WHERE id=?', [localPath, track.id]);
  return localPath;
}
