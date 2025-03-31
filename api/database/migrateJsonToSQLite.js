// api/database/migrateJsonToSQLite.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from './schema.js';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al archivo JSON con los datos antiguos
const usageFilePath = path.join(__dirname, '../../data/usage.json');

/**
 * Migra datos del archivo JSON a SQLite
 */
async function migrateData() {
  console.log('Iniciando migración de datos JSON a SQLite...');
  
  // Verificar si existe el archivo JSON
  if (!fs.existsSync(usageFilePath)) {
    console.log('No existe archivo de datos para migrar. Saltando migración.');
    process.exit(0);
  }
  
  try {
    // Leer el archivo JSON
    const jsonData = JSON.parse(fs.readFileSync(usageFilePath, 'utf8'));
    console.log(`Datos JSON leídos correctamente: ${jsonData.totalTranscriptions} transcripciones encontradas.`);
    
    // Migrar historial de uso
    if (jsonData.history && jsonData.history.length > 0) {
      console.log(`Migrando ${jsonData.history.length} registros históricos...`);
      
      // Usar promesas para operaciones asíncronas
      const promises = jsonData.history.map(entry => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
             transcriptions = transcriptions + excluded.transcriptions,
             audio_minutes = audio_minutes + excluded.audio_minutes,
             cost = cost + excluded.cost`,
            [entry.date, entry.transcriptions, entry.audioMinutes, entry.cost],
            (err) => {
              if (err) {
                console.error(`Error al migrar registro del ${entry.date}:`, err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      });
      
      await Promise.all(promises);
      console.log('Migración de historial completada.');
    } else {
      console.log('No hay registros históricos para migrar.');
    }
    
    // Crear un respaldo del archivo JSON original
    const backupPath = `${usageFilePath}.bak-${Date.now()}`;
    fs.copyFileSync(usageFilePath, backupPath);
    console.log(`Archivo JSON original respaldado en: ${backupPath}`);
    
    console.log('Migración completada exitosamente.');
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migrateData().then(() => {
  console.log('Proceso de migración finalizado.');
  db.close();
  process.exit(0);
}).catch(err => {
  console.error('Error en el proceso de migración:', err);
  db.close();
  process.exit(1);
});
