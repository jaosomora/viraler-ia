// Genera 7 MP4 cortos (uno por cada transición) a partir de un clip existente,
// para validar visualmente que cada modo produce un efecto distinto.
// Uso: node scripts/test-transitions.mjs [jobId] [clipId]
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderClipBase } from '../api/clips/videoProcessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIPS_ROOT = path.resolve(__dirname, '../data/clips');

const TRANSITIONS = ['none', 'fade-in', 'fade-out', 'fade-cross', 'zoom-in', 'zoom-out', 'zoom-cross'];

async function main() {
  const jobs = fs.readdirSync(CLIPS_ROOT).filter(d => fs.statSync(path.join(CLIPS_ROOT, d)).isDirectory());
  if (jobs.length === 0) { console.error('No hay jobs en data/clips/'); process.exit(1); }

  const jobId = process.argv[2] || jobs[0];
  const jobDir = path.join(CLIPS_ROOT, jobId);
  const sourcePath = path.join(jobDir, 'source.mp4');
  if (!fs.existsSync(sourcePath)) { console.error(`No source.mp4 en ${jobDir}`); process.exit(1); }

  const outDir = path.join(jobDir, 'transition-tests');
  fs.mkdirSync(outDir, { recursive: true });

  // Tomar un segmento de 5s para test rápido (no necesitamos clip completo).
  const clipBase = {
    start_seconds: 30,
    end_seconds: 35,
    aspect_ratio: '9:16',
    camera_motion: 'static',
  };

  for (const t of TRANSITIONS) {
    const out = path.join(outDir, `transition-${t}.mp4`);
    if (fs.existsSync(out)) { console.log(`✓ existe: ${t}`); continue; }
    process.stdout.write(`→ renderizando ${t}... `);
    const start = Date.now();
    try {
      await renderClipBase({
        sourceVideo: sourcePath,
        clip: { ...clipBase, transition: t },
        outputPath: out,
        resolution: '720',
      });
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      const size = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
      console.log(`OK ${sec}s · ${size}MB`);
    } catch (e) {
      console.log(`✗ FALLO: ${e.message.slice(0, 200)}`);
    }
  }

  console.log(`\nResultados en: ${outDir}`);
  console.log('Reproduce cada uno para validar:');
  for (const t of TRANSITIONS) {
    console.log(`  open '${path.join(outDir, `transition-${t}.mp4`)}'`);
  }
}

main();
