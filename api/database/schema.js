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
const dbPath = path.join(dataDir, 'as-transcribe.db');

console.log(`Inicializando base de datos SQLite en: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
    return;
  }
  console.log('Conexión a la base de datos SQLite establecida.');
});

db.serialize(() => {
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: agregar user_id si la tabla ya existe sin ella
  db.run(`ALTER TABLE transcriptions ADD COLUMN user_id INTEGER REFERENCES users(id)`, (err) => {
    // Ignora si la columna ya existe
    if (err && !err.message.includes('duplicate column')) {
      // Column already exists or other expected error
    }
  });

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

  // Tabla de conversiones (documentos a Markdown)
  db.run(`
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_format TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: agregar columna conversions a usage_stats si no existe
  db.run(`ALTER TABLE usage_stats ADD COLUMN conversions INTEGER DEFAULT 0`, (err) => {
    // Ignora si la columna ya existe
  });

  // Tabla de configuración
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sobres de entrega de credenciales (un link por cliente)
  db.run(`
    CREATE TABLE IF NOT EXISTS secret_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      description TEXT,
      global_notes_encrypted TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      submitted_at TIMESTAMP,
      read_at TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);

  // Cada credencial dentro del sobre
  db.run(`
    CREATE TABLE IF NOT EXISTS secret_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL REFERENCES secret_deliveries(id) ON DELETE CASCADE,
      service_name TEXT,
      url_encrypted TEXT,
      username_encrypted TEXT,
      password_encrypted TEXT,
      notes_encrypted TEXT,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Esquema de base de datos inicializado correctamente.');
});

export default db;
