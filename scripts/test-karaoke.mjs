import db from '../api/database/schema.js';
import { exportClipMp4 } from '../api/clips/clipsService.js';
const get = (sql) => new Promise((r, j) => db.get(sql, [], (e, x) => e ? j(e) : r(x)));
const run = (sql) => new Promise((r, j) => db.run(sql, [], function(e) { e ? j(e) : r(this); }));
const c = await get(`SELECT c.* FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.render_mode='overlay' AND j.status='done' AND c.base_video_path IS NOT NULL LIMIT 1`);
if (!c) { console.error('no clips'); process.exit(1); }
console.log(`Activando karaoke en clip ${c.id}...`);
await run(`UPDATE clips SET karaoke_enabled=1, karaoke_dim_opacity=40 WHERE id='${c.id}'`);
console.log('Exportando con karaoke...');
const out = await exportClipMp4(c.id, '720');
console.log(`OK: ${out}`);
process.exit(0);
