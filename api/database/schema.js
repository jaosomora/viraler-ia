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
  // Modo de selección de clips:
  //   'auto'   — IA segmenta capítulos + elige highlights (comportamiento por defecto, idéntico al anterior).
  //   'manual' — tras transcribir, el job pausa en status='awaiting_selection' esperando que el usuario
  //              envíe los rangos vía POST /api/clips/jobs/:id/submit-ranges.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN mode TEXT DEFAULT 'auto'`, () => {});
  // Rangos elegidos por el usuario en modo manual (JSON: [{start,end}]). Guardados para auditoría / debug.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN manual_ranges TEXT`, () => {});
  // Si en modo manual el usuario quiere que la IA genere hook + caption + post_captions (gpt-4o-mini) por clip.
  // 1 = sí (default), 0 = no (clip queda con strings vacíos, el usuario los rellena en el editor).
  db.run(`ALTER TABLE clip_jobs ADD COLUMN hook_auto_enabled INTEGER DEFAULT 1`, () => {});

  // CREATE TABLE clips DEBE ir ANTES de los ALTER TABLE clips siguientes, sino en una DB fresca
  // las migraciones fallan silenciosamente y la tabla nace incompleta. Bug latente histórico:
  // este orden parecía funcionar en la DB de producción porque clips ya existía con todas las
  // columnas; pero en cualquier máquina nueva (clone limpio, nuevo worktree, CI) la tabla salía
  // sin post_captions_cache, render_mode, hook_color, etc. y los INSERTs explotaban.
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

  // Migrations: aspect_ratio per-clip (override del job-level si el editor lo cambia)
  db.run(`ALTER TABLE clips ADD COLUMN aspect_ratio TEXT DEFAULT '9:16'`, () => {});
  // Cache de las 3 versiones del post_caption por tono (JSON: {pregunta, storytelling, insight})
  db.run(`ALTER TABLE clips ADD COLUMN post_captions_cache TEXT`, () => {});
  // Estilo de borde y sombra de subtítulos
  db.run(`ALTER TABLE clips ADD COLUMN outline_enabled INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN outline_thickness INTEGER DEFAULT 5`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN shadow_opacity INTEGER DEFAULT 50`, () => {});
  // Modelo Opus: el render pesado se separa en (1) base.mp4 sin subs y (2) export con subs on-demand.
  // 'overlay' = preview en HTML/CSS sobre base.mp4, export quema subs solo al pedir.
  // 'burned-legacy' = clips antiguos: el output_path ya tiene subs quemados, no editable en preview.
  db.run(`ALTER TABLE clips ADD COLUMN render_mode TEXT DEFAULT 'overlay'`, () => {
    // Marcar clips ya existentes con output_path como legacy (no se les puede editar el preview).
    db.run(`UPDATE clips SET render_mode='burned-legacy' WHERE output_path IS NOT NULL AND render_mode IS NULL`, () => {});
  });
  db.run(`ALTER TABLE clips ADD COLUMN base_video_path TEXT`, () => {});
  // Hash de params que afectan al base.mp4 (start/end/aspect/camera_motion). Si cambian, regeneramos base.
  db.run(`ALTER TABLE clips ADD COLUMN base_params_hash TEXT`, () => {});
  // Overrides de chunks de subtítulos: JSON [{idx, text, hidden}]
  db.run(`ALTER TABLE clips ADD COLUMN caption_overrides TEXT`, () => {});
  // Tipografía granular (paridad con editores tipo Opus): tamaño, italic, underline, fondo de keyword.
  db.run(`ALTER TABLE clips ADD COLUMN hook_font_size INTEGER`, () => {}); // null = adaptativo (legacy)
  db.run(`ALTER TABLE clips ADD COLUMN caption_font_size INTEGER DEFAULT 58`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN hook_italic INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN hook_underline INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN caption_italic INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN caption_underline INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN keyword_italic INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN keyword_underline INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN keyword_bg_color TEXT`, () => {}); // null = sin fondo
  db.run(`ALTER TABLE clips ADD COLUMN keyword_bg_opacity INTEGER DEFAULT 100`, () => {});
  // Transición de entrada/salida del clip. Valores: 'none', 'fade-in', 'fade-out', 'fade-cross',
  // 'zoom-in' (entry), 'zoom-out' (exit), 'zoom-cross' (ambos). Default 'none'.
  db.run(`ALTER TABLE clips ADD COLUMN transition TEXT DEFAULT 'none'`, () => {});
  // Gancho visible en el video. 0 oculta el hook; texto sigue editable pero no se quema.
  db.run(`ALTER TABLE clips ADD COLUMN hook_enabled INTEGER DEFAULT 1`, () => {});
  // Colores del texto base (sin keywords). Default blanco para mantener compatibilidad.
  db.run(`ALTER TABLE clips ADD COLUMN hook_color TEXT DEFAULT '#FFFFFF'`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN caption_color TEXT DEFAULT '#FFFFFF'`, () => {});
  // Color del outline (borde) del texto. Default negro. Cuando el texto es oscuro conviene cambiar a blanco.
  db.run(`ALTER TABLE clips ADD COLUMN outline_color TEXT DEFAULT '#000000'`, () => {});
  // Karaoke style: la palabra se "ilumina" mientras se dice. Atenúa las palabras aún no dichas.
  db.run(`ALTER TABLE clips ADD COLUMN karaoke_enabled INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN karaoke_dim_opacity INTEGER DEFAULT 50`, () => {});

  // Plantillas de estilo guardadas por el usuario. Cada plantilla = snapshot de ~25 params del editor.
  db.run(`
    CREATE TABLE IF NOT EXISTS clip_templates (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      params TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
