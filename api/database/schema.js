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

  // Migration: acceso temporal a la herramienta (NULL = sin límite, ej. owner/internos)
  db.run(`ALTER TABLE users ADD COLUMN access_expires_at TIMESTAMP`, () => {});

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

  // Secretos: cualquier usuario logueado crea uno con texto libre cifrado.
  // Solo el owner los puede leer. Caducan a 30 días.
  db.run(`
    CREATE TABLE IF NOT EXISTS secrets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      title TEXT,
      content_encrypted TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      read_at TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);
  // Cleanup tablas previas (si existían del MVP anterior)
  db.run(`DROP TABLE IF EXISTS secret_items`);
  db.run(`DROP TABLE IF EXISTS secret_deliveries`);

  // AS Clips — jobs de generación de clips verticales (9:16) con subs IG-style.
  // Un job = una URL/upload procesado. Genera N clips con highlights detectados por LLM.
  db.run(`
    CREATE TABLE IF NOT EXISTS clip_jobs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      source_url TEXT,
      source_filename TEXT,
      title TEXT,
      duration_seconds INTEGER,
      thumbnail TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      stage_index INTEGER DEFAULT 0,
      error_message TEXT,
      total_clips INTEGER DEFAULT 0,
      whisper_cost_usd REAL DEFAULT 0,
      llm_cost_usd REAL DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      whisper_json_path TEXT,
      source_video_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP
    )
  `);

  // Migrations: preferencias job-level que se eligen en el form al generar.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN requested_clip_count INTEGER`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN default_resolution TEXT DEFAULT '1080'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN aspect_ratio TEXT DEFAULT '9:16'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_preset_mode TEXT DEFAULT 'auto'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_hook_default TEXT DEFAULT 'Anton'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_caption_default TEXT DEFAULT 'InterSemiBold'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_keyword_default TEXT DEFAULT 'MontserratBold'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN source_width INTEGER`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN source_height INTEGER`, () => {});
  // Migrations: aspect_ratio per-clip (override del job-level si el editor lo cambia)
  db.run(`ALTER TABLE clips ADD COLUMN aspect_ratio TEXT DEFAULT '9:16'`, () => {});
  // Cache de las 3 versiones del post_caption por tono (JSON: {pregunta, storytelling, insight})
  db.run(`ALTER TABLE clips ADD COLUMN post_captions_cache TEXT`, () => {});
  // Estilo de borde y sombra de subtítulos
  db.run(`ALTER TABLE clips ADD COLUMN outline_enabled INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN outline_thickness INTEGER DEFAULT 5`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN shadow_opacity INTEGER DEFAULT 50`, () => {});

  // Clips individuales generados por un job. Cada clip tiene parámetros editables
  // (texto, fuentes, keywords, etc.) que se aplican al regenerar el MP4 al descargar.
  db.run(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES clip_jobs(id) ON DELETE CASCADE,
      clip_index INTEGER NOT NULL,
      title TEXT,
      hook TEXT,
      caption TEXT,
      keywords TEXT,
      post_caption TEXT,
      post_caption_tone TEXT DEFAULT 'pregunta',
      start_seconds REAL NOT NULL,
      end_seconds REAL NOT NULL,
      virality_score INTEGER,
      reasoning TEXT,
      font_hook TEXT DEFAULT 'Anton',
      font_caption TEXT DEFAULT 'Inter SemiBold',
      font_keyword TEXT DEFAULT 'Montserrat Bold',
      keyword_color TEXT DEFAULT '#FDE047',
      camera_motion TEXT DEFAULT 'zoom-in',
      sub_position INTEGER DEFAULT 68,
      output_path TEXT,
      output_resolution TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Magic link tokens — login sin contraseña por email (15 min, un solo uso).
  // Se guarda el hash SHA-256 del token, nunca el token en claro.
  db.run(`
    CREATE TABLE IF NOT EXISTS magic_link_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Esquema de base de datos inicializado correctamente.');
});

export default db;
