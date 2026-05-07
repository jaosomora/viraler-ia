// Exporta un MP4 con el .ass actualizado (pop animation) para validar que libass lo procesa.
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exportClipMp4 } from '../api/clips/clipsService.js';
import db from '../api/database/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const all = (sql) => new Promise((res, rej) => db.all(sql, [], (e, r) => e ? rej(e) : res(r || [])));

const clips = await all(`
  SELECT c.id, c.title, c.job_id FROM clips c
  JOIN clip_jobs j ON j.id = c.job_id
  WHERE c.render_mode='overlay' AND j.status='done' AND c.base_video_path IS NOT NULL
  LIMIT 1
`);
if (clips.length === 0) { console.error('No hay clips overlay'); process.exit(1); }

const c = clips[0];
console.log(`Exportando "${c.title}" (${c.id}) con pop animation...`);
const out = await exportClipMp4(c.id, '720');
const size = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
console.log(`OK · ${size}MB · ${out}`);
console.log(`open '${out}'`);
process.exit(0);
