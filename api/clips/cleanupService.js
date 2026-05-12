// api/clips/cleanupService.js
// Cleanup automático de archivos de clips para evitar llenar /opt/data (Render tiene
// 1GB de disco, un solo job puede ocupar 200-300MB con video fuente + base.mp4 + final.mp4).
//
// Dos mecanismos:
//   1. Tiempo: jobs done con finished_at > 24h → se purgan archivos en disco (la fila
//      de DB se conserva con files_purged=1 para que la UI sepa que no es re-exportable).
//   2. Presión: si /opt/data está sobre 85% lleno, se purgan jobs done por orden de
//      antigüedad hasta bajar a 70%.
//
// Corre on-startup + cada hora vía setInterval.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CLIPS_DIR = process.env.CLIPS_DIR || '/opt/data/clips';
const REELS_DIR = process.env.REELS_DIR || '/opt/data/reels';
const DATA_DIR = process.env.DATA_DIR || '/opt/data';
const MAX_AGE_HOURS = 24;
const DISK_PRESSURE_HIGH_PCT = 85;
const DISK_PRESSURE_LOW_PCT = 70;
const INTERVAL_MS = 60 * 60 * 1000; // 1h

function getDiskUsagePct(mountPath) {
  try {
    const out = execSync(`df -B1 ${mountPath} | tail -1`).toString().trim().split(/\s+/);
    const used = parseInt(out[2], 10);
    const total = parseInt(out[1], 10);
    if (!total) return 0;
    return (used / total) * 100;
  } catch {
    return 0;
  }
}

function purgeJobFiles(jobId, root = CLIPS_DIR) {
  const dir = path.join(root, jobId);
  if (!fs.existsSync(dir)) return false;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.warn(`[cleanup] error purging ${jobId}: ${err.message}`);
    return false;
  }
}

// Lista jobs done elegibles para purga ordenados por antigüedad (más viejos primero).
function listPurgeCandidates(db, table, olderThanHours) {
  return new Promise((resolve) => {
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
    db.all(
      `SELECT id, finished_at FROM ${table}
       WHERE status='done' AND files_purged=0 AND finished_at IS NOT NULL AND finished_at < ?
       ORDER BY finished_at ASC`,
      [cutoff],
      (err, rows) => resolve(err ? [] : (rows || []))
    );
  });
}

// Lista TODOS los jobs done que aún tienen archivos (sin importar edad), por antigüedad.
// Usado solo en modo presión de disco.
function listAllDoneWithFiles(db, table) {
  return new Promise((resolve) => {
    db.all(
      `SELECT id, finished_at FROM ${table}
       WHERE status='done' AND files_purged=0
       ORDER BY finished_at ASC NULLS FIRST`,
      (err, rows) => resolve(err ? [] : (rows || []))
    );
  });
}

function markPurged(db, table, jobId) {
  return new Promise((resolve) => {
    db.run(
      `UPDATE ${table} SET files_purged=1 WHERE id=?`,
      [jobId],
      () => resolve()
    );
  });
}

async function purgeBatch(db, table, root, jobs, reason) {
  let purged = 0;
  for (const j of jobs) {
    const ok = purgeJobFiles(j.id, root);
    if (ok) {
      await markPurged(db, table, j.id);
      purged += 1;
    }
  }
  if (purged > 0) {
    console.log(`[cleanup] purged ${purged} ${table.replace('_jobs','')} job(s) (${reason})`);
  }
  return purged;
}

// Configuración por tabla: (tableName, rootDir)
const TARGETS = [
  { table: 'clip_jobs', root: CLIPS_DIR },
  { table: 'reel_jobs', root: REELS_DIR },
];

export async function runCleanup(db) {
  try {
    // 1) Purga por tiempo: jobs done viejos en CADA tabla.
    for (const { table, root } of TARGETS) {
      if (!fs.existsSync(root)) continue;
      const oldJobs = await listPurgeCandidates(db, table, MAX_AGE_HOURS);
      if (oldJobs.length) {
        await purgeBatch(db, table, root, oldJobs, `>${MAX_AGE_HOURS}h since finished`);
      }
    }

    // 2) Purga por presión de disco: si seguimos sobre 85%, borrar más jobs
    //    (más recientes) hasta bajar a 70%. Atraviesa todas las tablas en orden.
    let usagePct = getDiskUsagePct(DATA_DIR);
    if (usagePct >= DISK_PRESSURE_HIGH_PCT) {
      console.warn(`[cleanup] disk pressure: ${usagePct.toFixed(1)}% used, purging aggressively`);
      for (const { table, root } of TARGETS) {
        if (usagePct < DISK_PRESSURE_LOW_PCT) break;
        const candidates = await listAllDoneWithFiles(db, table);
        for (const j of candidates) {
          if (usagePct < DISK_PRESSURE_LOW_PCT) break;
          const ok = purgeJobFiles(j.id, root);
          if (ok) {
            await markPurged(db, table, j.id);
            usagePct = getDiskUsagePct(DATA_DIR);
          }
        }
      }
      console.log(`[cleanup] after pressure purge: ${usagePct.toFixed(1)}% used`);
    }
  } catch (err) {
    console.warn('[cleanup] failed:', err.message);
  }
}

export function startCleanupScheduler(db) {
  // Correr una vez al arranque, luego cada hora.
  runCleanup(db).catch(() => {});
  setInterval(() => runCleanup(db).catch(() => {}), INTERVAL_MS);
  console.log(`[cleanup] scheduler started · interval=${INTERVAL_MS / 60000}min · maxAge=${MAX_AGE_HOURS}h · pressure=${DISK_PRESSURE_HIGH_PCT}%→${DISK_PRESSURE_LOW_PCT}%`);
}
