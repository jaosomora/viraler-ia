// api/database/schema.js
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getDataDir = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const prodDataDir = '/opt/data';
    if (!fs.existsSync(prodDataDir)) {
      try {
        fs.mkdirSync(prodDataDir, { recursive: true });
      } catch (error) {
        console.error(`Error al crear directorio de datos: ${error.message}`);
        return '/tmp';
      }
    }
    return prodDataDir;
  } else {
    const devDataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(devDataDir)) {
      fs.mkdirSync(devDataDir, { recursive: true });
    }
    return devDataDir;
  }
};

const dataDir = getDataDir();
const dbPath = path.join(dataDir, 'viraler.db');

console.log(`Inicializando base de datos SQLite en: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
    return;
  }
  console.log('Conexión a la base de datos SQLite establecida.');
});

db.serialize(() => {
  // Tabla de transcripciones
  db.run(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      platform TEXT,
      title TEXT,
      transcript TEXT NOT NULL,
      duration INTEGER,
      channel TEXT,
      thumbnail TEXT,
      language TEXT DEFAULT 'es',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de registro de uso
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      transcriptions INTEGER DEFAULT 1,
      audio_minutes REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de configuración
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Esquema de base de datos inicializado correctamente.');
});

export default db;
